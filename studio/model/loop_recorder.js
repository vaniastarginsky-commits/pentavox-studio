export const RECORDING_REFUSALS=Object.freeze({
  1:'No clock. Start the transport or provide a clock before recording.',
  2:'The take does not fit in memory at this tempo. Choose a shorter length.',
  3:'Cannot overdub a reversed loop. Switch this slot to forward playback.',
  4:'This loop is being saved or loaded. Wait for the transfer to finish.',
  5:'This slot has no undo/redo history yet.',
});
export const recordingRefusal=reason=>RECORDING_REFUSALS[reason]??'';
import { LOOP_IO_COMMAND, parseLoopStatus } from './loop_io.js';
export const supportsRecordTarget = descriptor => Number(descriptor?.loopIo?.version)>=2 && descriptor.loopIo.recordTarget===true;
export function recorderView(status) {
  if (!status?.recorder) return null;
  const r=status.recorder, busy=r.mode!==0;
  const slot=busy?status.activeSlot:r.target;
  return { slot, busy, state:['Ready','Waiting for bar','Recording','Waiting for loop','Overdubbing'][r.mode],
    source:['Input','Plaits','Input + Plaits'][r.source], bars:r.bars, recording:r.mode===2 || r.mode===4,
    waiting:r.mode===1 || r.mode===3 };
}
/** Small read-only poll; selecting A/B is the only write. No live/preset writes. */
export class LoopRecorder {
  constructor({getSession,onStatus=()=>{},onError=()=>{},isVisible=()=>true,setTimer=(...args)=>globalThis.setTimeout(...args),clearTimer=(...args)=>globalThis.clearTimeout(...args)}) {
    Object.assign(this,{getSession,onStatus,onError,isVisible,setTimer,clearTimer});this.timer=null;this.operation=null;this.active=false;this.epoch=0;
  }
  refresh() { this.epoch++;this.active=true;this.clearTimer(this.timer);this.timer=null;this.onStatus(null);void this.poll(); }
  dispose(){this.active=false;this.epoch++;this.clearTimer(this.timer);}
  session(){const s=this.getSession();return s?.client && supportsRecordTarget(s.descriptor)?s:null;}
  async poll(){
    const s=this.session(),epoch=this.epoch;
    if(!this.active)return;
    if(!this.operation && s && !s.busy && this.isVisible()){
      const operation=s.client.request(LOOP_IO_COMMAND.STATUS);this.operation=operation;
      try{const {body}=await operation;if(epoch===this.epoch && s===this.session())this.onStatus(parseLoopStatus(body));}
      catch{if(epoch===this.epoch && s===this.session())this.onStatus(null);}
      finally{if(this.operation===operation)this.operation=null;}
    }
    if(this.active && epoch===this.epoch){this.clearTimer(this.timer);this.timer=this.setTimer(()=>void this.poll(),400);}
  }
  async select(slot){
    const s=this.session(),epoch=this.epoch;
    if(!s || s.busy || s.readOnly || s.pending || ![0,1].includes(slot))return false;
    while(this.operation){try{await this.operation;}catch{}}
    if(epoch!==this.epoch || s!==this.session() || s.busy || s.readOnly || s.pending)return false;
    const operation=s.client.request(LOOP_IO_COMMAND.STATUS,Uint8Array.of(slot));this.operation=operation;
    try{const {body}=await operation;if(epoch!==this.epoch || s!==this.session())return false;this.onStatus(parseLoopStatus(body));return true;}
    catch(error){if(epoch===this.epoch && s===this.session())this.onError(error);return false;}
    finally{if(this.operation===operation)this.operation=null;}
  }
}
