# Real-sample loop benchmark

Run `python3 studio/tools/gen_loops/generate.py`. It deterministically renders
40 tune and 20 held-out two-bar loops to `/tmp/loopgen_out`, then writes exact
sample-index truth to `truth.json`. The splits use disjoint Battery 4 kits.

The renderer builds syncopated jungle/D&B and slower breaks with ghosts,
flams, rolls, fills, double kicks, humanisation, swing, ringing layers, room,
ducking, bus saturation, and vinyl noise. `detect_eval.mjs` consumes the files.
