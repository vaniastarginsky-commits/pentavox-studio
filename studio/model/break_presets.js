// Ready-made break patterns. Each preset is a groove written on a 16-step grid per bar and per role (K kick, S snare, H hat / small
// hit); the pattern takes the file's own kicks, snares and hats by label, so the same preset fits any break you drop in. The seed only
// decides which kick / snare / hat slices are used, never the rhythm.
//
// Grid characters: X full level, x 0.8, o ghost (0.4), . nothing. Step 0 is beat 1, 4 is beat 2, 8 beat 3, 12 beat 4.
//
// `source`: 'transcription' = the step positions come from a published transcription of the record (linked in `ref`);
//           'convention'    = the standard placement of the genre (a two-step is kick 1 + kick on the "and" of 3, snare 2 and 4 ...).
import { HOME, ROLL, defaultEvent, normalizePattern } from './break_engine.js';
import { makeBag, makeRng } from './break_generators.js';
import { voices } from './break_grooves.js';

const AMP = { X: 1, x: 0.8, o: 0.4 };
const ev = (step, over) => ({ ...defaultEvent(step), ...over });

export const PRESETS = [
  {
    id: 'amen', name: 'Amen break (bars 1-2)', genre: 'Jungle', bpm: [150, 170], source: 'transcription',
    ref: 'https://drum-patterns.com/amen-break/',
    note: 'Gregory Coleman, "Amen, Brother": kick 1, "and" of 1, "and" and "a" of 3; snare 2 with ghost snares and the pick-up before beat 1.',
    bars: [{ K: 'X.X.......Xx....', S: '....X..o.o..X..x', H: '......x.x.....x.' }],
  },
  {
    id: 'amen4', name: 'Amen break (4 bars, turnaround)', genre: 'Jungle', bpm: [150, 170], source: 'transcription',
    ref: 'https://drum-patterns.com/amen-break/',
    note: 'The record\'s full phrase: bars 1-2 the groove, bar 3 loses the second kick and delays the beat-4 snare an eighth, bar 4 moves the kicks and adds a snare on the "e" of 1.',
    bars: [
      { K: 'X.X.......Xx....', S: '....X..o.o..X..x', H: '......x.x.....x.' },
      { K: 'X.X.......Xx....', S: '....X..o.o..X..x', H: '......x.x.....x.' },
      { K: 'X.X.......X.....', S: '....X..o.o....x.', H: '......x.x...x...' },
      { K: '..Xx......X.....', S: '.o..X..o.o....x.', H: 'x.....x.x...x...' },
    ],
  },
  {
    id: 'impeach', name: 'Impeach the President', genre: 'Breakbeat / hip hop', bpm: [95, 115], source: 'transcription',
    ref: 'https://drum-patterns.com/impeach-the-president/',
    note: 'The Honey Drippers: kick 1 and the three off-beat kicks around beat 3, backbeat on 2 and 4, the open hat that lifts into beat 4.',
    bars: [{ K: 'X......xX.....x.', S: '....X.......X...', H: '..x...x...x.....' }],
  },
  {
    id: 'funky', name: 'Funky Drummer', genre: 'Funk break', bpm: [95, 110], source: 'transcription',
    ref: 'https://www.drumstheword.com/free-drum-lesson-funky-drummer-best-drum-beats-ever-james-brown-clyde-stubblefield/',
    note: 'Clyde Stubblefield: kicks on the first two eighths, the kick on the "e" of 4, hat openings on the "e" of 2 and 4, ghost snares in between (the hardest one on the "a" of 3).',
    bars: [{ K: 'X.X..........x..', S: '....X..o.o.oX..o', H: '.....x..x.....x.' }],
  },
  {
    id: 'twostep', name: 'Two-step', genre: 'Drum & bass', bpm: [168, 178], source: 'convention',
    ref: 'https://unison.audio/dnb-drum-patterns/',
    note: 'The essence of drum & bass: kick on 1, the second kick pushed to the "and" of 3, snare on 2 and 4, eighth hats; the second bar adds two quiet ghost snares.',
    bars: [
      { K: 'X.........X.....', S: '....X.......X...', H: '..x...x.x.....x.' },
      { K: 'X.........X.....', S: '....X..o....X..o', H: '..x...x.x..o..x.' },
    ],
  },
  {
    id: 'roller', name: 'Roller', genre: 'Drum & bass (rolling)', bpm: [170, 176], source: 'convention',
    ref: 'https://forum.renoise.com/t/kick-hihat-mechanics-of-two-step-battle-step-tech-step-dark-step/44019',
    note: 'A rolling groove: the two-step with a syncopated kick on the "a" of 1 in the first bar and on the "and" of 1 in the second, ghosts before the snares, hats on the off-beats.',
    bars: [
      { K: 'X..x......X.....', S: '....X..o....X..o', H: '..x...x.x.....x.' },
      { K: 'X.x.......X.....', S: '....X....o..X..o', H: '.....x.x......x.' },
    ],
  },
  {
    id: 'halftime', name: 'Half-time', genre: 'Drum & bass half-time / dubstep', bpm: [140, 175], source: 'convention',
    ref: 'https://en.wikipedia.org/wiki/Half-time_(music)',
    note: 'One snare on beat 3 halves the feel; the kicks leave room around it (on 1, the "and" of 3, and a syncopated one in the second bar), the hats breathe on 2 and 4.',
    bars: [
      { K: 'X.........x.....', S: '........X.......', H: '....x.......x.o.' },
      { K: 'X......x..x.....', S: '........X......o', H: '....x.......x...' },
    ],
  },
  {
    id: 'dembow', name: 'Ragga jungle (3+3+2)', genre: 'Jungle / dancehall', bpm: [150, 165], source: 'convention',
    ref: 'https://en.wikipedia.org/wiki/Dem_bow',
    note: 'The dembow of ragga jungle: kicks on every beat, snares in the 3+3+2 grouping (steps 3, 6, 11, 14) with hats in the gaps.',
    bars: [{ K: 'x...x...x...x...', S: '...X..X....X..X.', H: '..o.......o.....' }],
  },
  {
    id: 'bossa', name: 'Euclid bossa break', genre: 'IDM / broken beat', bpm: [120, 150], source: 'convention',
    ref: 'https://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf',
    note: 'Toussaint\'s Euclidean rhythms: the kick plays the bossa-nova clave E(5,16), the hats fill the samba necklace E(7,16), and a plain backbeat holds it together.',
    bars: [
      { K: 'X..x..x...x..x..', S: '....X.......X...', H: '.....x.x......x.' },
      { K: 'X..x..x...x..x..', S: '....X.......X..o', H: '.....x.x...o..x.' },
    ],
  },
];

export const PRESET_IDS = PRESETS.map((p) => p.id);

const span = (ctx, i) => Math.max(1, Math.round((ctx.sliceStarts[i + 1] ?? ctx.fileSteps) - ctx.sliceStarts[i]));

// The preset laid out on a file: a pattern of `bars * 16` steps.
export function presetPattern(id, ctx, seed = 1) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new RangeError(`Unknown preset ${id}`);
  const rng = makeRng(seed); const v = voices(ctx, rng, { makeBag });
  const events = [];
  preset.bars.forEach((bar, b) => {
    const taken = new Set();
    // kick and snare first: a hat never takes a step they use
    for (const role of ['K', 'S', 'H']) {
      for (let i = 0; i < 16; i += 1) {
        const ch = bar[role][i]; if (ch === '.' || taken.has(i)) continue;
        const amp = AMP[ch]; taken.add(i);
        const step = b * 16 + i;
        const ghost = ch === 'o';
        const src = role === 'K' ? v.K.main : role === 'S' ? (ghost ? v.G.next() : v.S.main) : v.H.next();
        const natural = src >= 0 ? span(ctx, src) : 1;
        events.push(ev(step, { src, len: role === 'H' || ghost ? 1 : Math.min(natural, 4), amp0: amp, amp1: amp }));
      }
    }
  });
  return normalizePattern({ steps: preset.bars.length * 16, events });
}
