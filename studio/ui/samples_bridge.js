import {readWavMarkers} from '../model/wav.js';
// Only a frozen, explicitly approved WAV crosses the Samples -> device-tools boundary.
export const SAMPLES_BRIDGE = 'cubreak-samples-device-v1';
export const MAX_ARTIFACT_BYTES = 6_000_000;
export function validArtifact(message) {
 return Boolean(message && message.protocol === SAMPLES_BRIDGE && message.type === 'stage' && typeof message.id === 'string' && message.id.length > 0 && message.id.length <= 100 && typeof message.name === 'string' && message.name.length > 0 && message.name.length <= 240 && message.bytes instanceof ArrayBuffer && message.bytes.byteLength >= 44 && message.bytes.byteLength <= MAX_ARTIFACT_BYTES);
}
export function validateArtifactBytes(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<44||bytes.length>MAX_ARTIFACT_BYTES)throw new Error('Invalid snapshot byte count.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),tag=at=>String.fromCharCode(...bytes.subarray(at,at+4));
 if(tag(0)!=='RIFF'||tag(8)!=='WAVE'||view.getUint32(4,true)+8!==bytes.length)throw new Error('Invalid snapshot RIFF bounds.');
 let fmt=0,data=0,frames=0,channels=0;for(let at=12;at<bytes.length;){if(at+8>bytes.length)throw new Error('Truncated snapshot chunk.');const size=view.getUint32(at+4,true),body=at+8,end=body+size;if(end+(size&1)>bytes.length)throw new Error('Truncated snapshot chunk body.');if(tag(at)==='fmt '){if(++fmt!==1||size<16||view.getUint16(body,true)!==1||view.getUint16(body+14,true)!==16||view.getUint32(body+4,true)!==48000)throw new Error('Snapshot must be 48 kHz PCM16.');channels=view.getUint16(body+2,true);if(![1,2].includes(channels)||view.getUint16(body+12,true)!==channels*2||view.getUint32(body+8,true)!==48000*channels*2)throw new Error('Invalid snapshot channels/block alignment.');}if(tag(at)==='data'){if(++data!==1||!channels||size%(channels*2))throw new Error('Invalid snapshot PCM data.');frames=size/(channels*2);}at=end+(size&1);}
 const marks=readWavMarkers(bytes);
 if(marks?.chopperBank){
  const bars=marks.beats/4,count=bars*2;
  if(marks.chopperBank.cuePolicy!=='half-bar-grid-v1'||marks.timeNumerator!==4||marks.timeDenominator!==4
   ||!Number.isInteger(bars)||bars<1||bars>32||!Number.isFinite(marks.bpm)||marks.bpm<=0
   ||Math.abs(frames-marks.beats*60/marks.bpm*48000)>2||marks.oneShot||marks.playMode||marks.playFilter
   ||marks.chopperBank.patterns.some(p=>p.events.some(e=>e.src>=count)))throw new Error('Chopper snapshot requires a compatible v3 bank and verified 4/4 source timing.');
 }
 if(fmt!==1||data!==1||!frames||frames>1440000||!marks||marks.warnings.length||marks.unsupportedAcidFlags||marks.metadata.unknownChunks.length||marks.metadata.pvxo||marks.slices.length>64||marks.slices.some((n,i,a)=>n<0||n>=frames||(i>0&&n<=a[i-1]))||marks.metadata.pvxp&&!marks.breakBank&&marks.chopperBank?.cuePolicy!=='half-bar-grid-v1')throw new Error('Invalid or unsupported snapshot metadata; use the byte-exact original for unknown chunks.');return marks;
}
export function mountSamplesBridge({frame,stage,navigate,window:win=window}) {
 let busy=false;const completed=new Map();
 const receive=async event=>{
  if(event.source!==frame.contentWindow||event.origin!==win.location.origin||win.location.protocol==='file:'||!validArtifact(event.data))return;
  const request=event.data,reply=(ok,error)=>event.source.postMessage({protocol:SAMPLES_BRIDGE,type:'staged',id:request.id,ok,error},event.origin);
  if(completed.has(request.id)){const result=completed.get(request.id);reply(result.ok,result.error);return;}
  if(busy){reply(false,'Another source is being staged. Retry after it finishes.');return;}
  busy=true;
  try{validateArtifactBytes(new Uint8Array(request.bytes));await stage(new File([request.bytes],request.name,{type:'audio/wav'}));completed.set(request.id,{ok:true});reply(true);navigate();}
  catch(error){const message=error?.message||String(error);completed.set(request.id,{ok:false,error:message});reply(false,message);}
  finally{busy=false;if(completed.size>32)completed.delete(completed.keys().next().value);}
 };
 win.addEventListener('message',receive);return ()=>win.removeEventListener('message',receive);
}
