// Open Sound Control 1.0, the little we need: messages with int, float and
// string arguments, and bundles with an NTP time tag, as SuperDirt expects.

export type OscArg = string | number | { i: number };

const pad4 = (n: number) => (n + 3) & ~3;

function str(s: string): Uint8Array {
  const b = new TextEncoder().encode(s), out = new Uint8Array(pad4(b.length + 1));
  out.set(b);
  return out;
}

export function oscMessage(address: string, args: OscArg[]): Uint8Array {
  let tags = ",";
  const parts: Uint8Array[] = [str(address)];
  const body: Uint8Array[] = [];
  for (const a of args) {
    if (typeof a === "string") { tags += "s"; body.push(str(a)); }
    else if (typeof a === "object") { tags += "i"; const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, a.i); body.push(b); }
    else { tags += "f"; const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, a); body.push(b); }
  }
  parts.push(str(tags), ...body);
  return concat(parts);
}

// `seconds` is Unix time; OSC counts from 1900 in 32.32 fixed point.
export function oscBundle(seconds: number, messages: Uint8Array[]): Uint8Array {
  const ntp = seconds + 2208988800, hi = Math.floor(ntp), lo = Math.round((ntp - hi) * 2 ** 32) >>> 0;
  const head = new Uint8Array(16);
  head.set(str("#bundle"));
  const v = new DataView(head.buffer);
  v.setUint32(8, hi >>> 0); v.setUint32(12, lo);
  const parts: Uint8Array[] = [head];
  for (const m of messages) { const len = new Uint8Array(4); new DataView(len.buffer).setInt32(0, m.length); parts.push(len, m); }
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Decoding, for tests and debugging.
export function oscDecode(b: Uint8Array): { time?: number; messages: { address: string; args: (string | number)[] }[] } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const readStr = (o: number): [string, number] => { let e = o; while (b[e]) e++; return [new TextDecoder().decode(b.subarray(o, e)), pad4(e - o + 1) + o]; };
  const msg = (o: number, end: number) => {
    let [address, p] = readStr(o); let tags: string; [tags, p] = readStr(p);
    const args: (string | number)[] = [];
    for (const t of tags.slice(1)) {
      if (t === "s") { const [s, q] = readStr(p); args.push(s); p = q; }
      else if (t === "i") { args.push(v.getInt32(p)); p += 4; }
      else if (t === "f") { args.push(v.getFloat32(p)); p += 4; }
    }
    return { address, args };
  };
  if (readStr(0)[0] === "#bundle") {
    const time = v.getUint32(8) + v.getUint32(12) / 2 ** 32 - 2208988800;
    const messages = [];
    for (let o = 16; o < b.length;) { const n = v.getInt32(o); messages.push(msg(o + 4, o + 4 + n)); o += 4 + n; }
    return { time, messages };
  }
  return { messages: [msg(0, b.length)] };
}
