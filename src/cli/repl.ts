import * as readline from "node:readline";
import { readFileSync, writeFileSync } from "node:fs";
import {
  Interp, Pat, Builtin, Closure, liveNotes, renderNotes, formatError, show, typeName, randomSeed, makeCtx, resolveNotes,
  builtinList, TimedNote, VERSION, R, hashStr, parse, toPat, toMidiFile, Pitch, Degree, Chord,
} from "../core";
import { roll, color } from "./roll";
import { playWav, renderToWav } from "./audio";

const HELP = `
  Type Tine code and press Enter. Lines ending inside brackets or before an
  indented block continue automatically; finish a block with an empty line.

  :play [bars]         render the current voices and play them (default 4 bars)
  :roll <expr> [bars]  draw a pattern as a piano roll (patterns draw anyway)
  :voices              list voices
  :seed [n]            show or set the seed (every run is replayable from it)
  :reroll              pick a new random seed
  :doc <name>          documentation for a builtin
  :render <file.wav>   render to audio      :midi <file.mid>   export MIDI
  :save <file.tine>    save this session as a file (with its seed)
  :load <file.tine>    run a file into the session
  :reset               forget everything     :quit              leave
`;

export async function repl(preload?: string) {
  const tty = process.stdout.isTTY ?? false;
  const c = color(tty);
  let seed = randomSeed();
  let interp = new Interp({ seed, keepGoing: false, readFile: p => readFileSync(p, "utf8") });
  const history: string[] = [];

  const out = (s: string) => process.stdout.write(s + "\n");
  out(`${c.brass}${c.bold}tine${c.reset} ${VERSION}  ${c.dim}a language for music. :help for commands, :quit to leave${c.reset}`);
  out(`${c.dim}seed ${seed}${c.reset}`);

  const runSrc = (src: string, record = true) => {
    interp.scene.prints.length = 0;
    try {
      const before = new Set(interp.scene.voices.keys());
      interp.src = src;
      const prog = parse(src);
      let last: any = undefined, lastWasExpr = false;
      for (const st of prog.stmts) {
        last = interp.stmt(st, interp.env);
        lastWasExpr = st.t === "expr";
        if (st.t === "directive" && st.name === "seed") seed = interp.scene.seed;
        if (st.t === "voice") {
          const v = interp.scene.voices.get(st.name)!;
          const ns = liveNotes(interp.scene, 0, 1).filter(n => n.voice === st.name);
          out(`${c.dim}voice ${st.name}${before.has(st.name) ? " (updated)" : ""}: ${ns.length} note${ns.length === 1 ? "" : "s"} in bar 1${c.reset}`);
        }
      }
      for (const p of interp.scene.prints) out(p);
      if (record) history.push(src);
      if (lastWasExpr && last !== null && last !== undefined) display(last);
    } catch (e) {
      out(`${c.red}${formatError(src, interp.wrap(e, { start: 0, end: src.length }), "repl")}${c.reset}`);
    }
  };

  const display = (v: any, bars = 1) => {
    if (v instanceof Pat || v instanceof Chord || v instanceof Pitch || v instanceof Degree) {
      const pat = toPat(v);
      const ctx = makeCtx(interp.scene.seed, hashStr("repl"), interp.scene.key);
      const ns = resolveNotes("repl", pat.query(new R(0), new R(bars), ctx), ctx);
      const timed: TimedNote[] = ns.map(n => ({ voice: "repl", bar: n.start.toNumber(), bars: n.dur.toNumber(), time: 0, durSec: 0, semi: n.semi, vel: n.vel, params: n.params }));
      if (!(v instanceof Pat) || pat.items) out(`${c.dim}${show(v)}  (${typeName(v)})${c.reset}`);
      if (pat.sig) { out(`${c.dim}signal: ${Array.from({ length: 8 }, (_, i) => Number(pat.sig!(i / 8, ctx)).toFixed(2)).join(" ")}${c.reset}`); return; }
      out(roll(timed, bars, tty));
      return;
    }
    if (v instanceof Builtin) { out(`${c.teal}${v.sig}${c.reset}  ${v.doc}`); return; }
    out(`${show(v)}  ${c.dim}(${typeName(v)})${c.reset}`);
  };

  const command = async (line: string) => {
    const [cmd, ...rest] = line.slice(1).trim().split(/\s+/);
    const arg = rest.join(" ");
    switch (cmd) {
      case "help": case "h": case "?": out(HELP); break;
      case "quit": case "q": case "exit": process.exit(0);
      case "seed":
        if (arg) { seed = parseInt(arg, 10); interp.scene.seed = seed; interp.scene.seedExplicit = true; }
        out(`seed ${interp.scene.seed}`); break;
      case "reroll": seed = randomSeed(); interp.scene.seed = seed; out(`seed ${seed}`); break;
      case "voices":
        if (!interp.scene.voices.size) out(`${c.dim}no voices yet. try: voice beat = [kick . snare .]${c.reset}`);
        for (const [k, v] of interp.scene.voices) out(`${c.teal}${k}${c.reset} ${c.dim}${interp.src && v.span ? "" : ""}${c.reset}`);
        break;
      case "doc": {
        const b = builtinList().find(x => x.name === arg);
        out(b ? `${c.teal}${b.sig}${c.reset}\n  ${b.doc}` : `no builtin named '${arg}'`);
        break;
      }
      case "roll": {
        const m = arg.match(/^(.*?)(?:\s+(\d+))?$/)!;
        try { const v = evalExpr(m[1]); display(v, m[2] ? parseInt(m[2], 10) : 1); }
        catch (e) { out(`${c.red}${formatError(m[1], interp.wrap(e, { start: 0, end: m[1].length }))}${c.reset}`); }
        break;
      }
      case "play": {
        const bars = arg ? parseInt(arg, 10) : 4;
        if (!interp.scene.voices.size && !interp.scene.form) { out(`${c.dim}nothing to play yet: define a voice first${c.reset}`); break; }
        const { wav, seconds } = renderToWav(interp.scene, interp.scene.form ? undefined : bars);
        out(`${c.dim}playing ${seconds.toFixed(1)}s (seed ${interp.scene.seed})...${c.reset}`);
        const ok = await playWav(wav);
        if (!ok) out(`${c.dim}no audio player found; use :render file.wav instead${c.reset}`);
        break;
      }
      case "render": {
        const file = arg || "tine-session.wav";
        const { wav, seconds } = renderToWav(interp.scene, interp.scene.form ? undefined : 8);
        writeFileSync(file, wav); out(`wrote ${file} (${seconds.toFixed(1)}s)`); break;
      }
      case "midi": {
        const file = arg || "tine-session.mid";
        const { notes } = renderNotes(interp.scene, interp.scene.form ? undefined : 8);
        writeFileSync(file, toMidiFile(interp.scene, notes)); out(`wrote ${file}`); break;
      }
      case "save": {
        const file = arg || "session.tine";
        const body = history.filter(h => !/^\s*seed\s/.test(h)).join("\n");
        writeFileSync(file, `-- saved from the tine repl\nseed ${interp.scene.seed}\n${body}\n`);
        out(`wrote ${file}`); break;
      }
      case "load": {
        try { runSrc(readFileSync(arg, "utf8")); } catch (e) { out(`${c.red}${(e as Error).message}${c.reset}`); }
        break;
      }
      case "reset": interp = new Interp({ seed, readFile: p => readFileSync(p, "utf8") }); history.length = 0; out("reset"); break;
      default: out(`unknown command :${cmd}. :help lists commands`);
    }
  };

  const evalExpr = (src: string) => {
    const prog = parse(src);
    const st = prog.stmts[0];
    if (!st || st.t !== "expr") throw new Error("expected an expression");
    return interp.eval(st.e, interp.env);
  };

  if (preload) runSrc(readFileSync(preload, "utf8"));

  const completions = () => [...interp.env.names(), ":help", ":play", ":roll", ":voices", ":seed", ":reroll", ":doc", ":render", ":midi", ":save", ":load", ":reset", ":quit"];
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, terminal: tty,
    prompt: `${c.brass}♪ ${c.reset}`,
    completer: (line: string) => {
      const m = line.match(/[:A-Za-z_][A-Za-z0-9_]*$/); const w = m ? m[0] : "";
      const hits = completions().filter(x => x.startsWith(w));
      return [hits, w];
    },
  });
  let buffer: string[] = [];
  const needsMore = (src: string) => {
    let d = 0, inStr = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (ch === '"' && src[i - 1] !== "\\") inStr = !inStr;
      if (inStr) continue;
      if (ch === "-" && src[i + 1] === "-") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if ("([{".includes(ch)) d++; else if (")]}".includes(ch)) d--;
    }
    if (d > 0) return true;
    const lines = src.split("\n");
    const last = lines[lines.length - 1];
    if (/=\s*$/.test(last) || /^\s*section\b/.test(last)) return true;
    if (lines.length > 1 && /^\s+\S/.test(last)) return true; // inside an indented block
    return false;
  };
  rl.prompt();
  let queue = Promise.resolve();
  rl.on("line", (line) => {
    queue = queue.then(async () => {
      if (!buffer.length && line.trim().startsWith(":")) { await command(line.trim()); rl.prompt(); return; }
      if (buffer.length && line.trim() === "") { const src = buffer.join("\n"); buffer = []; runSrc(src); rl.setPrompt(`${c.brass}♪ ${c.reset}`); rl.prompt(); return; }
      buffer.push(line);
      const src = buffer.join("\n");
      if (needsMore(src)) { rl.setPrompt(`${c.dim}… ${c.reset}`); rl.prompt(); return; }
      buffer = []; runSrc(src); rl.setPrompt(`${c.brass}♪ ${c.reset}`); rl.prompt();
    });
  });
  rl.on("close", () => { queue.then(() => process.exit(0)); });
}
