// The function guide: for every builtin, a short introduction and a few
// examples of different ways to use it, each with a sentence that leads into
// it. The DAW's Help tab and docs/FUNCTIONS.md are both made from this, and
// tests/guide.test.ts runs every example, so the two stay in step with the
// language.

export interface Example {
  /** A sentence or two that leads into the example and links it to the one before. */
  say: string;
  /** A complete piece: it evaluates and plays on its own. */
  code: string;
  /** Bars to show and play; guessed from the code when left out. */
  bars?: number;
  /** false for an example that needs a file, a device or the network to be heard: the help shows it
   *  without a play button. Tests still run it. */
  live?: false;
}

export interface Guide {
  /** What the function is for, in a sentence or three. */
  intro: string;
  examples: Example[];
  /** Related functions, by name. */
  see?: string[];
}

export const ex = (say: string, code: string, opts: { bars?: number; live?: false } = {}): Example => ({ say, code: code.trim(), ...opts });
