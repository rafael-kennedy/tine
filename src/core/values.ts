import { R } from "./rational";
import { Pitch, Degree, Key, Scale } from "./pitch";
import { Pat, Chord, Rest } from "./pattern";
import type { Node } from "./parser";

export class Rec {
  constructor(public fields: Record<string, any>) {}
  toString() { return `(${Object.entries(this.fields).map(([k, v]) => `${k}: ${show(v)}`).join(", ")})`; }
}

export class Closure {
  constructor(public name: string, public params: string[], public body: Node, public env: Env) {}
  toString() { return `<fn ${this.name}(${this.params.join(", ")})>`; }
}

export type BuiltinImpl = (args: any[], named: Record<string, any>, call: CallInfo) => any;
export interface CallInfo { span?: { start: number; end: number }; interp: any }

export class Builtin {
  constructor(public name: string, public impl: BuiltinImpl, public sig: string, public doc: string, public category: string) {}
  toString() { return `<builtin ${this.name}>`; }
}

export class Env {
  vars = new Map<string, any>();
  constructor(public parent?: Env) {}
  get(name: string): any {
    let e: Env | undefined = this;
    while (e) { if (e.vars.has(name)) return e.vars.get(name); e = e.parent; }
    return undefined;
  }
  has(name: string): boolean {
    let e: Env | undefined = this;
    while (e) { if (e.vars.has(name)) return true; e = e.parent; }
    return false;
  }
  set(name: string, v: any) { this.vars.set(name, v); }
  names(): string[] {
    const s = new Set<string>(); let e: Env | undefined = this;
    while (e) { for (const k of e.vars.keys()) s.add(k); e = e.parent; }
    return [...s];
  }
}

export function typeName(v: any): string {
  if (v instanceof R || typeof v === "number") return "number";
  if (typeof v === "string") return "text";
  if (typeof v === "boolean") return "boolean";
  if (v instanceof Pitch) return v.drum ? "drum" : "pitch";
  if (v instanceof Degree) return "degree";
  if (v instanceof Chord) return "chord";
  if (v instanceof Pat) return v.items ? "phrase" : v.sig ? "signal" : "pattern";
  if (v instanceof Key) return "key";
  if (v instanceof Scale) return "scale";
  if (v instanceof Closure || v instanceof Builtin) return "function";
  if (v instanceof Rec) return "record";
  if (v instanceof Rest) return "rest";
  if (v === null || v === undefined) return "nothing";
  return typeof v;
}

export function show(v: any): string {
  if (v === null || v === undefined) return "nothing";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return String(v);
}

export function num(v: any): number {
  if (v instanceof R) return v.toNumber();
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Pitch) return v.semi;
  throw new TypeError(`expected a number, got ${typeName(v)}`);
}

export function isNum(v: any): boolean { return v instanceof R || typeof v === "number"; }

export function truthy(v: any): boolean {
  if (v === false || v === null || v === undefined) return false;
  if (v instanceof R) return v.n !== 0;
  if (typeof v === "number") return v !== 0;
  return true;
}
