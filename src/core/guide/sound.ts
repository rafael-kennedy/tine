import { Guide, ex } from "./types";

// Sound: note settings, the synth, effects, samples and outputs.
export const SOUND: Record<string, Guide> = {
  vel: {
    intro: "`vel(v)` sets how hard notes are played, from 0 to 1. The value can be a pattern, which is how accents are written, or a signal, for swells and fades.",
    examples: [
      ex("One level for a whole part, to sit it back in the mix.", `
voice pad  = <c3@maj7 a2@m7>.inst(pad).vel(.4)
voice lead = [e4 g4 a4 b4].inst(pluck)`, { bars: 2 }),
      ex("A pattern of velocities accents the hats. It repeats across the notes on its own grid.", `
voice hats = [hat*8].vel([.9 .4 .6 .4])`),
      ex("A signal for a crescendo over two bars.", `
voice roll = [snare*16].vel(saw(2).range(.1, 1))`, { bars: 2 }),
    ],
    see: ["gain", "humanize"],
  },
  legato: {
    intro: "`legato(x)` sets how long each note sounds, as a fraction of its step. 1 is full length, 0.5 is staccato, more than 1 overlaps the next note.",
    examples: [
      ex("Short, plucked chords.", `
voice stabs = [c4@m7 . c4@m7 . . c4@m7 . .].legato(.3).inst(keys)`),
      ex("A pattern of lengths gives articulation: long, short, short, long.", `
voice line = [c4 d4 e4 g4].legato([1 .3 .3 1]).inst(organ)`),
      ex("More than 1 makes notes overlap, smooth like a pad.", `
voice wash = [c4 e4 g4 b4].legato(2).inst(pad).vel(.4)`),
    ],
    see: ["dur", "slur", "release"],
  },
  gain: {
    intro: "`gain(x)` multiplies the built-in synth's output level. Unlike `vel`, it does not change how a note is played (the attack, the brightness), only how loud it comes out.",
    examples: [
      ex("Turn a part down without softening its attack.", `
voice bass = [c2 . c2 g1].inst(bass).gain(.5)
voice kick = [kick . kick .]`),
      ex("Above 1 to boost a quiet instrument.", `
voice tune = [e5 d5 c5 g4].inst(sine).gain(1.5)`),
    ],
    see: ["vel", "compress"],
  },
  pan: {
    intro: "`pan(x)` places a part in the stereo field, from -1 (left) through 0 (centre) to 1 (right). Patterns and signals move it.",
    examples: [
      ex("Two guitars, one each side.", `
voice left  = [e3@m . e3@m e3@m].strum.inst(pluck).pan(-.7)
voice right = [. b3@m . b3@m].strum.inst(pluck).pan(.7)`),
      ex("A pattern pans each note in turn: a ping-pong.", `
voice ping = [c5 e5 g5 c6].pan([-1 1]).inst(bell)`),
      ex("A slow signal makes the part drift across.", `
voice drift = [^1 ^3 ^5 ^3].inst(keys).pan(sine(4).range(-.8, .8))`, { bars: 4 }),
    ],
    see: ["drift", "sine"],
  },
  cutoff: {
    intro: "`cutoff(hz)` sets the built-in synth's low-pass filter for each note. Lower is darker. With `res` and a moving signal, it is the classic filter sweep. For a filter over the whole voice's mix, use `lpf`.",
    examples: [
      ex("A dark bass and a bright one.", `
voice dark   = [c2 . c2 .].inst(saw).cutoff(300).pan(-.6)
voice bright = [. g2 . g2].inst(saw).cutoff(4000).pan(.6)`),
      ex("A pattern of cutoffs, one per note, for a squelchy line.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(saw).cutoff([300 800 2000 500]).res(.7)`),
      ex("A slow sine sweep over eight bars.", `
voice bass = [c2 c2 c3 c2 eb2 c2 g2 bb1].fast(2).inst(saw).cutoff(sine(8).range(300, 3000)).res(.4)`, { bars: 8 }),
    ],
    see: ["res", "fenv", "lpf", "wobble"],
  },
  res: {
    intro: "`res(x)` sets the resonance of the synth's filter, 0 to 1. Higher values make the filter whistle at the cutoff, which makes sweeps more vocal.",
    examples: [
      ex("Low and high resonance on the same line.", `
voice smooth = [c2 c3 c2 eb2].inst(saw).cutoff(800).res(.1)
voice sharp  = [c2 c3 c2 eb2].inst(saw).cutoff(800).res(.8).late(1/2)`),
      ex("High resonance with a sweeping cutoff: the acid sound.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].fast(2).inst(saw).cutoff(tri(2).range(300, 2500)).res(.75)`, { bars: 2 }),
    ],
    see: ["cutoff", "fenv"],
  },
  attack: {
    intro: "`attack(seconds)` sets how long a note takes to reach full volume. Short is percussive; long swells in.",
    examples: [
      ex("A slow attack turns a keyboard into a swelling pad.", `
voice swell = <c3@maj7 f3@maj7>.inst(keys).attack(.8)`, { bars: 2 }),
      ex("A pattern of attacks: some notes snap, some fade in.", `
voice line = [c4 e4 g4 c5].inst(saw).attack([.005 .2]).cutoff(1500)`),
    ],
    see: ["decay", "sustain", "release"],
  },
  release: {
    intro: "`release(seconds)` sets how long a note takes to fade after it ends. Long releases blur notes together.",
    examples: [
      ex("Short notes with a long release ring on after they stop.", `
voice bells = [c5 . g4 . e5 . . .].legato(.2).inst(sine).release(1.5)`),
      ex("A tight release for a dry, clipped sound.", `
voice bass = [c2 c2 . c2 eb2 . g1 .].inst(saw).release(.02).cutoff(900)`),
    ],
    see: ["attack", "legato"],
  },
  decay: {
    intro: "`decay(seconds)` sets how long a note takes to fall from its peak to the sustain level.",
    examples: [
      ex("A fast decay to a low sustain gives a plucked sound.", `
voice pluck = [c4 e4 g4 c5].inst(saw).decay(.1).sustain(.1).cutoff(2500)`),
      ex("A long decay lets each note fade slowly while held.", `
voice keys = <c3@maj7 a2@m7>.inst(saw).decay(2).sustain(0).cutoff(1200)`, { bars: 2 }),
    ],
    see: ["sustain", "attack"],
  },
  sustain: {
    intro: "`sustain(level)` sets the level a held note settles to after its decay, 0 to 1.",
    examples: [
      ex("Full sustain holds like an organ; zero sustain dies away like a struck string.", `
voice organ  = [c4@maj . . .].inst(saw).sustain(1).cutoff(1500).pan(-.6)
voice struck = [. . c4@maj .].inst(saw).sustain(0).decay(.4).cutoff(1500).pan(.6)`),
      ex("A pattern of sustain levels makes each note's body different.", `
voice line = [c3 _ eb3 _ g3 _ bb3 _].inst(saw).decay(.2).sustain([.8 .1]).cutoff(1200)`),
    ],
    see: ["decay", "release"],
  },
  reverb: {
    intro: "`reverb(amount)` sends a part to the shared reverb, 0 to 1. All voices share one room, so they sound as if they are in the same place. For a reverb on one voice alone, use `room`.",
    examples: [
      ex("A dry drum part and a wet melody.", `
voice drums = [kick hat snare hat]
voice tune  = [e5 . d5 . c5 . g4 .].inst(bell).reverb(.6)`),
      ex("Patterned sends: every other note goes into the room.", `
voice keys = [c4 e4 g4 c5].inst(keys).reverb([0 .8])`),
    ],
    see: ["room", "delay"],
  },
  hpf: {
    intro: "`hpf(hz)` is a high-pass filter on the whole voice: it removes everything below hz. Use it to keep low rumble out of parts that do not need it.",
    examples: [
      ex("Thin out a pad so it does not crowd the bass.", `
voice pad  = <c3@m9 f3@m9>.inst(pad).hpf(500)
voice bass = [c2 . c2 g1].inst(bass)`, { bars: 2 }),
      ex("A rising high-pass, the build-up before a drop.", `
voice beat = [kick hat snare hat]*2
voice keys = [c4@m7 . . c4@m7].inst(keys).hpf(saw(4).range(100, 3000))`, { bars: 4 }),
    ],
    see: ["lpf", "cutoff"],
  },
  lpf: {
    intro: "`lpf(hz)` is a low-pass filter on the whole voice: it darkens everything above hz. Unlike `cutoff`, which shapes each note in the synth, this filters the voice's mix, so it works on samples and chords alike.",
    examples: [
      ex("A sweep on a drum loop.", `
voice amen = ["loop_amen"].loopAt(2).chop(16).lpf(sine(4).range(400, 6000))`, { bars: 4 }),
      ex("Muffle a part to push it into the background.", `
voice back = [c4@maj7 . a3@m7 .].inst(keys).lpf(800)
voice lead = [e5 d5 c5 b4].inst(pluck)`),
    ],
    see: ["hpf", "cutoff"],
  },
  drive: {
    intro: "`drive(amount)` saturates the whole voice, from 0 (clean) to 1 (crushed). Chords distort together, like through an amp.",
    examples: [
      ex("A little drive warms a bass.", `
voice bass = [c2 . c2 eb2 . f2 g2 .].inst(bass).drive(.3)`),
      ex("A lot of drive on power chords.", `
voice gtr = [e2@5 _ e2@5 g2@5 _ a2@5 _ .].inst(saw).drive(.9).lpf(3000)`),
    ],
    see: ["crush", "compress"],
  },
  delay: {
    intro: "`delay(mix, time, feedback)` is an echo on the whole voice. Time is in bars, so it follows the tempo: 3/16 is a dotted eighth in 4/4. Feedback sets how many repeats. For echoes as separate notes, use `echo`.",
    examples: [
      ex("A dotted-eighth delay on a sparse melody.", `
voice tune = [e5 . . g5 . . a5 .].inst(pluck).delay(.4)`),
      ex("A quarter-note delay with long feedback, for dub.", `
voice chop = [. c4@m . .].inst(keys).legato(.2).delay(.5, time: 1/4, feedback: .7)`, { bars: 2 }),
      ex("A tiny time with feedback makes a metallic, flanged sound.", `
voice zap = [c3 . c3 .].inst(saw).delay(.6, time: 1/256, feedback: .8)`),
    ],
    see: ["echo", "room"],
  },
  wave: {
    intro: "`wave(name)` picks the oscillator of the `synth` instrument and its presets: saw, square, pulse, tri, sine, super, fm or noise.",
    examples: [
      ex("The same line on four waves, one per bar.", `
let line = [c3 eb3 g3 bb3]
voice synth = cat(line.inst(synth).wave("saw"), line.inst(synth).wave("square"), line.inst(synth).wave("tri"), line.inst(synth).wave("sine"))`, { bars: 4 }),
      ex("`super` is a stack of detuned saws, the trance lead.", `
voice lead = [e4 . g4 a4 . b4 a4 g4].inst(synth).wave("super").unison(7).detune(20)`),
    ],
    see: ["inst", "pw", "unison"],
  },
  pw: {
    intro: "`pw(width)` sets the width of the pulse wave, 0 to 1. 0.5 is a square; narrow widths sound thin and nasal. Move it with a signal for pulse-width modulation.",
    examples: [
      ex("A narrow pulse for a reedy tone.", `
voice reed = [c4 d4 e4 g4].inst(synth).wave("pulse").pw(.15)`),
      ex("Slow pulse-width modulation: the classic analog string sound.", `
voice strings = <c3@maj7 f3@maj7>.inst(synth).wave("pulse").pw(sine(2).range(.1, .5)).attack(.3)`, { bars: 2 }),
    ],
    see: ["wave"],
  },
  detune: {
    intro: "`detune(cents)` spreads the unison oscillators apart, in cents either side. More detune is wider and more chorused.",
    examples: [
      ex("Slight and heavy detune, side by side.", `
voice slight = [c3@maj7].inst(synth).wave("saw").unison(5).detune(5).pan(-.6)
voice heavy  = [. . c3@maj7 .].inst(synth).wave("saw").unison(5).detune(40).pan(.6)`),
      ex("Detune moving over time, for a sound that widens.", `
voice lead = [e4 _ g4 _ a4 _ b4 _].inst(supersaw).detune(saw(2).range(0, 50))`, { bars: 2 }),
    ],
    see: ["unison", "chorus"],
  },
  unison: {
    intro: "`unison(n)` sets how many detuned oscillators sound together, from 1 to 16. More is thicker.",
    examples: [
      ex("One oscillator, then sixteen.", `
voice one  = [c3 . . .].inst(synth).wave("saw").unison(1)
voice many = [. . c3 .].inst(synth).wave("saw").unison(16).detune(25)`),
      ex("A thick bass from three oscillators and a sub.", `
voice bass = [c2 . c2 eb2].inst(synth).wave("saw").unison(3).detune(10).sub(.5).cutoff(900)`),
    ],
    see: ["detune", "sub"],
  },
  sub: {
    intro: "`sub(level)` adds a sine one octave below, 0 to 1. It gives weight to a bass without muddying it.",
    examples: [
      ex("A bass with and without a sub.", `
voice plain = [c2 . . .].inst(synth).wave("square").cutoff(800)
voice deep  = [. . c2 .].inst(synth).wave("square").cutoff(800).sub(.8)`),
      ex("Sub on a reese bass.", `
voice reese = [c2 _ _ _ eb2 _ _ _].inst(reese).sub(.6)`),
    ],
    see: ["unison", "octave"],
  },
  glide: {
    intro: "`glide(seconds)` slides into each note from the one before it in the voice. A pattern of glide times slides only on some notes, the way an acid bass line does.",
    examples: [
      ex("Every note glides a little: a portamento lead.", `
voice lead = [c4 e4 g4 e4 a4 g4 e4 d4].inst(saw).glide(.08).cutoff(2000)`),
      ex("Glide on only one note in eight.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303).glide([0 0 .06 0])`),
      ex("Slurred into, the glide joins two notes into one sound.", `
voice slide = [c4~ g4 . e4~ c4 .].inst(saw).glide(.15).cutoff(1800)`),
    ],
    see: ["slur", "gliss"],
  },
  slur: {
    intro: "`slur` plays a phrase's notes as one connected sound, without a new attack on each, up to the last note in each bar. Scores draw a slur over them. For one pair of notes, write `c4~ d4` in the phrase.",
    examples: [
      ex("A whole bar slurred: one breath.", `
voice tune = [c4 d4 e4 g4 a4 g4 e4 d4].slur.inst(saw).cutoff(1800)`),
      ex("Slur against detached notes, for contrast.", `
voice phrase = cat([e4 f4 g4 a4].slur, [e4 f4 g4 a4].legato(.3)).inst(strings)`, { bars: 2 }),
      ex("Slur plus glide slides through every note.", `
voice siren = [c4 g4 c5 g4].slur.glide(.2).inst(sine)`),
    ],
    see: ["glide", "gliss", "legato"],
  },
  gliss: {
    intro: "`gliss(amount)` makes each note slide to the next across the last part of its length (1 = all of it), up to the last note in each bar. The amount can be a pattern, to slide only some notes.",
    examples: [
      ex("A full glissando between every note.", `
voice slide = [c4 g4 e4 c5].gliss.inst(sine)`),
      ex("Slide only on the second half of each note: the pitch holds, then bends.", `
voice bend = [c4 e4 g4 a4].gliss(.5).inst(strings)`),
      ex("A pattern of amounts: slide, hold, slide, hold.", `
voice line = [c4 d4 e4 f4 g4 f4 e4 d4].gliss([1 0]).inst(saw).cutoff(1500)`),
    ],
    see: ["glide", "slur", "vibrato"],
  },
  fenv: {
    intro: "`fenv(octaves, attack, decay)` is a filter envelope: on each note, the cutoff jumps up by this many octaves and falls back over the decay. It is the squelch of acid bass.",
    examples: [
      ex("A plucky bass from a filter envelope.", `
voice bass = [c2 . c2 eb2 . g2 c2 .].inst(saw).cutoff(300).fenv(3)`),
      ex("A pattern of amounts gives each note its own squelch.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303).fenv([4 2 3 1])`),
      ex("A slow decay makes a sweep inside each long note.", `
voice pad = <c3@m9 ab2@maj9>.inst(saw).cutoff(400).fenv(3, decay: 1.5)`, { bars: 2 }),
    ],
    see: ["cutoff", "res", "wobble"],
  },
  fm: {
    intro: "`fm(index, ratio, decay)` adds frequency modulation and switches the synth to its FM wave. Index is brightness, ratio is the modulator's pitch against the note, decay is how fast the brightness fades. Whole-number ratios sound harmonic; others sound like bells and metal.",
    examples: [
      ex("An electric-piano tone from a low index and a ratio of 1.", `
voice ep = [c4@maj7 . . a3@m7].fm(2, ratio: 1).inst(fm)`),
      ex("A bell from an inharmonic ratio.", `
voice bell = [c5 . g5 . e5 . . .].fm(5, ratio: 3.5, decay: 1)`),
      ex("A pattern of indices: the line gets brighter and darker.", `
voice bass = [c2 c2 c3 c2].fm([1 4 8 2], ratio: 2, decay: .2)`),
    ],
    see: ["wave", "ring"],
  },
  vibrato: {
    intro: "`vibrato(rate, depth)` wobbles the pitch. Rate is in Hz, depth in semitones.",
    examples: [
      ex("A gentle singer's vibrato.", `
voice lead = [e4 _ _ g4 a4 _ _ .].inst(strings).vibrato(5, depth: .15)`),
      ex("Deep and slow, for a wobbly, seasick sound.", `
voice wob = [c4@maj7].inst(organ).vibrato(1.5, depth: .5)`),
    ],
    see: ["gliss", "wobble"],
  },
  wobble: {
    intro: "`wobble(rate, depth)` swings the synth's filter in time with the music. Rate is in cycles per bar; depth is in octaves. Patterns of rates give the dubstep wub.",
    examples: [
      ex("A wobble bass, two wubs per bar.", `
voice wub = [a0 _ _ _ c1 _ _ _].inst(wobble).wobble(2, depth: 4)`),
      ex("A pattern of rates: the wub speeds up halfway.", `
voice wub = [a0 _ _ _ c1 _ _ _].inst(wobble).wobble([2 4], depth: 4)`),
      ex("A slow wobble on a pad, one sweep per bar.", `
voice pad = <c3@m7 f3@m7>.inst(saw).wobble(1, depth: 2).vel(.5)`, { bars: 2 }),
    ],
    see: ["cutoff", "fenv"],
  },
  vowel: {
    intro: "`vowel(v)` is a formant filter that makes the voice say a vowel: \"a\", \"e\", \"i\", \"o\" or \"u\". It works on any sound. A pattern of vowels makes it talk.",
    examples: [
      ex("A saw bass that says \"o\".", `
voice bass = [c2 c2 eb2 c2].inst(saw).vowel("o")`),
      ex("A pattern of vowels, one per note.", `
voice talk = [c3 c3 c3 c3 eb3 c3 g3 c3].inst(saw).vowel(["a" "e" "i" "o"])`),
      ex("Vowels on drums.", `
voice beat = [kick hat snare hat].vowel(["a" "u"])`),
    ],
    see: ["lpf", "phaser"],
  },
  crush: {
    intro: "`crush(bits)` is a bit crusher: fewer bits (from 16 down to 1) is rougher. 4 is very lo-fi.",
    examples: [
      ex("A crushed drum loop.", `
voice beat = [kick hat snare hat kick kick snare hat].crush(4)`),
      ex("A pattern of bit depths: the crunch comes and goes.", `
voice keys = [c4@m7 . c4@m7 .].inst(keys).crush([16 3])`),
    ],
    see: ["coarse", "drive"],
  },
  coarse: {
    intro: "`coarse(n)` reduces the sample rate by holding every nth sample. It adds aliasing and grit. 1 is off.",
    examples: [
      ex("A gritty, aliased lead.", `
voice lead = [e4 g4 a4 b4].inst(square).coarse(8)`),
      ex("With `crush`, the full 8-bit sound.", `
voice chip = [c5 e5 g5 c6].fast(2).inst(chip).coarse(4).crush(6)`),
    ],
    see: ["crush"],
  },
  ring: {
    intro: "`ring(hz, mix)` ring-modulates the voice by a sine at hz, for metallic and bell-like tones. Low frequencies make a tremolo instead.",
    examples: [
      ex("A sine line turned into bells.", `
voice bells = [c4 e4 g4 c5].inst(sine).ring(830)`),
      ex("A low frequency sounds like tremolo.", `
voice trem = [c4@maj7].inst(organ).ring(6, mix: .5)`),
      ex("A pattern of frequencies for a robot voice.", `
voice robot = [c3*8].inst(saw).ring([200 300 450 300])`),
    ],
    see: ["fm", "hz"],
  },
  chorus: {
    intro: "`chorus(mix, rate, depth)` thickens the voice with slightly detuned copies that move. Rate is in Hz.",
    examples: [
      ex("A chorused electric piano.", `
voice keys = <c4@maj7 a3@m7>.inst(keys).chorus(.6)`, { bars: 2 }),
      ex("Fast and deep, for a seasick shimmer.", `
voice gtr = [e4 b4 g4 b4].inst(pluck).chorus(.8, rate: 4, depth: .9)`),
    ],
    see: ["phaser", "detune"],
  },
  phaser: {
    intro: "`phaser(mix, rate, depth)` sweeps a notch through the sound: the classic swirl. Rate is in Hz.",
    examples: [
      ex("A phased pad.", `
voice pad = <c3@m9 f3@m9>.inst(pad).phaser(.6, rate: .25)`, { bars: 2 }),
      ex("Phaser on a talking acid line.", `
voice acid = ([c2 c2 c3 c2 eb2 c2 g2 bb1]*2).inst(saw).vowel(["a" "o"]).phaser(.5)`),
    ],
    see: ["chorus", "vowel"],
  },
  compress: {
    intro: "`compress(threshold, ratio)` evens out a voice: levels above the threshold (in dB) are reduced by the ratio, then the whole is made up. Loud and soft notes end up closer together.",
    examples: [
      ex("Even out a part with widely varied velocities.", `
voice keys = [c4 e4 g4 c5].vel([1 .2 .9 .3]).inst(keys).compress(-24, ratio: 6)`),
      ex("Heavy compression on drums for punch.", `
voice beat = [kick hat snare hat].compress(-30, ratio: 8)`),
    ],
    see: ["gain", "duck"],
  },
  room: {
    intro: "`room(mix, size)` is a reverb on this voice alone. `reverb` sends to a room all voices share; `room` gives one part its own space.",
    examples: [
      ex("A small room on the snare, a large one on the pad.", `
voice snare = [. snare . snare].room(.4, size: .2)
voice pad   = <c3 eb3>.inst(pad).room(.5, size: .9)`, { bars: 2 }),
      ex("A pattern of mixes: every other note is wet.", `
voice clap = [clap*4].room([0 .8], size: .7)`),
    ],
    see: ["reverb", "delay"],
  },
  duck: {
    intro: "`duck(voice)` makes this voice dip each time the named voice plays, then recover over the release (in bars). It is sidechain compression: the pad pumps against the kick.",
    examples: [
      ex("A pad that ducks under the kick.", `
voice kick = [kick . . . kick . . .]
voice pad  = <c3@m7 ab2@maj7>.inst(pad).duck("kick")`, { bars: 2 }),
      ex("Deeper and slower, for an obvious pump.", `
voice kick = [kick*4]
voice bass = [c2*8].inst(saw).cutoff(900).duck("kick", depth: 1, release: 1/4)`),
    ],
    see: ["compress"],
  },
  dur: {
    intro: "`dur(beats)` sets each note's length in beats, whatever its step. A note can ring past its step, or be cut short, without changing the rhythm.",
    examples: [
      ex("Quick steps that each ring for two beats.", `
voice bells = [c5 e5 g5 c6].fast(2).dur(2).inst(bell).vel(.5)`),
      ex("Fixed short notes, whatever the step length.", `
voice line = [c4:3 e4 g4:2 c5:2].dur(1/4).inst(pluck)`),
    ],
    see: ["legato"],
  },
  set: {
    intro: "`set(name, value)` attaches any named setting to notes. Tine passes it on to MIDI control maps and exports, so it can carry settings for other software.",
    examples: [
      ex("A custom setting, readable by anything that consumes the notes.", `
voice lead = [c4 e4 g4].set("brightness", .7).inst(keys)`),
      ex("A setting with a pattern of values, one per note.", `
voice hats = [hat*4].set("variation", [0 1 2 3])`),
    ],
    see: ["ctl"],
  },
  inst: {
    intro: "`inst(name)` picks a built-in instrument: keys, pluck, bass, pad, bell, organ, lead, upright, vibes, sine, saw and more, the synth presets (supersaw, tb303, reese, wobble, chip, brass, strings, marimba), or a loaded sample. Named options set the instrument's settings in one go.",
    examples: [
      ex("The same line on three instruments, one per bar.", `
let line = [c4 e4 g4 e4]
voice tune = cat(line.inst(keys), line.inst(pluck), line.inst(bell))`, { bars: 3 }),
      ex("Layer one line on two instruments, in different octaves, for a new combined color.", `
let line = [c4 e4 g4 e4 a4 g4 e4 d4]
voice both = stack(line.octave(-1).inst(upright), line.octave(1).inst(vibes).vel(.4))`),
      ex("Options after the name set its settings: here a synth preset with its filter changed.", `
voice acid = [a1 a1 a2 a1 c2 a1 g2 a1].inst(tb303, res: .6, cutoff: 600)`),
    ],
    see: ["sample", "wave", "gm"],
  },
  sample: {
    intro: "`sample(name, n)` plays notes on a sound from the sample library. Give a full name (\"bd_haus\"), a bank (\"bd\", with n picking among its sounds), or \"bank:n\". On drum names with no name it plays the bundled kit. Pitched notes play the sample higher or lower: c4 is as recorded.",
    examples: [
      ex("Drum names through the bundled kit.", `
voice kit = [kick . snare . kick kick snare .].sample()`),
      ex("A bank, with a pattern choosing which of its sounds plays.", `
voice hats = [x*8].sample("hat", n: [0 3 5 7])`),
      ex("A pitched sample: notes play it at their pitch, and `cut` stops each note when the next starts.", `
voice bass = [c4 . eb4 g4].sample("bass_voxy_c").cut(1)`),
    ],
    see: ["inst", "begin", "loopAt", "samples"],
  },
  begin: {
    intro: "`begin(x)` starts a sample partway through, from 0 (its start) to 1 (its end).",
    examples: [
      ex("Skip the first half of a loop.", `
voice loop = ["loop_amen"].begin(.5)`),
      ex("A pattern of start points makes a chopped-up rhythm from one sound.", `
voice cut = ["loop_amen"*8].begin([0 .25 .5 .125 0 .75 .5 .25]).end([.125 .375 .625 .25 .125 .875 .625 .375])`),
    ],
    see: ["end", "slice", "chop"],
  },
  end: {
    intro: "`end(x)` stops a sample at a point from 0 to 1. With `begin`, it picks out a piece.",
    examples: [
      ex("Only the first tenth of a long sound: a short stab.", `
voice stab = ["ambi_choir" . . "ambi_choir"].end(.1)`),
      ex("A pattern of end points: hits that get longer.", `
voice drum = ["loop_amen"*4].end([.05 .1 .2 .3])`),
    ],
    see: ["begin", "slice"],
  },
  speed: {
    intro: "`speed(x)` sets a sample's playback rate. 2 is an octave up and twice as fast, 0.5 an octave down, and a negative speed plays it backwards.",
    examples: [
      ex("A loop played backwards.", `
voice back = ["loop_amen"].loopAt(2).speed(-1)`, { bars: 2 }),
      ex("A pattern of speeds: the same hit at different pitches.", `
voice perc = ["perc_bell"*4].speed([1 1.5 2 .75])`),
    ],
    see: ["accel", "loopAt"],
  },
  accel: {
    intro: "`accel(x)` changes a sample's speed by x every second while it plays. `speed(1).accel(-1)` slows to a stop, like a tape machine switched off.",
    examples: [
      ex("A tape stop.", `
voice stop = ["loop_amen"].speed(1).accel(-1)`),
      ex("A rising sweep from one sound.", `
voice rise = ["ambi_drone"].speed(.5).accel(.5)`, { bars: 2 }),
    ],
    see: ["speed"],
  },
  cut: {
    intro: "`cut(group)` puts samples in a cut group: a new sound in the group stops the one before it, in any voice. Use it to choke an open hat with a closed one.",
    examples: [
      ex("The open hat is cut off by the next closed hat.", `
voice closed = [hat . hat . hat . hat .].sample().cut(1)
voice open   = [. ohat . . . ohat . .].sample().cut(1)`),
      ex("A long pitched sample cut by each new note, so it plays like a monophonic synth.", `
voice bass = [c4 c4 eb4 . g4 f4 . c4].sample("bass_voxy_c").cut(1)`),
    ],
    see: ["sample", "legato"],
  },
  loopAt: {
    intro: "`loopAt(bars)` makes a sample last this many bars, whatever the tempo. Add `chop` so a long loop stays in time as it plays.",
    examples: [
      ex("The amen break, stretched to two bars and chopped so it follows the tempo.", `
tempo 140
voice amen = ["loop_amen"].loopAt(2).chop(16)`, { bars: 2 }),
      ex("Change the tempo and the loop follows.", `
tempo 90
voice loop = ["loop_breakbeat"].loopAt(2).chop(8)
voice bass = [c2 . . c2 . . eb2 .].inst(bass)`, { bars: 2 }),
    ],
    see: ["chop", "splice", "speed"],
  },
  slice: {
    intro: "`slice(n, i)` cuts a sample into n equal pieces and plays piece i (from 0). With a pattern for i, it rearranges a loop.",
    examples: [
      ex("A break cut into eight and played in a new order.", `
voice beat = ["loop_amen"*8].slice(8, [0 1 0 3 4 7 6 2])`),
      ex("Random slices each step, seeded.", `
seed 5
voice glitch = ["loop_amen"*16].slice(16, dice(run(16), 16))`),
    ],
    see: ["splice", "chop", "begin"],
  },
  splice: {
    intro: "`splice(n, i)` is like `slice`, but each piece is stretched to fill its note, so a sliced loop stays in tempo at any speed.",
    examples: [
      ex("A spliced break: slices fit their steps exactly.", `
voice beat = ["loop_amen"*8].splice(8, [0 1 2 3 0 5 6 6])`),
      ex("Doubling the steps doubles the slicing; each piece is squeezed to fit.", `
voice fast = ["loop_amen"*16].splice(8, run(16))`),
    ],
    see: ["slice", "loopAt"],
  },
  chop: {
    intro: "`chop(n)` splits each note into n notes that play successive parts of its sample. With `loopAt`, a long loop follows the tempo; with other functions, it lets you treat each piece separately.",
    examples: [
      ex("A loop chopped into sixteen and stretched over two bars.", `
voice amen = ["loop_amen"].loopAt(2).chop(16)`, { bars: 2 }),
      ex("Chop, then rearrange the pieces with `rev`.", `
voice back = ["loop_amen"].loopAt(1).chop(8).rev`),
      ex("Chop, then thin out the pieces at random.", `
seed 4
voice gaps = ["loop_breakbeat"].loopAt(2).chop(16).degrade(.3)`, { bars: 2 }),
    ],
    see: ["loopAt", "slice", "ply"],
  },
  gm: {
    intro: "`gm(program)` plays notes on an instrument from a loaded SoundFont: a General MIDI program number from 1 (piano) to 128, or a name to search for. On drum names with no program it plays the bank's drum kit. It needs a `soundfont(...)` line.",
    examples: [
      ex("Piano, violin and drums from a General MIDI bank.", `
soundfont("github:mrbumpy409/GeneralUser-GS/GeneralUser-GS.sf2")
voice piano = <c4@maj a3@m f3@maj g3@maj>.gm(1)
voice tune  = [e5 . d5 c5 . . g4 .].gm("violin")
voice drums = [kick hat snare hat].gm()`, { bars: 4, live: false }),
      ex("A pattern of programs: the same line on different instruments.", `
soundfont("github:mrbumpy409/GeneralUser-GS/GeneralUser-GS.sf2")
voice tune = [c4 e4 g4 c5].gm(<1 12 25 74>)`, { bars: 4, live: false }),
    ],
    see: ["soundfont", "inst"],
  },
  dirt: {
    intro: "`dirt(sound, orbit)` sends a voice to SuperDirt, TidalCycles' sound engine, over OSC, from `tine daw` or `tine dirt`. Without a sound, sample names, drum names and instruments are translated.",
    examples: [
      ex("Drums on SuperDirt's own samples.", `
voice drums = [kick . snare .].dirt()`, { live: false }),
      ex("A SuperDirt synth for the melody, on its own orbit for separate effects.", `
voice lead = [c4 e4 g4 b4].dirt("superpiano", orbit: 1)`, { live: false }),
    ],
    see: ["midi"],
  },
  midi: {
    intro: "`midi(channel, port)` sends a voice to an external MIDI device instead of the built-in sound. In the DAW, open the MIDI tab and enable MIDI first.",
    examples: [
      ex("A bass line to a synth on channel 1.", `
voice bass = [c2 . c2 eb2 . g2 . .].midi(1)`, { live: false }),
      ex("Drums to a drum machine on channel 10, the General MIDI drum channel.", `
voice drums = {[kick*4] [. clap . clap] [. hat]*4}.midi(10)`, { live: false }),
      ex("Choose the output port by name when several devices are connected.", `
voice pad = <c3@maj7 f3@maj7>.slow(2).midi(2, port: "IAC")`, { bars: 4, live: false }),
    ],
    see: ["ctl", "program", "mpe", "as_cc"],
  },
  ctl: {
    intro: "`ctl(number, value)` sends a MIDI control change, from 0 to 1, just before each note. The value can be a pattern or a signal, to move a knob on your synth in time.",
    examples: [
      ex("Sweep a synth's filter (CC 74) with a sine.", `
voice bass = [c2*8].midi(1).ctl(74, sine(4))`, { bars: 4, live: false }),
      ex("A pattern of values, one per note.", `
voice lead = [c4 e4 g4 c5].midi(1).ctl(71, [0 .3 .6 1])`, { live: false }),
    ],
    see: ["as_cc", "midi", "cc"],
  },
  program: {
    intro: "`program(n)` chooses an instrument on external gear with a MIDI program change, 1 to 128 as General MIDI lists number them. It is sent only when it changes.",
    examples: [
      ex("Piano on channel 1.", `
voice keys = [c4@maj7 . a3@m7 .].midi(1).program(1)`, { live: false }),
      ex("Switch instruments each bar with a pattern.", `
voice tune = [c4 e4 g4 c5].midi(1).program(<1 25 41>)`, { bars: 3, live: false }),
    ],
    see: ["midi", "gm"],
  },
  as_cc: {
    intro: "`as_cc(number, rate)` turns a voice of numbers from 0 to 1 into MIDI control changes instead of notes. A signal is sampled `rate` times per bar. It is automation as its own voice.",
    examples: [
      ex("A slow filter sweep as its own voice.", `
voice sweep = sine(4).as_cc(74).midi(1)
voice bass  = [c2*8].midi(1)`, { bars: 4, live: false }),
      ex("A stepped pattern of values, sent as CC 1 (the mod wheel).", `
voice mod = [0 .25 .5 1].as_cc(1).midi(1)`, { live: false }),
    ],
    see: ["ctl", "cc"],
  },
  mpe: {
    intro: "`mpe` sends each note on its own MIDI channel (2 to 16), so microtonal pitch bends do not collide. Use it with an MPE synth.",
    examples: [
      ex("Chords tuned a little sharp, each note bent on its own channel.", `
voice pad = <^1@9 ^6@7>.slow(2).transpose(.14).midi(1).mpe`, { bars: 4, live: false }),
      ex("A 31-tone line with chords, sent to an MPE synth.", `
key c edo(31, [0 5 10 13 18 23 28])
voice keys = <^1@7 ^4@7 ^5@7>.midi(1).mpe`, { bars: 3, live: false }),
    ],
    see: ["midi", "edo"],
  },
  soundfont: {
    intro: "`soundfont(source)` loads a SoundFont 2 (.sf2) bank, as a line of its own: a file next to the piece, a URL, or \"github:user/repo/path.sf2\". Then `.gm()` plays its instruments. Only the first such line is used.",
    examples: [
      ex("Load a free General MIDI bank from GitHub and play a piano.", `
soundfont("github:mrbumpy409/GeneralUser-GS/GeneralUser-GS.sf2")
voice piano = <c4@maj a3@m f3@maj g3@maj>.gm(1)`, { bars: 4, live: false }),
      ex("A file next to the piece works the same way.", `
soundfont("GeneralUser-GS.sf2")
voice strings = <c3@maj7 f3@maj7>.gm("strings")`, { bars: 2, live: false }),
    ],
    see: ["gm", "samples"],
  },
  samples: {
    intro: "`samples(source)` loads a sample pack, as a line of its own: a folder (from the command line), the URL of a strudel.json sample map, or \"github:user/repo\" for that repository's map. Sounds download the first time they play.",
    examples: [
      ex("Load the TidalCycles sample set and play its banks.", `
samples("github:tidalcycles/dirt-samples")
voice beat = ["bd" "hh" "sn" "hh"]`, { live: false }),
      ex("A pack's banks replace bundled banks of the same name; pick sounds with n.", `
samples("github:tidalcycles/dirt-samples")
voice hats = [x*8].sample("hh", n: [0 1 2 3])`, { live: false }),
    ],
    see: ["sample", "soundfont"],
  },
  cc: {
    intro: "`cc(number, channel)` is a live signal, 0 to 1, from a knob or fader on a MIDI controller. Use it anywhere a number goes, through `range`. With no controller connected it reads 0.",
    examples: [
      ex("Knob 74 opens the filter.", `
voice acid = [^1 ^1 ^8 ^1 ^b3 ^1 ^5 ^b7].fast(2).octave(-2).inst(saw).cutoff(cc(74).range(200, 5000)).res(.7)`, { live: false }),
      ex("A fader controls how much of a part plays.", `
voice hats = [hat*16].degrade(cc(71))`, { live: false }),
    ],
    see: ["held", "ctl"],
  },
  held: {
    intro: "`held(steps)` is the chord you are holding on a MIDI keyboard, sampled `steps` times per bar. Follow it with `arp` and you have an arpeggiator. With nothing held it is silent.",
    examples: [
      ex("An arpeggiator: whatever you hold, in sixteenths, up and down.", `
voice hands = held(16).arp("updown").inst(pluck).vel(.6)`, { live: false }),
      ex("Your chord, strummed on each beat, with a bass from its root.", `
voice chords = held(4).strum.inst(keys)
voice bass   = held(4).root.octave(-2).inst(bass)`, { live: false }),
    ],
    see: ["cc", "arp"],
  },
};
