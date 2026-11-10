// The browser's sample library: one per page, shared by the engine, WAV
// export and the sound browser. The bundled CC0 library is the file
// tine-samples.tsb next to the page (tine serve and the published pages have
// it), or, in a packed player, just the sounds the piece uses, embedded.
import { SampleLibrary, SampleData, parseSampleMap, sampleMapUrl, bankOf, SoundFont, parseSf2, fontUrl } from "../core";

export const library = new SampleLibrary();
export let warn: (msg: string) => void = () => {};
export function onWarn(f: (msg: string) => void) { warn = f; }

let bundled: Promise<boolean> | null = null;
export function loadBundled(): Promise<boolean> {
  if (!bundled) bundled = (async () => {
    const el = typeof document !== "undefined" ? document.getElementById("tine-samples") : null;
    const b64 = el?.textContent?.trim();
    if (b64) { library.addPack(fromBase64(b64), { keep: true }); return true; }
    try {
      const r = await fetch("tine-samples.tsb");
      if (r.ok) { library.addPack(new Uint8Array(await r.arrayBuffer()), { keep: true }); return true; }
    } catch { /* try the text copy */ }
    // hosts that serve only known file types get the same pack as base64 text
    try {
      const r = await fetch("tine-samples.b64.txt");
      if (!r.ok) return false;
      library.addPack(fromBase64((await r.text()).trim()), { keep: true });
      return true;
    } catch { return false; }
  })();
  return bundled;
}

const fromBase64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// Any format the browser can play. An offline context needs no click to start.
export async function decodeBytes(b: Uint8Array): Promise<SampleData> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(b.slice().buffer);
  return { channels: Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c)), sr: buf.sampleRate };
}

const fetchBytes = async (url: string) => { const r = await fetch(url); if (!r.ok) throw new Error(`HTTP ${r.status}`); return new Uint8Array(await r.arrayBuffer()); };

// samples(...) lines. A URL or github: names a strudel.json map; anything else
// is a folder next to the piece, which only tine serve can read.
const sources = new Map<string, Promise<void>>();
export function loadSources(list: string[]): Promise<void>[] {
  return list.map(src => {
    let p = sources.get(src);
    if (!p) {
      p = (async () => {
        try {
          if (/^(https?|github):/.test(src)) {
            const url = sampleMapUrl(src);
            const entries = parseSampleMap(JSON.parse(new TextDecoder().decode(await fetchBytes(url))), url);
            library.addRemotePack(entries);
            warn(`samples("${src}"): ${entries.length} sounds in ${new Set(entries.map(e => e.bank)).size} banks, loaded on first use`);
          } else {
            const files: string[] = await (await fetch(`/api/samples?dir=${encodeURIComponent(src)}`)).json();
            library.addRemotePack(files.map(f => ({ name: nameOf(f), url: `/api/samples/${f.split("/").map(encodeURIComponent).join("/")}?dir=${encodeURIComponent(src)}`, bank: bankOfPath(f) ?? bankOf(nameOf(f)) })));
            warn(`samples("${src}"): ${files.length} sounds`);
          }
        } catch (e) { warn(`samples("${src}") could not be loaded: ${(e as Error).message}`); sources.delete(src); }
      })();
      sources.set(src, p);
    }
    return p;
  });
}

// "bd/kick.wav" is "bd/kick" in bank "bd"; "clap.wav" is "clap"
export const nameOf = (path: string) => path.replace(/\.[^./]+$/, "");
export const bankOfPath = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : undefined;

// Start fetching a remote sound; true if it is ready now.
const said = new Set<string>();
export function request(name: string): boolean {
  if (library.get(name)) return true;
  if (library.pendingUrl(name)) library.fetch(name, fetchBytes, decodeBytes).then(ok => { if (!ok) once(`could not load sample "${name}"`); });
  return false;
}
export function once(msg: string) { if (!said.has(msg)) { said.add(msg); warn(msg); } }

// Everything these notes need, for an export.
export async function ensure(notes: { params: Record<string, any> }[]) {
  await loadBundled();
  const want = new Set<string>();
  for (const n of notes) {
    const inst = String(n.params.inst ?? "");
    if (!inst.startsWith("sample:")) continue;
    const name = library.resolve(inst.slice(7), n.params.sampleN, n.params.drum);
    if (name && library.pendingUrl(name)) want.add(name);
  }
  await Promise.all([...want].map(name => library.fetch(name, fetchBytes, decodeBytes)));
}

// ---------- SoundFonts (see core/sf2.ts) ----------
// One at a time: the piece's first soundfont(...) line, or a .sf2 file dropped on the DAW.
export let soundfont: SoundFont | null = null;
let fontSrc = "";
export const fontPending = () => !!fontSrc && !soundfont;
let fontLoading: Promise<void> | null = null;
export function setSoundfont(sf: SoundFont, name: string) { soundfont = sf; fontSrc = name; library.version++; }
export function loadSoundfont(list: string[]): Promise<void> | null {
  const src = list[0];
  if (!src || src === fontSrc) return fontLoading;
  fontSrc = src;
  fontLoading = (async () => {
    try {
      const url = /^(https?|github):/.test(src) ? fontUrl(src) : `/api/samples/${src.split("/").map(encodeURIComponent).join("/")}?dir=.`;
      warn(`loading SoundFont ${src}…`);
      const sf = parseSf2(await fetchBytes(url));
      setSoundfont(sf, src);
      warn(`SoundFont ${sf.name || src}: ${sf.presets.length} presets`);
    } catch (e) { warn(`soundfont("${src}") could not be loaded: ${(e as Error).message}`); fontSrc = ""; }
  })();
  return fontLoading;
}
