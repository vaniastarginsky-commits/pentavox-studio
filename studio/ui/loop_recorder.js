import { LoopRecorder, recorderView, supportsRecordTarget, recordingRefusal } from '../model/loop_recorder.js?v=2';
import { describeLoopFailure } from '../model/loop_io.js';
export function mountLoopRecorder(root,{getSession,onOpenLooper=()=>{}}) {
  root.className='loop-recorder';root.hidden=true;
  root.innerHTML='<div class="loop-recorder-heading"><button type="button" class="loop-recorder-open">Loop recorder</button><span class="loop-recorder-state" role="status"></span></div><div class="loop-recorder-target"><span>Record to</span><div role="group" aria-label="Recording target"><button type="button" data-record-slot="0" aria-pressed="true">A</button><button type="button" data-record-slot="1" aria-pressed="false">B</button></div></div><p class="loop-recorder-details"></p><p class="loop-recorder-error" role="alert" hidden></p>';
  const state=root.querySelector('.loop-recorder-state'),details=root.querySelector('.loop-recorder-details'),error=root.querySelector('.loop-recorder-error');
  const buttons=[...root.querySelectorAll('[data-record-slot]')];let current=null,pending=false,lastRefusal=null,lastIoFailure=null,errorKind='';
  function render(status){
    current=status;const session=getSession(),vm=recorderView(status);
    root.hidden=!supportsRecordTarget(session?.descriptor);if(root.hidden)return;
    root.dataset.state=vm?.recording?'recording':vm?.waiting?'waiting':'idle';
    const event=status?.recorder?.refusalCount;
    if(event!==undefined){
      if(lastRefusal!==null && event!==lastRefusal){errorKind='record';error.textContent=recordingRefusal(status.recorder.refusalReason);error.hidden=!error.textContent;}
      lastRefusal=event;
    }
    if(status && status.io!==3)lastIoFailure=null;
    if(status?.io===3 && status.reason && lastIoFailure!==`${status.lastNumber}:${status.reason}:${status.ms}`){
      lastIoFailure=`${status.lastNumber}:${status.reason}:${status.ms}`;errorKind='io';error.textContent=describeLoopFailure(status.reason,'The loop transfer failed.');error.hidden=false;
    }
    if(vm?.busy && errorKind==='record')error.hidden=true;
    state.textContent=vm?.state??'Reading…';
    details.textContent=vm?`${vm.source} · ${vm.bars} bars`:'Waiting for the module';
    for(const b of buttons){b.disabled=pending || !vm || vm.busy || session?.busy || session?.readOnly || session?.pending;b.setAttribute('aria-pressed',String(Number(b.dataset.recordSlot)===vm?.slot));}
  }
  const recorder=new LoopRecorder({getSession,onStatus:render,isVisible:()=>!document.hidden,onError:e=>{
    errorKind='target';error.textContent=e?.status===9?'Finish the take before changing its target.':e?.message??'Could not change the recording target.';error.hidden=false;
  }});
  buttons.forEach(button=>button.addEventListener('click',async()=>{error.hidden=true;errorKind='';pending=true;render(current);try{await recorder.select(Number(button.dataset.recordSlot));}finally{pending=false;render(current);}}));
  root.querySelector('.loop-recorder-open').addEventListener('click',onOpenLooper);
  return {refreshConnection(){error.hidden=true;lastRefusal=null;lastIoFailure=null;errorKind='';recorder.refresh();},dispose(){recorder.dispose();}};
}
