// Experimental unified-workspace adapter. Uses the EXISTING HostLink filesystem
// client; never opens another serial port and never labels staging as upload.
import {SdFilesClient} from './sd_files.js';
import {loopFiles,loopFileName,loopIoVersion} from './loop_io.js';
import {decodeChopperBank} from './chopper_bank.js';
import {decodeBank,encodeBank,bankFromEditor,MAX_BANK_BYTES} from './chopper_event_bank.js';
import {convertLegacyBank,describeConversion} from './chopper_legacy_convert.js';
import {validateArtifactBytes,MAX_ARTIFACT_BYTES} from '../ui/samples_bridge.js';

export function validChopperDevicePath(path,kind){
 return typeof path==='string'&&(kind==='sample'?/^\/LOOPS\/(?!0000)\d{4}\.WAV$/i.test(path):/^\/CHOPPER\/[AB]\.PVXP$/i.test(path));
}
// A PVXE bank is a 32 byte envelope plus at least one pattern header; anything shorter cannot be valid.
const HEADER_MIN=33;
export class ChopperDeviceService {
 constructor({getClient,getInfo,getDescriptor,runJob=async(_label,job)=>job(),makeFiles=(client,info)=>new SdFilesClient(client,info)}){Object.assign(this,{getClient,getInfo,getDescriptor,runJob,makeFiles});}
 owner(){const client=this.getClient(),info=this.getInfo(),descriptor=this.getDescriptor();if(!client||!info)throw Error('Connect the module using the existing Studio connection first.');return {client,info,descriptor,files:this.makeFiles(client,info)};}
 async request(request){
  const owner=this.owner(),{files,descriptor}=owner;
  // No command is invented for new REL/ABS. Filesystem access is verified by
  // FS_INFO, rather than inferred from the existence of a Javascript method.
  return this.runJob('Chopper device files',async()=>{
   const card=await files.cardInfo();if(!card.mounted||card.busy)throw Error('Device SD card is unavailable or busy.');
   if(owner.client!==this.getClient()||owner.info!==this.getInfo())throw Error('Connection changed; retry.');
   const loops=loopIoVersion(descriptor)>0;
   const patternStores=descriptor?.chopper?.pvxeFile===1,patternLive=descriptor?.pvxeUpload?.playable===true;
   if(request.type==='capabilities')return {sampleUpload:loops,sampleDownload:loops,legacyPatternDownload:descriptor?.chopper?.cueFileVersion===1,newPatternUpload:patternStores||patternLive,patternFileStorage:patternStores,patternLiveUpload:patternLive,reason:patternStores||patternLive?'This firmware accepts a PVXE pattern bank and stores it per slot; the legacy PVXP bank keeps its own file and semantics.':'REL/ABS pattern upload requires compatible firmware; current PVXP v1–v4 is not reinterpreted.'};
   if(request.type==='list-samples'){
    if(!loops)throw Error('This firmware does not advertise loop I/O.');
    return {files:loopFiles(await files.list('/LOOPS')).filter(file=>file.size<=MAX_ARTIFACT_BYTES)};
   }
   if(request.type==='upload-sample'){
    if(!loops)throw Error('This firmware does not advertise loop I/O.');
    if(!(request.bytes instanceof ArrayBuffer))throw Error('Expected a prepared WAV.');
    const bytes=new Uint8Array(request.bytes);const metadata=validateArtifactBytes(bytes);
    if(!Number.isFinite(metadata.bpm)||metadata.bpm<20||metadata.bpm>400||!Number.isInteger(metadata.beats)||metadata.beats<4||metadata.beats%4||metadata.timeNumerator!==4||metadata.timeDenominator!==4)throw Error('Prepared sample requires verified whole-bar 4/4 BPM timing.');
    let frames=0;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let channels=0;for(let at=12;at<bytes.length;){const tag=String.fromCharCode(...bytes.subarray(at,at+4)),size=view.getUint32(at+4,true);if(tag==='fmt ')channels=view.getUint16(at+10,true);if(tag==='data')frames=size/(channels*2);at+=8+size+(size&1);}if(Math.abs(frames-metadata.beats*60/metadata.bpm*48000)>2)throw Error('Prepared sample BPM does not match its PCM duration.');
    if(metadata.chopperBank||metadata.breakBank)throw Error('Upload a separately prepared BPM-only sample; legacy banks are independent.');
    let entries=[];try{entries=await files.list('/LOOPS');}catch(error){if(error?.status!==12)throw error;}
    const existing=loopFiles(entries),number=existing.reduce((highest,file)=>Math.max(highest,file.number),0)+1;
    if(number>9999)throw Error('No free loop number after the existing files. Nothing was overwritten.');
    const path=`/LOOPS/${loopFileName(number)}`;
    await files.upload(path,bytes,{overwrite:false,makeParents:true});
    return {state:'uploaded',path,selected:false,audiblyActive:false};
   }
   if(request.type==='upload-pattern'||request.type==='convert-pattern'){
    // One action for both Choppers, by construction: a pattern is the pair's behaviour, so this service does not
    // offer a call that could leave slot A and slot B holding different banks.
    // Two accepted inputs, one meaning: a bank already encoded, or the editor's own patterns plus the loop they
    // were authored against. Both end as the same envelope the module checks, and the encoder is the Studio
    // model's - the editor ships no second byte-level implementation that could drift from the firmware.
    let bytes;let conversion=null;
    if(request.type==='convert-pattern'){
     // A PVXP bank and the geometry of the loop it was cut against become one PVXE bank, then travel the identical
     // route below: the legacy pattern is not a second-class upload.
     let converted;
     try{converted=convertLegacyBank({bytes:new Uint8Array(request.bytes instanceof ArrayBuffer?request.bytes:Uint8Array.from(request.bytes??[])),sliceStartFrames:request.sliceStartFrames,bpm:request.bpm,sampleRate:request.sampleRate,sourceFrames:request.sourceFrames,channels:request.channels,revision:request.revision});}
     catch(error){throw Error(`This legacy pattern cannot be converted (${error?.message||error}). Nothing was written.`);}
     bytes=converted.bytes;
     conversion={...converted.report,summary:describeConversion(converted.report,request.bpm)};
    }
    else if(request.bytes instanceof ArrayBuffer)bytes=new Uint8Array(request.bytes);
    else if(Array.isArray(request.patterns)){
     try{bytes=encodeBank(bankFromEditor({patterns:request.patterns,source:request.source,revision:request.revision}));}
     catch(error){throw Error(`This pattern cannot be sent to the module (${error?.message||error}). Nothing was written.`);}
    }
    else throw Error('Expected an encoded PVXE pattern bank or the editor patterns it was made from.');
    if(bytes.length<HEADER_MIN||bytes.length>MAX_BANK_BYTES)throw Error(`A PVXE bank is ${HEADER_MIN} to ${MAX_BANK_BYTES} bytes.`);
    // Decoding here is not a courtesy: it is the same envelope check the module runs, so a bank the firmware
    // would refuse never reaches the card and cannot replace a pattern that is already stored.
    let bank;try{bank=decodeBank(bytes);}catch(error){throw Error(`The pattern is not a usable PVXE v1 bank (${error?.message||error}). Nothing was written.`);}
    if(!patternStores&&!patternLive)throw Error('This firmware neither stores nor accepts a PVXE pattern bank. Nothing was written.');
    const stored=[],live=[];
    if(patternStores)for(const name of['A','B']){await files.upload(`/CHOPPER/${name}.PVXE`,bytes,{overwrite:true,makeParents:true});stored.push(`/CHOPPER/${name}.PVXE`);}
    if(patternLive)for(const slot of[0,1]){
     // Attempted per slot, and a failure on the second one is recorded rather than thrown: the first Chopper has
     // already changed, and losing that fact behind an exception is how A and B silently diverge. SD writes do
     // not prove boot loading or playback. NoGrid is a live refusal: load a loop, then explicitly resend.
     try{live.push({slot,...await owner.client.uploadPvxe(owner.info,slot,bytes)});}
     catch(error){live.push({slot,error:error?.message||String(error)});}
    }
    const accepted=live.filter(entry=>!entry.error&&entry.result!=='noGrid').length;
    // Reported per slot on purpose: the two loops need not be the same length, so one bank can legitimately land
    // on two different grids - and one slot's NoGrid must never be hidden by the other slot's success.
    return {state:stored.length?'uploaded':'sent',stored,live,partial:live.length>0&&accepted<live.length,patterns:bank.patterns.length,conversion,audiblyActive:false};
   }
   if(request.type==='download-sample'||request.type==='download-pattern'){
    const kind=request.type==='download-sample'?'sample':'pattern';
    if(!validChopperDevicePath(request.path,kind))throw Error('Choose a valid loop file or A/B cue bank.');
    if(kind==='sample'&&!loops)throw Error('This firmware does not advertise loop I/O.');
    if(kind==='pattern'&&descriptor?.chopper?.cueFileVersion!==1)throw Error('This firmware does not advertise persistent Chopper cue banks.');
    // LIST verifies size before the existing client's allocation in download().
    const directory=kind==='sample'?'/LOOPS':'/CHOPPER';
    const entry=(await files.list(directory)).find(file=>file.path===request.path&&!file.directory);
    const limit=kind==='sample'?MAX_ARTIFACT_BYTES:8236;
    if(!entry||!Number.isSafeInteger(entry.size)||entry.size<3||entry.size>limit)throw Error('File missing or exceeds the supported download size.');
    const bytes=await files.download(request.path,{maxBytes:limit});
    if(bytes.length!==entry.size)throw Error('File changed during download; retry.');
    if(kind==='pattern'&&!decodeChopperBank(bytes))throw Error('Unsupported or malformed legacy cue bank.');
    return {state:'downloaded',path:request.path,bytes:bytes.slice().buffer,legacy:kind==='pattern'};
   }
   throw Error('Unsupported Chopper device operation.');
  });
 }
}
