// Build the bundled sample library (assets/samples/tine-samples.tsb) from a
// folder of CC0 sounds. The source is the Sonic Pi sample folder
// (github.com/sonic-pi-net/sonic-pi, etc/samples), all CC0; see
// assets/samples/CREDITS.md. Needs ffmpeg, at build time only.
//   bun scripts/build-samples.ts path/to/etc/samples
import { spawnSync } from "node:child_process";
import { readdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { encodePack, bankOf } from "../src/core/samples";

const dir = process.argv[2];
if (!dir) { console.error("usage: bun scripts/build-samples.ts <folder of sounds>"); process.exit(2); }
const out = join(import.meta.dir, "../assets/samples");
const files = readdirSync(dir).filter(f => /\.(flac|wav|ogg|aiff?)$/i.test(f)).sort();
const sounds = [];
for (const f of files) {
  // mono, 44.1 kHz, 32-bit float
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", join(dir, f), "-ac", "1", "-ar", "44100", "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(`skipped ${f}: ${r.stderr}`); continue; }
  const buf = r.stdout as Buffer;
  const data = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  // trim trailing silence below -70 dB
  let end = data.length;
  while (end > 1 && Math.abs(data[end - 1]) < 3e-4) end--;
  const name = basename(f, extname(f));
  sounds.push({ name, bank: bankOf(name), data: { channels: [data.slice(0, end)], sr: 44100 } });
}
const pack = encodePack(sounds);
writeFileSync(join(out, "tine-samples.tsb"), pack);
const readme = join(dir, "README.md");
try { writeFileSync(join(out, "CREDITS.md"), `# Bundled samples\n\nTine's bundled sounds are the Sonic Pi sample set (https://github.com/sonic-pi-net/sonic-pi, etc/samples), converted to mono 44.1 kHz IMA ADPCM. All are CC0 (public domain). Sonic Pi's credits follow.\n\n` + readFileSync(readme, "utf8").replace(/^# Samples\n/, "")); } catch { /* no readme */ }
const secs = sounds.reduce((s, x) => s + x.data.channels[0].length / 44100, 0);
console.log(`wrote ${sounds.length} sounds, ${secs.toFixed(0)} s, ${(pack.length / 1e6).toFixed(1)} MB`);
