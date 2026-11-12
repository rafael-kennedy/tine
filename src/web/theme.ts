// Shared look for the DAW, the tutorial and the player.
export const LOGO_SVG = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M23 8v20a9 9 0 0 0 18 0V8" stroke="var(--brass)" stroke-width="5.5"/><path d="M32 37v20" stroke="var(--brass)" stroke-width="5.5"/><path d="M13 14a22 22 0 0 0 0 22M50 14a22 22 0 0 1 0 22" stroke="var(--teal)" stroke-width="3" opacity=".85"/><path d="M7 10a30 30 0 0 0 0 30M56 10a30 30 0 0 1 0 30" stroke="var(--teal)" stroke-width="2.4" opacity=".45"/></g></svg>`;

export const VOICE_COLORS = ["#d4a944", "#3aa6a0", "#e0785f", "#8f9be8", "#9bc46a", "#d17fb6", "#5fb3e0", "#e3c06b", "#7fd1b9", "#c98f5a"];

export const CSS = `
:root{
  --ink:#14161c; --ink2:#1b1e26; --ink3:#232733; --line:#2e3340; --text:#e9e4d8; --mute:#9aa0ad; --faint:#666c79;
  --brass:#d4a944; --brass2:#f0cf7a; --teal:#3aa6a0; --coral:#e0604f; --ok:#7fbf6a;
  --c-comment:#6f7686; --c-keyword:#e0785f; --c-note:#f0cf7a; --c-number:#8fc9e8; --c-string:#9bc46a; --c-fn:#7fd1c9;
  --c-drum:#d17fb6; --c-type:#c9a6f0; --c-rest:#666c79; --c-op:#e0b07a; --c-bracket:#9aa0ad;
  --radius:10px; --mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; --serif:Fraunces,Georgia,serif;
  color-scheme: dark;
}
@media (prefers-color-scheme: light){ :root:not([data-theme="dark"]){
  --ink:#f6f1e7; --ink2:#efe8da; --ink3:#e5dccb; --line:#d5cab4; --text:#22252c; --mute:#5f6470; --faint:#8b8f99;
  --brass:#a87d12; --brass2:#8a6608; --teal:#22807b; --coral:#c2412f;
  --c-comment:#8b8f99; --c-keyword:#c2412f; --c-note:#9a6a00; --c-number:#1f6f9a; --c-string:#4c7a1f; --c-fn:#1f7a72;
  --c-drum:#a3427f; --c-type:#6c46a8; --c-rest:#a3a7b0; --c-op:#9a5b1f; --c-bracket:#5f6470; color-scheme: light;
}}
:root[data-theme="light"]{
  --ink:#f6f1e7; --ink2:#efe8da; --ink3:#e5dccb; --line:#d5cab4; --text:#22252c; --mute:#5f6470; --faint:#8b8f99;
  --brass:#a87d12; --brass2:#8a6608; --teal:#22807b; --coral:#c2412f;
  --c-comment:#8b8f99; --c-keyword:#c2412f; --c-note:#9a6a00; --c-number:#1f6f9a; --c-string:#4c7a1f; --c-fn:#1f7a72;
  --c-drum:#a3427f; --c-type:#6c46a8; --c-rest:#a3a7b0; --c-op:#9a5b1f; --c-bracket:#5f6470; color-scheme: light;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--text);font-family:var(--sans);font-size:15px;line-height:1.5}
button{font:inherit;color:inherit;background:var(--ink3);border:1px solid var(--line);border-radius:8px;padding:6px 12px;cursor:pointer}
button:hover{border-color:var(--brass)}
button.primary{background:var(--brass);color:#14161c;border-color:var(--brass);font-weight:600}
button.on{background:var(--teal);color:#0d1414;border-color:var(--teal)}
button.small,select.small{padding:2px 8px;font-size:12px}
select,input{font:inherit;color:inherit;background:var(--ink3);border:1px solid var(--line);border-radius:8px;padding:5px 8px}
a{color:var(--teal)}
code,kbd{font-family:var(--mono);font-size:.9em}
code{background:var(--ink3);padding:1px 5px;border-radius:5px}
kbd{border:1px solid var(--line);border-bottom-width:2px;padding:0 5px;border-radius:5px;background:var(--ink2)}
.logo{display:inline-flex;align-items:center;gap:8px;font-family:var(--serif);font-weight:600;font-size:22px;letter-spacing:.01em;color:var(--text);text-decoration:none}
.logo svg{width:30px;height:30px}
.cm-editor{background:var(--ink2);border-radius:var(--radius);font-family:var(--mono);font-size:14px;height:100%}
.cm-editor.cm-focused{outline:1px solid var(--brass)}
.cm-gutters{background:transparent!important;border:none!important;color:var(--faint)!important}
.cm-activeLine{background:color-mix(in srgb,var(--brass) 6%,transparent)}
.cm-activeLineGutter{background:transparent!important;color:var(--brass)!important}
.cm-content{caret-color:var(--brass)}
.cm-cursor{border-left-color:var(--brass)!important;border-left-width:2px!important}
.cm-selectionBackground,.cm-focused .cm-selectionBackground{background:color-mix(in srgb,var(--teal) 30%,transparent)!important}
/* tooltip colors live in editor.ts (tooltipTheme): CodeMirror's own scoped rules outrank plain selectors here */
.tine-tip{white-space:pre-wrap;font-family:var(--mono);font-size:12.5px;padding:6px 9px;max-width:420px}
.tine-error{text-decoration:underline wavy var(--coral);text-underline-offset:3px;background:color-mix(in srgb,var(--coral) 15%,transparent)}
.tine-flash{background:color-mix(in srgb,var(--brass) 30%,transparent);transition:background .2s}
.err{color:var(--coral);font-family:var(--mono);font-size:13px;white-space:pre-wrap}
.dim{color:var(--mute)}
`;
