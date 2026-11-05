# Editor support

Every editor gets the same language server: `tine lsp` (stdio). It provides diagnostics (including errors that would only happen while playing), completion, hover docs, signature help, go to definition, document outline, formatting and semantic highlighting.

| Editor | What to use |
| --- | --- |
| VS Code, Cursor, VSCodium | install `vscode/tine-1.0.0.vsix` (Extensions view, "Install from VSIX"). The server is bundled; no install of tine needed for editing. |
| Neovim | `neovim/tine.lua` plus `vim/` on the runtimepath |
| Vim | copy `vim/` into `~/.vim` (highlighting, comments, indentation). Use any LSP plugin with `tine lsp`. |
| Helix | append `helix/languages.toml` to your languages config |
| Emacs | `emacs/tine-mode.el`; eglot connects to `tine lsp` automatically |
| Sublime Text, JetBrains IDEs, TextMate | import `textmate/tine.tmLanguage.json` (JetBrains: Settings, Editor, TextMate Bundles). For LSP, JetBrains' LSP support or the Sublime LSP package with command `tine lsp`. |
| Zed | add a language server entry with command `tine` and args `["lsp"]` |

For live performance from any editor, run `tine daw yourfile.tine`. The DAW reloads the file every time you save it, and new code lands on the next bar.
