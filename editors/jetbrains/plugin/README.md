# Tine plugin for IntelliJ-based IDEs

Language support and run tooling for Tine in IntelliJ IDEA 2025.2+ (Ultimate, or the unified 2025.3+ edition) and the paid JetBrains IDEs. Not available in Community builds or Android Studio, which lack the LSP API.

## What it does

- **Highlighting** from a small native lexer: notes, scale degrees, chord symbols, scales, drums, instruments, keywords, performance toggles. Colors are under Settings | Editor | Color Scheme | Tine.
- **Completion, hover docs, parameter info, live errors, go to definition, structure view, formatting** from `tine lsp`, the same server every Tine editor uses. The plugin keeps no second grammar.
- **Run configurations** for every `tine` command (DAW, play, render, MIDI, MusicXML, score, lead sheet, chord chart, check, piano roll, pack, SuperDirt, REPL, tutorial, theory course). Run a `.tine` file from the gutter icon or the context menu: it opens in the DAW, which reloads on every save. Score, lead sheet, chart and pack open in your browser when done. `--> file:line:col` in errors is clickable.
- **Tools | Tine** and the editor and project view context menus have every command.
- **Live templates** (262, generated from the standard library) that apply in `.tine` files only.
- **File | New | Tine Piece**, `--` line comments (Cmd+/), bracket and quote pairing.

## Install

Settings | Plugins | gear icon | Install Plugin from Disk, then choose `build/distributions/tine-intellij-<version>.zip`. Restart.

The plugin finds `tine` on your PATH or in `/Applications/Tine.app`. Otherwise set it in Settings | Languages & Frameworks | Tine.

## Build

Needs a JDK 17+ to start Gradle; Gradle fetches a JDK 21 toolchain and IntelliJ IDEA itself.

    chmod +x gradlew
    ./gradlew test buildPlugin verifyPluginStructure

`gradle.properties` sets the IDE it compiles against (`platformVersion`) and the oldest build it installs in (`sinceBuild`).

Word lists and live templates in `src/main/resources/{tine,liveTemplates}` are generated. After changing builtins, run `bun scripts/gen-jetbrains.ts` from the Tine source root and rebuild.

## Tests

`src/test`: lexer tests (token classes, every file in `examples/` lexes without gaps and restarts cleanly at any token) and platform tests (file type, commenting, brace pairing, live templates load and expand only in Tine files, run configuration naming).
