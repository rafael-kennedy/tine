// MusicXML export, so a piece can be opened as a score in MuseScore,
// Dorico, Sibelius or Finale. One part per voice. Timing stays exact: the
// divisions per quarter note are the least common multiple of every
// denominator in the piece, so tuplets of any size land on whole ticks.
// Notes that cross a bar line are split and tied; overlapping notes in one
// voice go into separate notation voices; pitches between the keys keep
// their cents as a decimal <alter>, which MusicXML allows.
import { R } from "./rational";
import { Scene } from "./interp";
import { TimedNote, timeline } from "./scene";
import { assignChannels } from "./render";
import { keyFifths } from "./pitch";
import { identify } from "./harmony";

const MAX_DIVISIONS = 100_000;
const TYPES = ["whole", "half", "quarter", "eighth", "16th", "32nd", "64th", "128th"]; // 4 / 2^k quarters
const SHARP = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]] as const;
const FLAT = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]] as const;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function spell(semi: number, flats: boolean): { step: string; alter: number; octave: number } {
  const near = Math.round(semi), cents = semi - near;
  const [step, acc] = (flats ? FLAT : SHARP)[((near % 12) + 12) % 12];
  // B# and Cb never appear, so the octave is the MIDI octave
  return { step, alter: Math.round((acc + cents) * 1000) / 1000, octave: Math.floor(near / 12) - 1 };
}

// One duration (in quarters) as note values. Binary lengths become plain or
// dotted values tied together; anything else is one tuplet note.
export function noteValues(q: R): { type: string; dots: number; tuplet?: [number, number] }[] {
  const out: { type: string; dots: number; tuplet?: [number, number] }[] = [];
  const binary = (q.d & (q.d - 1)) === 0;
  if (!binary) {
    let k = 0; while (k < TYPES.length - 1 && new R(4, 2 ** (k + 1)).ge(q)) k++;
    const ratio = q.div(new R(4, 2 ** k)); // normal / actual
    if (ratio.d <= 64) return [{ type: TYPES[k], dots: 0, tuplet: [ratio.d, ratio.n] }];
    return [{ type: TYPES[k], dots: 0 }]; // too fine to name; the <duration> stays exact
  }
  let rem = q;
  while (rem.gt(new R(0))) {
    let k = 0; while (k < TYPES.length - 1 && new R(4, 2 ** k).gt(rem)) k++;
    const v = new R(4, 2 ** k);
    if (v.gt(rem)) { out.push({ type: TYPES[k], dots: 0 }); break; } // below a 128th
    const dotted = v.mul(new R(3, 2));
    if (k > 0 && dotted.le(rem)) { out.push({ type: TYPES[k], dots: 1 }); rem = rem.sub(dotted); }
    else { out.push({ type: TYPES[k], dots: 0 }); rem = rem.sub(v); }
  }
  return out;
}

// The length of one value in quarters, matching noteValues().
function valueQuarters(v: { type: string; dots: number; tuplet?: [number, number] }): R {
  let q = new R(4, 2 ** TYPES.indexOf(v.type));
  if (v.dots) q = q.mul(new R(3, 2));
  if (v.tuplet) q = q.mul(new R(v.tuplet[1], v.tuplet[0]));
  return q;
}

interface Chord { start: number; end: number; notes: TimedNote[] }

// MusicXML's named chord kinds; anything else is written as "other" with its symbol as text.
const KINDS: Record<string, string> = {
  "": "major", m: "minor", "7": "dominant", maj7: "major-seventh", m7: "minor-seventh", m7b5: "half-diminished",
  dim7: "diminished-seventh", dim: "diminished", aug: "augmented", sus4: "suspended-fourth", sus2: "suspended-second",
  "5": "power", "6": "major-sixth", m6: "minor-sixth", mmaj7: "major-minor", "9": "dominant-ninth", maj9: "major-ninth",
  m9: "minor-ninth", "11": "dominant-11th", m11: "minor-11th", "13": "dominant-13th", maj13: "major-13th", m13: "minor-13th", "7#5": "augmented-seventh",
};

// A chord symbol for notes that sound together: three or more pitch classes,
// or any notes that came from a chord symbol (which carries its root).
export function harmonyXml(notes: TimedNote[], flats: boolean): { sym: string; xml: string } | null {
  const semis = notes.map(n => Math.round(n.semi));
  const hint = notes.find(n => n.params.chordRoot !== undefined)?.params.chordRoot;
  if (hint === undefined && new Set(semis.map(x => ((x % 12) + 12) % 12)).size < 3) return null;
  const id = identify(semis, hint);
  if (!id) return null;
  const bassPc = ((Math.min(...semis) % 12) + 12) % 12;
  const r = spell(60 + id.root, flats), b = spell(60 + bassPc, flats);
  const alter = (a: number, tag: string) => (a ? `<${tag}>${a}</${tag}>` : "");
  const slash = bassPc !== id.root && !id.omitted.includes("root");
  const xml = `<harmony><root><root-step>${r.step}</root-step>${alter(r.alter, "root-alter")}</root><kind text="${esc(id.sym)}">${KINDS[id.sym] ?? "other"}</kind>${slash ? `<bass><bass-step>${b.step}</bass-step>${alter(b.alter, "bass-alter")}</bass>` : ""}</harmony>`;
  return { sym: `${id.root}${id.sym}/${slash ? bassPc : ""}`, xml };
}

// A score writes the note as composed: legato and humanize are performance.
export const asWritten = (n: TimedNote): TimedNote => n.written ? { ...n, bar: n.written.bar, bars: n.written.bars } : n;

export function toMusicXml(scene: Scene, notes: TimedNote[], bars: number, title = "Tine piece"): string {
  const qpb = new R(scene.meter[0] * 4, scene.meter[1]); // quarters per bar
  const playable = notes.filter(n => n.params.ccOut === undefined).map(asWritten);
  const exact = playable.map(n => {
    const s = R.approx(n.bar, 10_000).mul(qpb), e = R.approx(n.bar, 10_000).add(R.approx(n.bars, 10_000)).mul(qpb);
    return { n, s, e };
  });
  let div = qpb.d;
  for (const x of exact) { div = lcm(div, x.s.d); div = lcm(div, x.e.d); if (div > MAX_DIVISIONS) break; }
  if (div > MAX_DIVISIONS) div = lcm(480, qpb.d); // past this, round to a fine grid
  const tick = (q: R) => Math.round(q.toNumber() * div);
  const M = tick(qpb);
  const { fifths, mode } = keyFifths(scene.key);
  const flats = fifths < 0;

  const voices = [...new Set(playable.map(n => n.voice))];
  const segs = timeline(scene).segments;
  const tempoAt = new Map<number, number>();
  if (segs.length) { let last = -1; for (const s of segs) if (s.tempo !== last) { tempoAt.set(s.startBar, s.tempo); last = s.tempo; } }
  else tempoAt.set(0, scene.tempo);
  const sectionAt = new Map(segs.map(s => [s.startBar, s.section.name]));

  const chans = assignChannels(playable);
  let drumPart = false;
  const parts: string[] = [], list: string[] = [];
  voices.forEach((voice, pi) => {
    const id = `P${pi + 1}`;
    let lastSym = "";
    const mine = exact.filter(x => x.n.voice === voice);
    const drums = mine.some(x => x.n.params.inst === "kit");
    drumPart = drums;
    const midiCh = chans.get(voice) ?? 1;
    list.push(`<score-part id="${id}"><part-name>${esc(voice)}</part-name><midi-instrument id="${id}-I1"><midi-channel>${midiCh}</midi-channel>${mine[0].n.params.program ? `<midi-program>${mine[0].n.params.program}</midi-program>` : ""}</midi-instrument></score-part>`);

    // chords: same start and end; layers: non-overlapping runs of chords
    const chords = new Map<string, Chord>();
    for (const x of mine) {
      const s = tick(x.s), e = Math.max(s + 1, tick(x.e)), k = `${s}|${e}`;
      if (!chords.has(k)) chords.set(k, { start: s, end: e, notes: [] });
      chords.get(k)!.notes.push(x.n);
    }
    const layers: Chord[][] = [];
    for (const c of [...chords.values()].sort((a, b) => a.start - b.start || b.end - a.end)) {
      const l = layers.find(l => l[l.length - 1].end <= c.start);
      if (l) l.push(c); else layers.push([c]);
    }
    if (!layers.length) layers.push([]);
    const mean = mine.reduce((a, x) => a + x.n.semi, 0) / Math.max(1, mine.length);
    const clef = drums ? `<clef><sign>percussion</sign></clef>` : mean < 55 ? `<clef><sign>F</sign><line>4</line></clef>` : `<clef><sign>G</sign><line>2</line></clef>`;

    const measures: string[] = [];
    for (let m = 0; m < bars; m++) {
      const m0 = m * M, m1 = m0 + M;
      let body = "";
      if (m === 0) body += `<attributes><divisions>${div}</divisions><key><fifths>${fifths}</fifths>${mode ? `<mode>${mode}</mode>` : ""}</key><time><beats>${scene.meter[0]}</beats><beat-type>${scene.meter[1]}</beat-type></time>${clef}</attributes>`;
      if (pi === 0 && sectionAt.has(m)) body += `<direction placement="above"><direction-type><rehearsal>${esc(sectionAt.get(m)!)}</rehearsal></direction-type></direction>`;
      if (pi === 0 && tempoAt.has(m)) {
        const bpm = tempoAt.get(m)!, beat = scene.meter[1] === 8 ? "eighth" : scene.meter[1] === 2 ? "half" : "quarter";
        body += `<direction placement="above"><direction-type><metronome><beat-unit>${beat}</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${Math.round(bpm * (4 / scene.meter[1]) * 1000) / 1000}"/></direction>`;
      }
      let wrote = 0;
      layers.forEach((layer, li) => {
        const inBar = layer.filter(c => c.start < m1 && c.end > m0);
        if (li > 0 && !inBar.length) return;
        if (wrote) body += `<backup><duration>${M}</duration></backup>`;
        wrote++;
        let cur = m0;
        if (!inBar.length) { body += `<note><rest measure="yes"/><duration>${M}</duration><voice>${li + 1}</voice></note>`; return; }
        for (const c of inBar) {
          const s = Math.max(c.start, m0), e = Math.min(c.end, m1);
          if (s > cur) body += rests(cur, s, li);
          if (!drumPart && li === 0 && c.start >= m0) {
            const h = harmonyXml(c.notes, flats);
            if (h && h.sym !== lastSym) { body += h.xml; lastSym = h.sym; }
          }
          body += pieces(c, s, e, li, c.start < m0, c.end > m1);
          cur = e;
        }
        if (cur < m1) body += rests(cur, m1, li);
      });
      measures.push(`<measure number="${m + 1}">${body}</measure>`);
    }
    parts.push(`<part id="${id}">${measures.join("")}</part>`);
  });

  function split(a: number, b: number) {
    const out: { len: number; v: ReturnType<typeof noteValues>[number] }[] = [];
    const vals = noteValues(new R(b - a, div));
    let used = 0;
    vals.forEach((v, i) => {
      const len = i === vals.length - 1 ? b - a - used : Math.round(valueQuarters(v).toNumber() * div);
      out.push({ len, v }); used += len;
    });
    return out;
  }
  function typeXml(v: ReturnType<typeof noteValues>[number]) {
    return `<type>${v.type}</type>${"<dot/>".repeat(v.dots)}${v.tuplet ? `<time-modification><actual-notes>${v.tuplet[0]}</actual-notes><normal-notes>${v.tuplet[1]}</normal-notes></time-modification>` : ""}`;
  }
  function rests(a: number, b: number, li: number) {
    return split(a, b).map(p => `<note><rest/><duration>${p.len}</duration><voice>${li + 1}</voice>${typeXml(p.v)}</note>`).join("");
  }
  function pieces(c: Chord, a: number, b: number, li: number, tiedIn: boolean, tiedOut: boolean) {
    const ps = split(a, b);
    let x = "";
    ps.forEach((p, pi) => {
      const tStop = tiedIn || pi > 0, tStart = tiedOut || pi < ps.length - 1;
      c.notes.forEach((n, ni) => {
        const sp = spell(n.semi, flats);
        const pitch = drumPart ? `<unpitched><display-step>${sp.step}</display-step><display-octave>${sp.octave}</display-octave></unpitched>` : `<pitch><step>${sp.step}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ""}<octave>${sp.octave}</octave></pitch>`;
        const ties = (tStop ? `<tie type="stop"/>` : "") + (tStart ? `<tie type="start"/>` : "");
        const tied = (tStop ? `<tied type="stop"/>` : "") + (tStart ? `<tied type="start"/>` : "");
        const dyn = Math.round(n.vel * 127 / 90 * 10000) / 100;
        x += `<note dynamics="${dyn}">${ni ? "<chord/>" : ""}${pitch}<duration>${p.len}</duration>${ties}<voice>${li + 1}</voice>${typeXml(p.v)}${tied ? `<notations>${tied}</notations>` : ""}</note>`;
      });
    });
    return x;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${esc(title)}</work-title></work><identification><encoding><software>Tine</software></encoding><miscellaneous><miscellaneous-field name="seed">${scene.seed}</miscellaneous-field></miscellaneous></identification><part-list>${list.join("")}</part-list>${parts.join("")}</score-partwise>
`;
}
