# iNit-Crioxica FM banks

Four 32-voice banks extracted without changing packed voice bytes from:
https://archive.org/details/i-nit-crioxica-plaits-firmware

Configuration: `init-crioxica-plaits-firmware-2077.plaits-palette.json`
SHA-256: `18f8f806a1d4b1be0b1b809e63e86493540cebc48363708161c743a44e684a3b`

Credit: iNit-Crioxica (selection/assembly). The Archive item is marked Public
Domain Mark 1.0 by its uploader; the embedded bank metadata says `Local`, not MIT.
These labels do not establish authorship of every underlying DX7 patch.

Studio loads `dx7-community-banks.json` as optional library data. Select a bank
under **DX7 banks → Start from → Community banks**, preview it, then assign it to
any of the six SD banks A–F. Existing drafts, stock banks and SD contents are not
replaced automatically. Duplicate voices are shown once in the library, while
source bank ordering is preserved. No firmware DSP or default palette changes.

The HEX/WAV firmware, editor preferences, engine list and factory resources were
not imported. Three custom terrain models are preserved separately under
`tools/palette/resources/` and offered in the Studio Wave Terrain editor.
Adding a terrain includes its sampled data in the next BUILD.
