import { evaluate, renderNotes, pitchName, formatError } from "../src/core";

const src = `
tempo 100
key d dorian
seed 7

voice drums = {[kick . snare .] [hat*8]}
voice bass = [^1 _ ^5 ^4].octave(-2).inst(bass)
voice lead = [^1 ^3 ^5 ^3|^7].fast(1).every(4, rev)
voice chords = <^1@7 ^4@7>.strum
let twice(x) =
  let y = x + 2
  y * 2
print(twice(3))
`;
try {
  const scene = evaluate(src);
  console.log(scene.prints, scene.seed, scene.voices.size);
  const { notes } = renderNotes(scene, 2);
  for (const n of notes.slice(0, 40)) console.log(n.voice.padEnd(7), n.bar.toFixed(3), n.bars.toFixed(3), pitchName(n.semi), n.vel.toFixed(2), JSON.stringify(n.params));
} catch (e) { console.log(formatError(src, e)); }
