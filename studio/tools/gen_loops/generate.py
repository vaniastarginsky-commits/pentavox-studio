#!/usr/bin/env python3
"""Generate deterministic two-bar Battery-sample drum-loop benchmarks.

Only Python's standard library and numpy are used.  The two corpus splits use
disjoint Battery kits, so tuning cannot memorize held-out one-shots.
"""
from __future__ import annotations
import json, math, re, struct, wave
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "seed.json").read_text())
ROOT = Path(CFG["sourceRoot"])
OUT = Path("/tmp/loopgen_out")
SR = int(CFG["sampleRate"])
CLASSES = ("kick", "snare", "hat", "tom", "cymbal", "perc")

def kind(name: str):
    s = name.lower()
    rules = [
        ("kick", r"kick|\bkik|_k\b|_bot_k\b|bd\b|bass.?drum"),
        ("snare", r"snare|\bsnr|_sn\b|_bot_sn\b|acs?n|elsn"),
        ("hat", r"hat|hh|clhat|ophat|hihat|hi.?hat|pedal"),
        ("tom", r"tom|\btm\b|fltm|mdtm|\bht\s*\d|low 909"),
        ("cymbal", r"cym|crash|ride|splash|china|\brd\b"),
        ("perc", r"clap|rim|perc|impact|metal|tap|cow|bell|ago|mar|shak|bong|stick|block|drip|zap|noise|ns\b|tone|robot|fart|vbr|cbs|wh"),
    ]
    for k, pattern in rules:
        if re.search(pattern, s): return k
    return None

def read_wav(path: Path):
    try:
        with wave.open(str(path), "rb") as w:
            ch, width, rate, count = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
            raw = w.readframes(count)
    except (wave.Error, EOFError): return None
    if width == 1: data = (np.frombuffer(raw, np.uint8).astype(np.float32) - 128) / 128
    elif width == 2: data = np.frombuffer(raw, "<i2").astype(np.float32) / 32768
    elif width == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3); v = b[:,0].astype(np.int32) | (b[:,1].astype(np.int32)<<8) | (b[:,2].astype(np.int32)<<16)
        data = ((v ^ 0x800000) - 0x800000).astype(np.float32) / 8388608
    elif width == 4: data = np.frombuffer(raw, "<i4").astype(np.float32) / 2147483648
    else: return None
    data = data[:len(data)//ch*ch].reshape(-1, ch).mean(axis=1)
    if rate != SR and len(data):
        n = round(len(data) * SR / rate); data = np.interp(np.arange(n) * rate / SR, np.arange(len(data)), data).astype(np.float32)
    # Remove leading digital silence, but retain 1 ms of natural pre-attack.
    nz = np.flatnonzero(np.abs(data) > max(1e-4, float(np.max(np.abs(data))) * 0.003))
    if len(nz): data = data[max(0, int(nz[0]) - SR//1000):]
    return data

def library(set_names):
    result = {k: [] for k in CLASSES}
    for set_name in set_names:
        for p in sorted((ROOT / set_name).glob("*.wav")):
            k = kind(p.name)
            if k:
                audio = read_wav(p)
                if audio is not None and len(audio) > 64: result[k].append((p, audio))
    missing = [k for k,v in result.items() if not v]
    if missing: raise RuntimeError(f"sample sets {set_names} lack classes: {missing}")
    return result

def write_wav(path, audio):
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.round(np.clip(audio, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def render(index, split, lib, rng):
    bpm = int(rng.integers(160, 176)) if index % 5 else int(rng.integers(90, 131))
    beat = 60 / bpm; duration = 8 * beat
    dry = np.zeros(round(duration * SR), np.float64); events = []
    swing = float(rng.uniform(0.05, 0.16)); used = set()
    def time_at(step):
        t = step * beat / 4
        if step % 2: t += swing * beat / 4
        return t
    def put(step, cls, vel, ghost=False, offset=0.0, layer=False):
        t = time_at(step) + offset + float(rng.uniform(-0.004, 0.004))
        if not (0 <= t < duration - .015): return
        p, sample = lib[cls][int(rng.integers(len(lib[cls])))]
        start = round(t * SR); voice = sample.astype(np.float64) * vel
        # Sidechain-like envelope for ringing layers beneath a new kick.
        if cls == "kick":
            end = min(len(dry), start + round(.065*SR)); dry[start:end] *= np.linspace(.62, 1, end-start)
        end = min(len(dry), start + len(voice)); dry[start:end] += voice[:end-start]
        # Independent humanisation makes nominally layered voices a few ms apart.
        # They are one perceptual onset, not two impossible-to-match truths.
        nearby = next((e for e in events if abs(e["onsetSample"] - start) < round(.010 * SR)), None)
        if not layer:
            event={"onsetSample":start,"class":cls,"ghost":bool(ghost),"source":f"{p.parent.name}/{p.name}"}
            if nearby is None: events.append(event)
            elif nearby["class"] in ("hat","cymbal") and cls not in ("hat","cymbal"): nearby.update(event)
    for bar in range(2):
        base = bar * 16
        # Broken 8th/16th hats; openings ring through following drums.
        for s in range(0, 16, 2):
            if rng.random() > .10: put(base+s, "hat", rng.uniform(.13,.30), layer=(s in (0,4,12)))
        for s in rng.choice(np.arange(1,16,2), size=int(rng.integers(2,5)), replace=False): put(base+int(s), "hat", rng.uniform(.07,.17))
        put(base, "kick", rng.uniform(.72,.98)); put(base+4, "snare", rng.uniform(.72,.98)); put(base+12, "snare", rng.uniform(.72,.98))
        for s in rng.choice([2,6,7,8,9,10,14,15], size=int(rng.integers(2,5)), replace=False): put(base+s, "kick", rng.uniform(.35,.75))
        # double kick and low ghost snare; 1/16 apart and syncopated.
        if rng.random()<.75: put(base+int(rng.choice([6,9,14])), "kick", rng.uniform(.28,.55)); put(base+int(rng.choice([7,10,15])), "kick", rng.uniform(.25,.50))
        for s in rng.choice([3,6,7,10,11,14,15], size=int(rng.integers(1,4)), replace=False): put(base+int(s), "snare", rng.uniform(.12,.28), ghost=True)
        # flams 12-22 ms apart, rolls and second-bar tom fills.
        if rng.random()<.7: put(base+int(rng.choice([4,12])), "snare", rng.uniform(.18,.35), ghost=True, offset=-rng.uniform(.012,.022))
        if bar==1:
            for s in rng.choice([13,14,15], size=int(rng.integers(1,4)), replace=False): put(base+int(s), "tom", rng.uniform(.35,.68))
        if rng.random()<.42: put(base+int(rng.choice([3,5,9,11])), "perc", rng.uniform(.25,.55))
        if bar==0 and rng.random()<.55: put(base, "cymbal", rng.uniform(.22,.44), layer=True)
        if rng.random()<.25: put(base+8, "cymbal", rng.uniform(.16,.32))
    # Short room plus diffuse tail.
    wet = dry.copy()
    for delay,gain in ((.013,.10),(.027,.07),(.043,.05),(.071,.028)):
        d=round(delay*SR); wet[d:] += dry[:-d]*gain
    # Vinyl bed and subtle 50/60 Hz hum.
    wet += rng.normal(0, .0017, len(wet)) + .0008*np.sin(2*np.pi*50*np.arange(len(wet))/SR)
    # Soft bus saturation/compression (monotone, preserves exact onsets).
    wet = np.tanh(wet*1.35); peak=max(.001,float(np.max(np.abs(wet)))); wet *= .94/peak
    events.sort(key=lambda x:x["onsetSample"])
    name=f"{split}_{index:02d}_{bpm}bpm.wav"; write_wav(OUT/split/name,wet)
    return {"file": str((OUT/split/name).resolve()), "split": split, "bpm": bpm, "bars":2, "sampleRate":SR, "samples":len(wet), "events":events}

def main():
    OUT.mkdir(parents=True, exist_ok=True); all_loops=[]
    specs=(("tune",CFG["tuneLoops"],CFG["tuneSets"]),("heldout",CFG["heldoutLoops"],CFG["heldoutSets"]))
    for split,count,sets in specs:
        lib=library(sets); print(split, {k:len(v) for k,v in lib.items()})
        for i in range(count): all_loops.append(render(i,split,lib,np.random.default_rng(CFG["seed"]+(0 if split=="tune" else 10000)+i)))
    truth={"schema":1,"seed":CFG["seed"],"classes":list(CLASSES),"sourceRoot":str(ROOT),"splits":{"tune":CFG["tuneSets"],"heldout":CFG["heldoutSets"]},"loops":all_loops}
    (HERE/"truth.json").write_text(json.dumps(truth,indent=2)+"\n")
    print(f"wrote {len(all_loops)} loops, {sum(len(x['events']) for x in all_loops)} events")

if __name__ == "__main__": main()
