#!/bin/bash
# Build Tine.app (universal) and Tine-<version>.dmg on macOS.
# Needs Xcode Command Line Tools (swiftc, lipo, codesign, iconutil, hdiutil).
# Usage: ./build.sh [signing identity]   (default "-" = ad hoc)
#   e.g. ./build.sh "Developer ID Application: Your Name (TEAMID)"
set -euo pipefail
cd "$(dirname "$0")"
IDENTITY="${1:--}"
OUT=build; rm -rf "$OUT"; mkdir -p "$OUT/bin"
APP="$OUT/Tine.app"

echo "== tine binaries -> universal"
tar xzf tine-darwin-arm64.tar.gz -C "$OUT/bin"
tar xzf tine-darwin-x64.tar.gz -C "$OUT/bin"
# The CLI goes in Contents/Helpers: MacOS/tine would collide with MacOS/Tine
# on case-insensitive volumes (the default on macOS).
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$APP/Contents/Helpers"
CLI="$APP/Contents/Helpers/tine"
lipo -create "$OUT/bin/tine-darwin-arm64" "$OUT/bin/tine-darwin-x64" -output "$CLI"
chmod +x "$CLI"
VERSION=$("$CLI" --version | awk '{print $NF}')   # e.g. "tine 1.2.0" -> 1.2.0
echo "tine $VERSION"

echo "== launcher"
swiftc -O -target arm64-apple-macos11 -o "$OUT/Tine-arm64" Tine.swift
swiftc -O -target x86_64-apple-macos11 -o "$OUT/Tine-x64" Tine.swift
lipo -create "$OUT/Tine-arm64" "$OUT/Tine-x64" -output "$APP/Contents/MacOS/Tine"
# sanity: the CLI must still be the Bun binary, not the launcher
"$CLI" --version | grep -q . || { echo "bundled tine CLI is broken"; exit 1; }
cmp -s "$CLI" "$APP/Contents/MacOS/Tine" && { echo "CLI and launcher are the same file"; exit 1; }

echo "== bundle"
sed "s/__VERSION__/$VERSION/g" Info.plist > "$APP/Contents/Info.plist"
printf 'APPL????' > "$APP/Contents/PkgInfo"
ICONSET="$OUT/Tine.iconset"; mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z $s $s icon-1024.png --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) icon-1024.png --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/Tine.icns"

echo "== sign ($IDENTITY)"
if [ "$IDENTITY" = "-" ]; then
  codesign --force --sign - "$CLI"
  codesign --force --sign - "$APP"
else
  codesign --force --options runtime --timestamp --entitlements entitlements.plist --sign "$IDENTITY" "$CLI"
  codesign --force --options runtime --timestamp --entitlements entitlements.plist --sign "$IDENTITY" "$APP"
fi
codesign --verify --deep --strict "$APP"

echo "== dmg"
STAGE="$OUT/dmg"; mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
DMG="$OUT/Tine-$VERSION.dmg"
hdiutil create -volname "Tine $VERSION" -srcfolder "$STAGE" -fs HFS+ -format UDZO -imagekey zlib-level=9 -ov "$DMG" >/dev/null
[ "$IDENTITY" = "-" ] || codesign --force --timestamp --sign "$IDENTITY" "$DMG"
mkdir -p dist && cp "$DMG" dist/   # build/ is wiped each run; dist/ keeps every release
echo "built $DMG ($(du -h "$DMG" | cut -f1))"
