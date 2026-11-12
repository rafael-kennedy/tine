// Build the installable Tine app (a PWA) into dist/app/ from the pages that
// scripts/build-web.ts wrote to dist/. Serve dist/app/ over HTTPS from any
// static host; on a phone, "Add to Home Screen" installs it.
//
// What changes from the single-file pages:
// - fonts come from the app instead of Google, so it works offline
// - a manifest, icons and theme colour make it installable
// - a service worker caches the app on first visit, and the sample pack on first use
// - a home screen (index.html) links the DAW, Learn Tine and Tine Theory
import { mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { VERSION } from "../src/core";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const out = join(dist, "app");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "fonts"), { recursive: true });
mkdirSync(join(out, "icons"), { recursive: true });

const PAGES = [
  { file: "daw.html", name: "Studio", blurb: "Write and play live. The full workstation." },
  { file: "learn.html", name: "Learn Tine", blurb: "The language, one lesson at a time." },
  { file: "theory.html", name: "Tine Theory", blurb: "Music theory from zero to post-tonal, jazz first." },
];

// ---------- fonts ----------
const FONT_FILES = ["inter.woff2", "fraunces.woff2", "jetbrains-mono.woff2", "OFL-Inter.txt", "OFL-Fraunces.txt", "OFL-JetBrainsMono.txt"];
for (const f of FONT_FILES) copyFileSync(join(root, "assets/fonts", f), join(out, "fonts", f));
writeFileSync(join(out, "fonts/fonts.css"), [
  `@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url(inter.woff2) format("woff2")}`,
  `@font-face{font-family:Fraunces;font-style:normal;font-weight:100 900;font-display:swap;src:url(fraunces.woff2) format("woff2")}`,
  `@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:100 800;font-display:swap;src:url(jetbrains-mono.woff2) format("woff2")}`,
].join("\n") + "\n");

// ---------- icons and manifest ----------
const ICONS: [string, string][] = [["app-192.png", "icon-192.png"], ["app-512.png", "icon-512.png"], ["app-maskable-512.png", "maskable-512.png"], ["app-touch-180.png", "apple-touch-icon.png"]];
for (const [from, to] of ICONS) copyFileSync(join(root, "brand", from), join(out, "icons", to));
writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify({
  name: "Tine",
  short_name: "Tine",
  description: "A programming language for music. Live-codable, seeded, microtonal.",
  id: "./",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "any",
  background_color: "#14161c",
  theme_color: "#14161c",
  categories: ["music", "education", "developer"],
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: PAGES.map(p => ({ name: p.name, url: p.file })),
}, null, 2));

const HEAD = `<link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="fonts/fonts.css">` +
  `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png"><meta name="theme-color" content="#14161c">` +
  `<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">` +
  `<meta name="apple-mobile-web-app-status-bar-style" content="black"><meta name="apple-mobile-web-app-title" content="Tine">` +
  `<script>window.TINE_PWA=1</script>`;
const GOOGLE_FONTS = /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">.*?display=swap" rel="stylesheet">/;

// ---------- pages ----------
for (const p of PAGES) {
  const src = join(dist, p.file);
  if (!existsSync(src)) throw new Error(`${p.file} missing: run scripts/build-web.ts first`);
  let html = readFileSync(src, "utf8");
  if (!GOOGLE_FONTS.test(html)) throw new Error(`${p.file}: font link not found; update build-app.ts to match build-web.ts`);
  html = html.replace(GOOGLE_FONTS, HEAD);
  writeFileSync(join(out, p.file), html);
}
const samples = join(root, "assets/samples/tine-samples.tsb");
if (existsSync(samples)) copyFileSync(samples, join(out, "tine-samples.tsb"));
for (const f of ["CREDITS.md"]) { const s = join(root, "assets/samples", f); if (existsSync(s)) copyFileSync(s, join(out, f)); }

// ---------- home screen ----------
const LOGO = readFileSync(join(root, "brand/tine-mark.svg"), "utf8").replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace(/ width="\d+" height="\d+"/, "");
writeFileSync(join(out, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tine</title>
<meta name="description" content="Tine, a programming language for music.">${HEAD}
<link rel="icon" href="icons/icon-192.png">
<style>
:root{--ink:#14161c;--ink2:#1b1e26;--ink3:#232733;--line:#2e3340;--text:#e9e4d8;--mute:#9aa0ad;--brass:#d4a944;--teal:#3aa6a0;color-scheme:dark}
@media (prefers-color-scheme: light){:root{--ink:#f6f1e7;--ink2:#efe8da;--ink3:#e5dccb;--line:#d5cab4;--text:#22252c;--mute:#5f6470;--brass:#a87d12;--teal:#22807b;color-scheme:light}}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink);color:var(--text);font:16px/1.5 Inter,system-ui,-apple-system,sans-serif}
main{max-width:560px;margin:0 auto;padding:28px 16px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.brand svg{width:48px;height:48px}
h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:34px;margin:0}
.tag{color:var(--mute);margin:0 0 26px}
a.tile,label.tile{display:block;text-decoration:none;color:inherit;background:var(--ink2);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:0 0 12px;cursor:pointer}
a.tile:active,label.tile:active{border-color:var(--brass)}
.tile b{display:block;font-size:18px}
.tile span{color:var(--mute);font-size:14px}
.tile.main{border-color:var(--brass);background:linear-gradient(135deg,color-mix(in srgb,var(--brass) 14%,transparent),var(--ink2))}
input[type=file]{display:none}
.foot{color:var(--mute);font-size:13px;margin-top:24px}
.foot a{color:var(--teal)}
#install{display:none}
</style></head><body><main>
<div class="brand">${LOGO}<h1>tine</h1></div>
<p class="tag">A programming language for music.</p>
${PAGES.map((p, i) => `<a class="tile${i === 0 ? " main" : ""}" href="${p.file}"><b>${p.name}</b><span>${p.blurb}</span></a>`).join("\n")}
<label class="tile"><b>Open a .tine file</b><span>Load it into the Studio.</span><input type="file" id="open" accept=".tine,text/plain"></label>
<a class="tile" id="install" href="#"><b>Install Tine</b><span>Add it to your home screen. It works offline after the first visit.</span></a>
<p class="foot">Tine ${VERSION}. Sound starts after your first tap. <a href="CREDITS.md">Sample credits</a>.</p>
</main>
<script>
document.getElementById("open").addEventListener("change", async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  try { localStorage.setItem("tine.code", await f.text()); } catch (_) {}
  location.href = "daw.html";
});
let deferred = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; document.getElementById("install").style.display = "block"; });
document.getElementById("install").addEventListener("click", async e => { e.preventDefault(); if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; e.currentTarget.style.display = "none"; });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
</script></body></html>
`);

// ---------- service worker ----------
// The shell is cached on install. Everything else same-origin (the 10 MB
// sample pack, credits) is cached the first time it loads. Pages answer from
// the network when there is one, so a new release shows up on the next visit,
// and fall back to the cache offline.
const SHELL = ["./", "index.html", ...PAGES.map(p => p.file), "manifest.webmanifest", "fonts/fonts.css",
  ...FONT_FILES.filter(f => f.endsWith(".woff2")).map(f => `fonts/${f}`), ...ICONS.map(([, to]) => `icons/${to}`)];
writeFileSync(join(out, "sw.js"), `// generated by scripts/build-app.ts; do not edit
const CACHE = "tine-${VERSION}";
const SHELL = ${JSON.stringify(SHELL)};
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("tine-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
`);

console.log(`dist/app/  Tine ${VERSION}, ${PAGES.length} pages, offline-ready`);
