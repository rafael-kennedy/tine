// Renders note buffers off the main thread with the same DSP as everything
// else (src/core/synth.ts). The engine asks ahead of time; the reply carries
// the samples as a transferable buffer, so nothing is copied back.
import { renderNote } from "../core/synth";

export interface RenderJob { key: string; sr: number; note: { inst: string; freq: number; semi: number; vel: number; dur: number; params: Record<string, any> } }

self.onmessage = (e: MessageEvent<RenderJob>) => {
  const { key, sr, note } = e.data;
  let data: Float32Array;
  try { data = renderNote(note, sr); } catch { data = new Float32Array(0); }
  // never hand back NaN: one bad buffer would silence the shared mix. An empty
  // reply makes the engine render the note on the main thread instead.
  for (let i = 0; i < data.length; i += 64) if (!Number.isFinite(data[i])) { data = new Float32Array(0); break; }
  (self as any).postMessage({ key, data }, [data.buffer]);
};
