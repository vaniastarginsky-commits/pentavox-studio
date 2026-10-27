"""Dump Frame_RNN activations for the noisy-reference card loops."""
import glob, json
import numpy as np
import onnxruntime as ort
import soundfile as sf

session = ort.InferenceSession('/tmp/adtof/m/adtof_frame_rnn.onnx')
out = {}
for path in sorted(glob.glob('/tmp/cardloops/*.wav')):
    audio, sample_rate = sf.read(path, dtype='float32')
    if audio.ndim > 1:
        audio = audio.mean(1)
    count = int(len(audio) * 44100 / sample_rate)
    audio = np.interp(np.linspace(0, len(audio) - 1, count), np.arange(len(audio)), audio).astype('float32')
    activations = session.run(None, {'waveform': audio[None]})[0][0]
    out[path] = np.round(activations, 3).tolist()
json.dump(out, open('studio/tools/act_cardloops.json', 'w'))
print(len(out))
