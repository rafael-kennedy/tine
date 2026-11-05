// Exact rational arithmetic for musical time.
// Time in Tine is measured in bars (cycles). Using exact fractions means
// nested tuplets and polymeters never drift, no matter how long a piece runs.

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a || 1;
}

const SAFE = Number.MAX_SAFE_INTEGER;

export class R {
  readonly n: number;
  readonly d: number;
  constructor(n: number, d: number = 1) {
    if (d === 0) throw new Error("division by zero");
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    this.n = n / g; this.d = d / g;
  }
  static of(x: number | R): R {
    if (x instanceof R) return x;
    if (Number.isInteger(x)) return new R(x, 1);
    return R.approx(x);
  }
  // Best rational approximation via continued fractions (denominator <= maxD).
  static approx(x: number, maxD = 1_000_000): R {
    if (!isFinite(x)) throw new Error("non-finite time value");
    const sign = x < 0 ? -1 : 1; x = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 64; i++) {
      const a = Math.floor(b);
      const h2 = a * h1 + h0, k2 = a * k1 + k0;
      if (k2 > maxD) break;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (Math.abs(x - h1 / k1) < 1e-12) break;
      b = 1 / (b - a);
      if (!isFinite(b)) break;
    }
    return new R(sign * h1, k1);
  }
  private static safe(n: number, d: number): R {
    if (Math.abs(n) > SAFE || Math.abs(d) > SAFE) return R.approx(n / d);
    return new R(n, d);
  }
  add(o: R): R { return R.safe(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: R): R { return R.safe(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: R): R { return R.safe(this.n * o.n, this.d * o.d); }
  div(o: R): R { if (o.n === 0) throw new Error("division by zero"); return R.safe(this.n * o.d, this.d * o.n); }
  neg(): R { return new R(-this.n, this.d); }
  cmp(o: R): number { const x = this.n * o.d - o.n * this.d; return x < 0 ? -1 : x > 0 ? 1 : 0; }
  lt(o: R) { return this.cmp(o) < 0; }
  le(o: R) { return this.cmp(o) <= 0; }
  gt(o: R) { return this.cmp(o) > 0; }
  ge(o: R) { return this.cmp(o) >= 0; }
  eq(o: R) { return this.n === o.n && this.d === o.d; }
  floor(): number { return Math.floor(this.n / this.d); }
  ceil(): number { return Math.ceil(this.n / this.d); }
  sam(): R { return new R(this.floor(), 1); }   // start of the bar containing this time
  cyclePos(): R { return this.sub(this.sam()); }
  isInt(): boolean { return this.d === 1; }
  valueOf(): number { return this.n / this.d; }
  toNumber(): number { return this.n / this.d; }
  toString(): string { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
  static min(a: R, b: R) { return a.lt(b) ? a : b; }
  static max(a: R, b: R) { return a.gt(b) ? a : b; }
}

export const ZERO = new R(0);
export const ONE = new R(1);
