// SuperDirt output: OSC over UDP. Used by tine daw (for voices with .dirt())
// and by `tine dirt file.tine`, which plays every voice through SuperDirt with
// no browser, and picks up the file each time it is saved, at the next bar.
import { createSocket } from "node:dgram";
import { watch, readFileSync } from "node:fs";
import { Scene, liveNotes, formNotes, timeline, barSeconds, dirtPacket, DirtNote } from "../core";

export function dirtSender(target?: string) {
  const [host, portS] = (target ?? "127.0.0.1:57120").split(":");
  const port = parseInt(portS ?? "57120", 10) || 57120;
  let sock: ReturnType<typeof createSocket> | null = null;
  return {
    host, port,
    send(note: DirtNote, unixSeconds: number) {
      if (!sock) { sock = createSocket("udp4"); sock.on("error", () => {}); }
      sock.send(dirtPacket(note, unixSeconds), port, host || "127.0.0.1");
    },
    close() { sock?.close(); sock = null; },
  };
}

export async function dirtMode(file: string, scene: Scene, flags: Record<string, any>, reload: (f: string, flags: Record<string, any>) => Scene) {
  const out = dirtSender(flags.dirt as string | undefined);
  const LATENCY = 0.2, TICK = 50;
  let cur = scene, pending: Scene | null = null;
  // time is anchored at a bar: bar `anchorBar` sounds at `anchorTime` (Unix seconds)
  let anchorBar = 0, anchorTime = Date.now() / 1000 + LATENCY, barSec = barSeconds(cur);
  const timeAt = (bar: number) => anchorTime + (bar - anchorBar) * barSec;
  let scheduled = 0;
  const form = !!(cur.form && cur.form.length);
  const total = form ? timeline(cur).bars : Infinity;
  watch(file, () => {
    try { pending = reload(file, { ...flags, seed: String(cur.seed) }); console.log(`reloaded ${file}: plays from the next bar`); }
    catch { /* load() printed the error; keep playing the last good version */ }
  });
  console.log(`sending ${file} to SuperDirt at ${out.host}:${out.port} (seed ${cur.seed}). Save the file to change it; Ctrl+C to stop.`);
  await new Promise<void>(resolve => {
    const step = () => {
      const now = Date.now() / 1000;
      const horizon = anchorBar + (now + LATENCY + 0.1 - anchorTime) / barSec;
      while (scheduled < horizon && scheduled < total) {
        const next = Math.min(Math.floor(scheduled) + 1, scheduled + 0.25);
        if (pending && Number.isInteger(scheduled)) {
          // swap at the bar line, keeping time continuous through a tempo change
          anchorTime = timeAt(scheduled); anchorBar = scheduled; cur = pending; pending = null; barSec = barSeconds(cur);
        }
        const notes = form ? formNotes(cur, scheduled, next) : liveNotes(cur, scheduled, next);
        for (const n of notes) {
          if (n.params.midi !== undefined || n.params.ccOut !== undefined) continue;
          const t = form ? anchorTime + n.time - (anchorBar * barSec) : timeAt(n.bar);
          out.send(n, t);
        }
        scheduled = next;
      }
      if (scheduled >= total) { setTimeout(() => { out.close(); resolve(); }, (timeAt(total) - now) * 1000 + 500); return; }
      setTimeout(step, TICK);
    };
    step();
  });
}
