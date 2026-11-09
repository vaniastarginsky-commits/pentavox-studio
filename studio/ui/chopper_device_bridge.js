// Separate experimental protocol: does not alter the legacy staging bridge.
export const CHOPPER_DEVICE_PROTOCOL='pentavox-chopper-device-v1';
const TYPES=new Set(['capabilities','list-samples','upload-sample','download-sample','download-pattern']);
export function mountChopperDeviceBridge({frame,request,window:win=window}){
 let busy=false;const completed=new Map();
 const receive=async event=>{
  const message=event.data;
  if(event.source!==frame.contentWindow||event.origin!==win.location.origin||win.location.protocol==='file:'||message?.protocol!==CHOPPER_DEVICE_PROTOCOL||!TYPES.has(message.type)||typeof message.id!=='string'||message.id.length<1||message.id.length>100)return;
  if(message.type==='upload-sample'&&(!(message.bytes instanceof ArrayBuffer)||message.bytes.byteLength>6_000_000))return;
  const reply=result=>event.source.postMessage({protocol:CHOPPER_DEVICE_PROTOCOL,id:message.id,type:'result',...result},event.origin);
  if(completed.has(message.id)){reply(completed.get(message.id));return;}
  if(busy){reply({ok:false,error:'Another device operation is in progress.'});return;}
  busy=true;let result;
  try{result={ok:true,value:await request(message)};}catch(error){result={ok:false,error:error?.message||String(error)};}
  finally{busy=false;}
  // Bounded deduplication prevents an upload retry with the SAME request ID
  // creating a second numbered file. New explicit actions get new IDs.
  completed.set(message.id,result);while(completed.size>8)completed.delete(completed.keys().next().value);reply(result);
 };
 win.addEventListener('message',receive);return()=>win.removeEventListener('message',receive);
}
