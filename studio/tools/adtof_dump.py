import json,numpy as np,soundfile as sf,onnxruntime as ort
s=ort.InferenceSession("m/adtof_frame_rnn.onnx")
T=json.load(open('/tmp/wt_codex2/studio/tools/gen_loops/truth.json'))['loops']
out={}
for l in T:
    x,sr=sf.read(l['file'],dtype='float32');x=x.mean(1) if x.ndim>1 else x
    n=int(len(x)*44100/sr);x=np.interp(np.linspace(0,len(x)-1,n),np.arange(len(x)),x).astype('float32')
    a=s.run(None,{'waveform':x[None]})[0][0]
    out[l['file']]=np.round(a,3).tolist()
json.dump(out,open('act.json','w'));print(len(out))
