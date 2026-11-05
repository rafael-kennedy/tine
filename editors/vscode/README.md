# Tine for VS Code

Language support for [Tine](https://github.com/rafael-kennedy/tine), a programming language for music.

- Syntax highlighting for notes, scale degrees, phrases, chords and drums
- Live diagnostics, including errors that would only appear while playing
- Completion, hover docs (hover a note to see its frequency), signature help
- Go to definition and an outline of voices, sections and functions
- Commands: **Tine: Open in DAW** (Ctrl/Cmd+Alt+Enter) opens the live-coding DAW on the current file; edits you save here are heard there on the next bar. Also Play, Render to WAV, Export MIDI, Package, and Open the Tutorial.

The language server is bundled. The playback commands need the `tine` executable on your PATH (or set `tine.path`).
