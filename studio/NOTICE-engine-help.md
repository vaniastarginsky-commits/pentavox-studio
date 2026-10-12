# Engine help text and icons

`engine_help.json` (descriptions, knob labels and per-knob/output/trigger prose) and the PNGs in
`assets/engine-icons/` come from Rubato Audio's open catalog:
https://github.com/lylepmills/eurorack/tree/master/alt_firmwares/plaits_lab_catalog
(`catalog.json`, `model-icons/`), used with the author's permission. The repository is MIT-licensed
for its STM32F code (see https://github.com/pichenettes/eurorack#license).
Original Plaits symbols and panel artwork: Mutable Instruments / Papernoise Design.
Engine ids are mapped onto this repo's `tools/palette/catalog.json` by `import_lab_catalog.py`
(`python3 studio/import_lab_catalog.py <catalog.json> tools/palette/catalog.json studio/engine_help.json`).

The 29 Rubato Labs model marks in `assets/engine-icons/*.svg` (Scanned, Pulsar, Loopback, ...) were copied from
the inline SVG on https://rubato.audio/plaits-palette/ on 2026-10-05 with the author's permission (relayed by the
project owner); the tile colour is the page's `--artwork-color` for each model.
