// Seeded, positional randomness.
//
// Tine never keeps a mutable random generator running in the background.
// Every random decision is a pure hash of (seed, voice, site, bar, position).
// That makes any performance exactly replayable from its seed, lets the
// scheduler look ahead or rewind freely, and means editing one voice never
// reshuffles the dice of another.

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

function mix(h: number, x: number): number {
  // murmur3-style mixing of a 32-bit chunk
  x = Math.imul(x >>> 0, 0xcc9e2d51); x = (x << 15) | (x >>> 17); x = Math.imul(x, 0x1b873593);
  h ^= x; h = (h << 13) | (h >>> 19); h = (Math.imul(h, 5) + 0xe6546b64) >>> 0;
  return h >>> 0;
}

function fin(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

// Uniform float in [0, 1) from any list of numbers.
export function rand01(...keys: number[]): number {
  let h = 0x9747b28c;
  for (const k of keys) {
    if (Number.isInteger(k) && Math.abs(k) < 2 ** 31) h = mix(h, k | 0);
    else { // non-integers: hash the float bits
      const f = new Float64Array([k]); const u = new Uint32Array(f.buffer);
      h = mix(mix(h, u[0]), u[1]);
    }
  }
  return fin(h) / 4294967296;
}

// A sequential stream, used for random calls in ordinary expressions.
// It is itself seeded positionally, so the n-th draw is always the same.
export class Stream {
  n = 0;
  constructor(public keys: number[]) {}
  next(): number { return rand01(...this.keys, this.n++); }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
