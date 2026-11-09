// Experimental unified-workspace adapter. Uses the EXISTING HostLink filesystem
// client; never opens another serial port and never labels staging as upload.
import {SdFilesClient} from './sd_files.js';
import {loopFiles,loopFileName,loopIoVersion} from './loop_io.js';
import {decodeChopperBank} from './chopper_bank.js';
import {validateArtifactBytes,MAX_ARTIFACT_BYTES} from '../ui/samples_bridge.js';

export function validChopperDevicePath(path,kind){
 return typeof path==='string'&&(kind==='sample'?/^\/LOOPS\/(?!0000)\d{4}\.WAV$/i.test(path):/^\/CHOPPER\/[AB]\.PVXP$/i.test(path));
}
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
   if(request.type==='capabilities')return {sampleUpload:loops,sampleDownload:loops,legacyPatternDownload:descriptor?.chopper?.cueFileVersion===1,newPatternUpload:false,reason:'REL/ABS pattern upload requires compatible firmware; current PVXP v1–v4 is not reinterpreted.'};
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
