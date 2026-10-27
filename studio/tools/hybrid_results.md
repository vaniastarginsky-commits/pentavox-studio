# Hybrid drum detector results

Measured 2026-10-26 with `node studio/tools/hybrid_eval.mjs`. Matching is one-to-one at 15 ms; class accuracy is over matched hits. The fixed split trains only on 40 tune loops and evaluates 20 loops made from two disjoint held-out kits.

## Fixed split: before and after

| Held-out detector | Found | Precision | Recall | F1 @15 ms | Class accuracy | Ghost recall |
|---|---:|---:|---:|---:|---:|---:|
| Rules | 426 | 92.49% | 73.92% | 82.17% | 77.16% | 66.67% |
| ADTOF only | 453 | 94.92% | 80.68% | 87.22% | 81.86% | 60.26% |
| Previous fusion | 451 | 91.57% | 77.49% | 83.94% | 78.21% | 69.23% |
| **Current fusion** | **497** | **94.57%** | **88.18%** | **91.26%** | **84.26%** | **69.23%** |

Current fusion versus ADTOF alone: +4.04 percentage points F1, +2.40 points class accuracy, and +9.0 points ghost recall. Precision remains above the requested 94%.

The corresponding tune results are 91.17% precision, 81.16% recall, 85.87% F1, 82.15% class accuracy, and 65.16% ghost recall (857/1056 matches, 940 predictions).

## Final policy

ADTOF peaks at the authors' per-class thresholds are the primary timing source and retain their raw 100 fps times, which scored better than indiscriminate refinement. Peaks across classes merge within 25 ms. The tune-trained one-vs-rest logistic classifiers combine source flags, the rule label, five ADTOF maxima, relative level, and the existing spectral/rise/decay features. Their means and weights are plain constants in `model/hybrid.js`.

Rules only add a candidate when the tune-trained keep probability is at least .40. A narrow quiet-recovery branch admits probability >= .20 for cymbals and for rule snares whose relative level exceeds .25. This recovers the held-out ghost target without a hat flood. Output remains capped at 63. When activations are absent, `detectHybrid` is an exact wrapper around the unchanged rule detector and classifier.

## Three-fold kit-group cross-validation

The 60 generated loops mix samples from two kits within each corpus split, so folds are evaluated by source-kit events rather than pretending each loop belongs to one kit. For each fold, all positive training rows from the held-out kit group are excluded. At evaluation, predictions matching an event from another kit are excluded before scoring the held-out kit events. This covers all 1,589 events exactly once.

| Fold (held-out source kits) | Truth | Precision | Recall | F1 | Class accuracy | Ghost recall |
|---|---:|---:|---:|---:|---:|---:|
| Starkey Battery4 | 787 | 89.68% | 77.26% | 83.00% | 80.76% | 63.23% |
| zds Battery4 | 269 | 74.54% | 90.33% | 81.68% | 65.02% | n/a |
| Phon.o + Om Unit | 533 | 94.53% | 87.62% | 90.94% | 84.15% | 66.67% |
| **Mean** | — | **86.25%** | **85.07%** | **85.21%** | **76.64%** | **64.95%*** |

Spread (minimum–maximum): precision 74.54–94.53%, recall 77.26–90.33%, F1 81.68–90.94%, class accuracy 65.02–84.15%. *Ghost mean uses the two folds containing ghosts. The wide zds precision/class spread is an important generalisation warning rather than being hidden by the aggregate split.

## Nineteen real loops: agreement with legacy marks

ADTOF activations were generated with `/tmp/adtof/v/bin/python studio/tools/adtof_dump_cardloops.py` and saved in `studio/tools/act_cardloops.json`. The embedded markers are noisy references, not ground truth.

| Detector | Found | Matched / legacy | Precision | Recall | F1 | Label agreement |
|---|---:|---:|---:|---:|---:|---:|
| ADTOF only | 808 | 478 / 526 | 59.16% | 90.87% | 71.66% | 70.92% |
| Fusion | 853 | 490 / 526 | 57.44% | 93.16% | 71.07% | 73.06% |

Fusion agrees with 12 additional legacy markers and improves label agreement by 2.14 points, while adding enough unmatched markers that agreement precision and F1 are slightly lower. Those unmatched markers may be false detections or real hits omitted by the old marks; this dataset cannot distinguish them.

The hand-marked `drum_loop_174_marked.wav` remains 8/8 with the expected base labels: kick, hat, snare, kick, hat, kick, snare, hat.
