# Tine.app for macOS

Build kit for Tine.app and Tine-<version>.dmg. Run on a Mac with Xcode Command Line Tools.

1. Copy `tine-darwin-arm64.tar.gz` and `tine-darwin-x64.tar.gz` from the release you want (e.g. `../1.2/release/`) into this folder. The version is read from the binary.
2. `./build.sh` builds `build/Tine.app` (universal, ad hoc signed) and `build/Tine-<version>.dmg`.
3. `./notarize.sh "Developer ID Application: Name (TEAMID)"` signs, notarizes and staples (setup steps are in the script).

Layout: the Swift launcher is `Contents/MacOS/Tine`; the tine CLI is `Contents/Helpers/tine`.
Never put the CLI in `Contents/MacOS/`: `tine` and `Tine` are the same name on case-insensitive volumes,
and the launcher would overwrite it and spawn itself in a loop.

The launcher runs `tine daw <file> --port N --no-open` per open file (ports from 7357 up),
opens it in the default browser (keeps Web MIDI in Chrome), and stops every server on Quit.
With no file it opens ~/Documents/Tine/scratch.tine. Logs go to ~/Library/Logs/Tine.log.
