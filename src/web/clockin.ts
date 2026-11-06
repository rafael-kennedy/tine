// Following an external MIDI clock. Gear sends 24 clock ticks per quarter
// note, plus start, continue and stop. USB and DIN MIDI jitter by a
// millisecond or more per tick, so the tempo is a least-squares fit over the
// last two beats of ticks rather than the gap between the last two.
export const CLOCK = 0xf8, START = 0xfa, CONTINUE = 0xfb, STOP = 0xfc;

export class ClockFollower {
  ticks = 0;           // ticks since the last start; tick 1 is the downbeat
  started = false;     // true once a start message has set the phase
  private times: number[] = [];
  constructor(public window = 48) {}

  start() { this.ticks = 0; this.times = []; this.started = true; }
  stop() { this.started = false; }

  // Feed one clock tick (timestamp in ms). Returns quarter notes per minute, or 0 while unsure.
  tick(ms: number): number {
    const last = this.times[this.times.length - 1];
    if (last !== undefined && ms - last > 1000) this.times = []; // the clock paused
    this.ticks++;
    this.times.push(ms);
    if (this.times.length > this.window) this.times.shift();
    return this.bpm();
  }

  bpm(): number {
    const n = this.times.length;
    if (n < 7) return 0;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { const y = this.times[i] - this.times[0]; sx += i; sy += y; sxx += i * i; sxy += i * y; }
    const msPerTick = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return msPerTick > 0 ? 60000 / (msPerTick * 24) : 0;
  }

  // Position of the latest tick in quarter notes since the start.
  quarters(): number { return Math.max(0, this.ticks - 1) / 24; }
}
