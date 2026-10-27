# Vendored neural detector

- `adtof/`: ADTOF Frame_RNN drum transcription model converted to ONNX (Zehren, Alunno, Bientinesi), licence CC BY-NC-SA 4.0: NON-COMMERCIAL use only. See `adtof/NOTICE.md`. If Studio is ever distributed commercially, remove this folder; the "Detect (neural)" button then falls back to the rule detector.
- `ort/`: onnxruntime-web 1.22.0 (MIT), WASM backend, single thread.
Both are loaded only when the user presses "Detect (neural)".
