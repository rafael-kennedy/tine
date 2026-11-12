#!/bin/bash
# Sign with a Developer ID, notarize, and staple, so Gatekeeper opens it without prompts.
# One-time setup (stores an app-specific password from appleid.apple.com in the keychain):
#   xcrun notarytool store-credentials tine --apple-id you@example.com --team-id TEAMID
# Then:
#   ./notarize.sh "Developer ID Application: Your Name (TEAMID)"
set -euo pipefail
cd "$(dirname "$0")"
[ $# -ge 1 ] || { echo "usage: $0 \"Developer ID Application: Name (TEAMID)\" [keychain-profile]"; exit 2; }
./build.sh "$1"
DMG=$(ls build/Tine-*.dmg)
xcrun notarytool submit "$DMG" --keychain-profile "${2:-tine}" --wait
xcrun stapler staple "$DMG"
spctl -a -t open --context context:primary-signature -v "$DMG"
