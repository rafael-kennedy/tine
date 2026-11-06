#!/usr/bin/env bun
// tine: the command-line front door. One binary holds the REPL, the
// renderer, MIDI export, the DAW and tutorial servers, the packager and the
// language server, so a performer installs exactly one thing.
import { readFileSync, writeFileSync, existsSync, watch, statSync } from "node:fs";
import { resolve, dirname, basename, extname, join } from "node:path";
import { evaluate, formatError, renderNotes, toMidiFile, toMusicXml, randomSeed, VERSION, timeline, pitchName, keySpelling, Scene, TineError, lineCol } from "../core";
import { repl } from "./repl";
import { renderToWav, playWav, openBrowser, loadSamples } from "./audio";
import { roll } from "./roll";
import * as assets from "./assets.gen";

const tty = process.stdout.isTTY ?? false;
const red = (s: string) => (tty ? `\x1b[31m${s}\x1b[0m` : s);
const dim = (s: string) => (tty ? `\x1b[2m${s}\x1b[0m` : s);
const yellow = (s: string) => (tty ? `\x1b[33m${s}\x1b[0m` : s);

const USAGE = `tine ${VERSION}: a programming language for music

usage:
  tine                         start the interactive REPL
  tine repl [file]             REPL, optionally starting from a file
  tine play <file>             render and play through your speakers
  tine render <file> [-o out.wav]   render to a WAV file
  tine midi <file> [-o out.mid]     export a Standard MIDI File
  tine xml <file> [-o out.musicxml] export a score for MuseScore, Dorico, Sibelius
  tine check <file>            report problems (exit code 1 if any)
  tine roll <file> [--bars N]  draw the piece as a piano roll in the terminal
  tine daw [file]              open the live-coding DAW in your browser
  tine learn                   open the interactive tutorial
  tine theory                  open the music theory course
  tine pack <file> [-o out.html]
                               package a piece as a single-file HTML player
  tine pack <file> --exe [--runtime tine-windows-x64.exe] [-o name]
                               package a piece as a standalone executable
  tine new <name>              start a new piece from a template
  tine lsp                     run the language server (for editors)

options:
  --seed N     override the seed for this run (files with 'seed' keep theirs)
  --bars N     how many bars to render when a file has no 'form'
  --port N     port for daw/learn/theory (default 7357)
  --samples D  folder of .wav files usable as sample("name")
`;

function args() {
  const a = process.argv.slice(2);
  const flags: Record<string, string | boolean> = {};
  const pos: string[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) { const k = a[i].slice(2); const nxt = a[i + 1]; if (nxt !== undefined && !nxt.startsWith("-") && !["exe", "help", "version", "no-open"].includes(k)) { flags[k] = nxt; i++; } else flags[k] = true; }
    else if (a[i] === "-o") { flags.o = a[++i]; }
    else if (a[i] === "-h") flags.help = true;
    else pos.push(a[i]);
  }
  return { cmd: pos[0], pos: pos.slice(1), flags };
}

let loaded: { src: string; file: string } | null = null; // for errors raised while the music plays

function load(file: string, flags: Record<string, any>): { scene: Scene; src: string } {
  if (!file) { console.error("missing file argument"); process.exit(2); }
  if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }
  const src = readFileSync(file, "utf8");
  loaded = { src, file };
  const seed = flags.seed !== undefined ? parseInt(flags.seed, 10) : randomSeed();
  try {
    const scene = evaluate(src, { seed, readFile: p => readFileSync(resolve(dirname(file), p), "utf8") });
    return { scene, src };
  } catch (e) {
    console.error(red(formatError(src, e, file)));
    process.exit(1);
  }
}

function outName(file: string, ext: string, flags: Record<string, any>) {
  return (flags.o as string) ?? join(dirname(file), basename(file, extname(file)) + ext);
}

async function main() {
  const { cmd, pos, flags } = args();
  if (flags.version || cmd === "version") { console.log(`tine ${VERSION}`); return; }
  if (flags.help || cmd === "help") { console.log(USAGE); return; }
  const bars = flags.bars !== undefined ? parseInt(flags.bars as string, 10) : undefined;
  switch (cmd) {
    case undefined: case "repl": await repl(pos[0]); return;
    case "check": {
      const file = pos[0];
      const src = readFileSync(file, "utf8");
      const scene = (() => { try { return evaluate(src, { seed: 1, keepGoing: true, readFile: p => readFileSync(resolve(dirname(file), p), "utf8") }); } catch (e) { console.error(red(formatError(src, e, file))); process.exit(1); } })();
      for (const e of scene.errors) console.error(red(formatError(src, e, file)));
      if (scene.errors.length) process.exit(1);
      // query a few bars so runtime errors inside patterns surface too
      const inexact = new Map<string, number>();
      try { renderNotes(scene, bars ?? 4, { onInexact: (v, k) => inexact.set(v, (inexact.get(v) ?? 0) + k) }); } catch (e) { console.error(red(formatError(src, e, file))); process.exit(1); }
      for (const v of inexact.keys()) console.error(yellow(`warning: voice ${v}: its timing needs fractions too large to keep exact, so some times are rounded (by at most a millionth of a bar). It plays, but a note can miss a bar line by that much. Simpler ratios keep it exact.`));
      console.log(`${file}: ok (${scene.voices.size} voice${scene.voices.size === 1 ? "" : "s"}, ${scene.sections.size} section${scene.sections.size === 1 ? "" : "s"})`);
      return;
    }
    case "render": {
      const { scene } = load(pos[0], flags);
      const sr = flags.sr ? parseInt(flags.sr as string, 10) : 44100;
      const { wav, seconds, notes } = renderToWav(scene, bars, sr, loadSamples(flags.samples as string));
      const out = outName(pos[0], ".wav", flags);
      writeFileSync(out, wav);
      console.log(`wrote ${out}: ${seconds.toFixed(1)}s, ${notes.length} notes, seed ${scene.seed}${scene.seedExplicit ? "" : dim("  (add 'seed " + scene.seed + "' to the file to keep this take)")}`);
      return;
    }
    case "midi": {
      const { scene } = load(pos[0], flags);
      const { notes } = renderNotes(scene, bars);
      const out = outName(pos[0], ".mid", flags);
      writeFileSync(out, toMidiFile(scene, notes));
      console.log(`wrote ${out}: ${notes.length} notes on ${new Set(notes.map(n => n.voice)).size} tracks, seed ${scene.seed}`);
      return;
    }
    case "xml": {
      const { scene } = load(pos[0], flags);
      const r = renderNotes(scene, bars);
      const out = outName(pos[0], ".musicxml", flags);
      writeFileSync(out, toMusicXml(scene, r.notes, Math.ceil(r.bars), basename(pos[0] ?? "piece", ".tine")));
      console.log(`wrote ${out}: ${Math.ceil(r.bars)} bars, ${new Set(r.notes.filter(n => n.params.ccOut === undefined).map(n => n.voice)).size} parts, seed ${scene.seed}`);
      return;
    }
    case "play": {
      const { scene } = load(pos[0], flags);
      const { wav, seconds } = renderToWav(scene, bars, 44100, loadSamples(flags.samples as string));
      console.log(`playing ${pos[0]} (${seconds.toFixed(1)}s, seed ${scene.seed})`);
      if (!(await playWav(wav))) { console.error("no audio player found (afplay, paplay, aplay, pw-play or ffplay). Try 'tine render' or 'tine daw'."); process.exit(1); }
      return;
    }
    case "roll": {
      const { scene } = load(pos[0], flags);
      const b = bars ?? (scene.form ? Math.min(timeline(scene).bars, 4) : 2);
      const { notes } = renderNotes(scene, b);
      const voices = [...new Set(notes.map(n => n.voice))];
      for (const v of voices) { console.log(`\n${tty ? "\x1b[1m" : ""}${v}${tty ? "\x1b[0m" : ""}`); console.log(roll(notes.filter(n => n.voice === v), b, tty, 96, keySpelling(scene.key))); }
      console.log(dim(`\nseed ${scene.seed}`));
      return;
    }
    case "daw": case "learn": case "theory": { await serve(cmd, pos[0], flags); return; }
    case "pack": { await pack(pos[0], flags); return; }
    case "new": {
      const name = pos[0] ?? "untitled";
      const file = name.endsWith(".tine") ? name : `${name}.tine`;
      if (existsSync(file)) { console.error(`${file} already exists`); process.exit(1); }
      writeFileSync(file, template(randomSeed()));
      console.log(`created ${file}. try: tine daw ${file}`);
      return;
    }
    case "lsp": { const { startServer } = await import("../lsp/server"); startServer(); return; }
    default:
      if (cmd && existsSync(cmd) && cmd.endsWith(".tine")) { process.argv.splice(2, 0, "play"); return main(); }
      console.error(`unknown command '${cmd}'\n`); console.log(USAGE); process.exit(2);
  }
}

function template(seed: number) {
  return `-- a new piece
tempo 96
key d dorian
seed ${seed}

voice drums = {[kick . . kick . . snare .] [hat*8].vel([.9 .5])}
voice bass  = [^1 . ^1 ^5 . ^4 _ .].octave(-2).inst(bass)
voice keys  = <^1@7 ^4@7 ^5@7 ^1@7>.strum.vel(.6)
voice tune  = [^5 ^3|^4 . ^1 ^2 _ ^3 .].every(4, rev).inst(pluck)
`;
}

async function serve(kind: "daw" | "learn" | "theory", file: string | undefined, flags: Record<string, any>) {
  const port = flags.port ? parseInt(flags.port, 10) : 7357;
  const path = file ? resolve(file) : undefined;
  if (path && !existsSync(path)) writeFileSync(path, template(randomSeed()));
  const sampleDir = (flags.samples as string) ?? (path ? join(dirname(path), "samples") : undefined);
  const listeners = new Set<ReadableStreamDefaultController>();
  let lastWrite = 0;
  if (path) {
    watch(path, () => {
      if (Date.now() - lastWrite < 400) return; // our own save
      const content = readFileSync(path, "utf8");
      for (const l of listeners) { try { l.enqueue(`data: ${JSON.stringify({ content })}\n\n`); } catch { listeners.delete(l); } }
    });
  }
  const server = Bun.serve({
    port, hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/" || url.pathname === "/index.html") return new Response(kind === "learn" ? assets.LEARN_HTML : kind === "theory" ? assets.THEORY_HTML : assets.DAW_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/learn") return new Response(assets.LEARN_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/theory") return new Response(assets.THEORY_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/daw") return new Response(assets.DAW_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
      if (url.pathname === "/api/file") {
        if (!path) return Response.json({ path: null, content: null });
        if (req.method === "POST") { const body = await req.text(); lastWrite = Date.now(); writeFileSync(path, body); return Response.json({ ok: true }); }
        return Response.json({ path, name: basename(path), content: readFileSync(path, "utf8") });
      }
      if (url.pathname === "/api/watch") {
        let ctl: ReadableStreamDefaultController;
        const stream = new ReadableStream({ start(c) { ctl = c; listeners.add(c); c.enqueue(": hi\n\n"); }, cancel() { listeners.delete(ctl); } });
        return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
      }
      if (url.pathname === "/api/samples") {
        const { readdirSync } = await import("node:fs");
        const list = sampleDir && existsSync(sampleDir) ? readdirSync(sampleDir).filter(f => /\.(wav|mp3|ogg|flac|aif|aiff)$/i.test(f)) : [];
        return Response.json(list);
      }
      if (url.pathname.startsWith("/api/samples/") && sampleDir) {
        const f = join(sampleDir, basename(decodeURIComponent(url.pathname.slice(13))));
        if (existsSync(f) && statSync(f).isFile()) return new Response(Bun.file(f));
      }
      return new Response("not found", { status: 404 });
    },
  });
  const url = `http://127.0.0.1:${server.port}/`;
  console.log(`${kind === "daw" ? "Tine DAW" : "Learn Tine"} running at ${url}${path ? `  (editing ${path})` : ""}`);
  console.log(dim("Web MIDI works in Chrome, Edge and Opera, and in Firefox after a permission prompt. Ctrl+C to stop."));
  if (!flags["no-open"]) openBrowser(url);
  await new Promise(() => {});
}

async function pack(file: string, flags: Record<string, any>) {
  const { scene, src } = load(file, { ...flags, seed: flags.seed ?? undefined });
  // The packaged piece is frozen to the seed it was packed with.
  const frozen = scene.seedExplicit ? src : `seed ${scene.seed}\n${src}`;
  const title = basename(file, extname(file));
  if (flags.exe) {
    const out = (flags.o as string) ?? title + (process.platform === "win32" ? ".exe" : "");
    // the runtime is this executable, or another platform's tine binary via --runtime
    const runtime = (flags.runtime as string) ?? process.execPath;
    if (!flags.runtime && /\bbun(\.exe)?$/.test(process.execPath)) { console.error("pack --exe needs a compiled tine binary: run it from one, or pass --runtime path/to/tine-<platform>"); process.exit(2); }
    const self = readFileSync(runtime);
    const payload = Buffer.from(JSON.stringify({ title, src: frozen }), "utf8");
    const marker = Buffer.from("\n#TINE-PIECE#");
    const len = Buffer.alloc(8); len.writeBigUInt64LE(BigInt(payload.length));
    writeFileSync(out, Buffer.concat([self, marker, payload, len, Buffer.from("TINEPACK")]), { mode: 0o755 });
    if (process.platform === "darwin") {
      // appending data invalidates the macOS signature; re-sign ad hoc so it runs
      const { spawnSync } = await import("node:child_process");
      spawnSync("codesign", ["--remove-signature", out]); spawnSync("codesign", ["-s", "-", out]);
    }
    console.log(`wrote ${out}: a standalone executable that plays '${title}' (seed ${scene.seed}). Run it with no arguments, or with 'render', 'midi' or 'xml'.`);
    return;
  }
  const out = outName(file, ".html", flags);
  const html = assets.PLAYER_HTML
    .replace("<title>Tine Player</title>", `<title>${escapeHtml(title)}</title>`)
    .replace('<script type="text/tine" id="piece"></script>', `<script type="text/tine" id="piece" data-title="${escapeHtml(title)}">${frozen.replace(/<\//g, "<\\/")}</script>`);
  writeFileSync(out, html);
  console.log(`wrote ${out}: a single-file player that runs in any modern browser, offline (seed ${scene.seed}).`);
}

function escapeHtml(s: string) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]); }

// A packed executable carries its piece after the binary itself.
function embeddedPiece(): { title: string; src: string } | null {
  try {
    const exe = process.execPath;
    if (/\bbun(\.exe)?$/.test(exe)) return null;
    const fd = require("node:fs").openSync(exe, "r");
    const size = require("node:fs").fstatSync(fd).size;
    const tail = Buffer.alloc(16);
    require("node:fs").readSync(fd, tail, 0, 16, size - 16);
    if (tail.subarray(8).toString() !== "TINEPACK") return null;
    const len = Number(tail.readBigUInt64LE(0));
    const buf = Buffer.alloc(len);
    require("node:fs").readSync(fd, buf, 0, len, size - 16 - len);
    return JSON.parse(buf.toString("utf8"));
  } catch { return null; }
}

const piece = embeddedPiece();
if (piece) {
  const { mkdtempSync } = require("node:fs"); const { tmpdir } = require("node:os");
  const tmp = join(mkdtempSync(join(tmpdir(), "tine-piece-")), `${piece.title}.tine`);
  writeFileSync(tmp, piece.src);
  const sub = process.argv[2];
  if (sub === "render" || sub === "midi" || sub === "xml" || sub === "roll" || sub === "daw") {
    process.argv.splice(3, 0, tmp);
    if ((sub === "render" || sub === "midi" || sub === "xml") && !process.argv.includes("-o")) process.argv.push("-o", `${piece.title}.${sub === "render" ? "wav" : sub === "xml" ? "musicxml" : "mid"}`);
  }
  else { console.log(`${piece.title}  ${dim("(a piece made with Tine; try 'render', 'midi', 'xml' or 'daw' as an argument)")}`); process.argv.splice(2, process.argv.length, "play", tmp); }
}
main().catch(e => {
  // a pattern can fail only when it is queried (render, midi, xml, roll): show it like any other error
  if (e instanceof TineError && loaded) { console.error(red(formatError(loaded.src, e, loaded.file))); process.exit(1); }
  console.error(red(`tine: ${e instanceof Error ? e.message : String(e)}`));
  process.exit(1);
});
