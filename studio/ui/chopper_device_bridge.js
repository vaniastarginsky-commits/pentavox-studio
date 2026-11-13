// Separate experimental protocol: does not alter the legacy staging bridge.
import {MAX_BANK_BYTES} from '../model/chopper_event_bank.js';
export const CHOPPER_DEVICE_PROTOCOL='pentavox-chopper-device-v1';
const TYPES=new Set(['capabilities','list-samples','upload-sample','download-sample','download-pattern','upload-pattern','convert-pattern']);
export function mountChopperDeviceBridge({frame,request,window:win=window}){
 let busy=false;const completed=new Map();
 const receive=async event=>{
  const message=event.data;
  if(event.source!==frame.contentWindow||event.origin!==win.location.origin||win.location.protocol==='file:'||message?.protocol!==CHOPPER_DEVICE_PROTOCOL||!TYPES.has(message.type)||typeof message.id!=='string'||message.id.length<1||message.id.length>100)return;
  if(message.type==='upload-sample'&&(!(message.bytes instanceof ArrayBuffer)||message.bytes.byteLength>6_000_000))return;
  // A pattern arrives as an encoded bank, as the editor's document plus the loop it was authored against, or as a
  // legacy PVXP bank plus the slice geometry it was cut on. All three are bounded here, so an absurd frame never
  // reaches the service, and the document keeps the editor's own 1 MB import limit.
  if(message.type==='upload-pattern'||message.type==='convert-pattern'){
   const encoded=message.bytes instanceof ArrayBuffer&&message.bytes.byteLength<=MAX_BANK_BYTES;
   const legacy=Array.isArray(message.sliceStartFrames)&&Number.isFinite(message.bpm);
   const document=!(message.bytes instanceof ArrayBuffer)&&Array.isArray(message.patterns)&&message.source!==null&&typeof message.source==='object'&&JSON.stringify([message.patterns,message.source]).length<=1_000_000;
   // A legacy bank needs its geometry (a slice number without the loop's slice positions is meaningless), an
   // editor document needs its authored loop, and an already encoded bank needs nothing else.
   if(message.type==='convert-pattern'){ if(!encoded||!legacy)return; }
   else {
    const banks=Array.isArray(message.banks)&&message.banks.length>=1&&message.banks.length<=2&&message.banks.every(b=>
     (b?.slot===0||b?.slot===1)&&((b.bytes instanceof ArrayBuffer&&b.bytes.byteLength<=MAX_BANK_BYTES)||
     (Array.isArray(b.patterns)&&b.source!==null&&typeof b.source==='object'&&JSON.stringify([b.patterns,b.source]).length<=1_000_000)));
    if(!encoded&&!document&&!banks)return;
   }
  }
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
