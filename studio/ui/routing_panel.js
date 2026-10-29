import { potMapPages } from './potmap_vm.js';
import { performanceView } from './performance_feedback.js';
import { sourceKey as routeSourceKey } from './routing_vm.js';
import { learnNextMessage } from '../model/midi_learn.js';

// Exact destination symbols mirror panel_destination_map.h. Runtime/discrete
// controls have no CV/MIDI destination: a similar-looking name is not enough.
const MODERN_SHIFT = {
  'Plaits 1':['', '', '', '', 'Voice1Attack', 'Voice1Balance'],
  'Plaits 2':['Voice2XMod','Voice2Twist','','','Voice2Attack','Voice2Balance'],
  'Looper':['','','','','',''],
  'FX live':['','FxReverbMotion','FxDelayDamp','FxReverbTone','',''],
  'Master':['','FxPhaserRate','','GlobalInputAux','',''],
};
export function panelGuidePages(controller,layer=0) {
  const pages=[...(controller.potMapView?.()[layer]?.pages??[])];
  if(Number(controller.session.descriptor?.slice?.version)>=20 && Number(controller.session.descriptor?.pentavox?.activePlaits)===1) {
    const controls=performanceView('slicer',null,layer===1,true).controls;
    pages.push({page:controller.session.descriptor.slice.page,label:'Slicer',runtime:true,
      cells:controls.map((c,pot)=>({pot,title:c.label,builtIn:c.label,off:false,assigned:false,colour:c.colour}))});
  }
  return pages;
}

export function panelTargets(controller, layer=0, pageIndex=0) {
  const page=panelGuidePages(controller,layer)[pageIndex];if(!page)return [];
  const caps=controller.session.potMap?.capabilities??{};
  const physical=controller.session.potMap?potMapPages(controller.session.potMap).find(item=>item.index===page.page):null;
  const other=panelGuidePages(controller,1-layer).find(p=>p.page===page.page);
  return page.cells.map(cell=>{
    let entry=cell.assigned?controller.destinations.byId(cell.destId):null;
    if(!cell.off && !cell.assigned && !page.runtime && cell.builtIn!=='—' && cell.title!=='Not used') {
      if(layer===0){const symbol=physical?.pots[cell.pot];if(symbol && !symbol.startsWith('builtin:'))entry=controller.destinations.entries.find(e=>e.symbol===symbol);}
      else if(caps.multitap){
        let symbol=MODERN_SHIFT[page.label]?.[cell.pot];
        if(page.label==='Plaits 1' && caps.plaitsVoices!==1 && cell.pot<2)symbol=cell.pot===0?'Voice1XMod':'Voice1Twist';
        if(page.label==='Master' && !caps.phaser && cell.pot===1)symbol='';
        if(page.label==='Plaits 1' && caps.plaitsVoices!==1 && cell.pot===0 && caps.crossFm===false)symbol='';
        if(page.label==='Looper' && caps.plaitsVoices!==1 && cell.pot===5)symbol='Sampler1Balance';
        if(symbol)entry=controller.destinations.entries.find(e=>e.symbol===symbol);
      } else {
        const group=page.label.startsWith('FX')?'FX':page.label==='Master'?'Global':page.label;
        entry=controller.destinations.entries.find(e=>e.group===group && e.name===cell.builtIn);
      }
    }
    if(cell.off)entry=null;
    if(entry)entry=controller.destinations.byId(entry.id)??entry;
    const colour=page.label==='Looper'?(cell.pot%2?'#e8b452':'#6488de')
      :page.label.startsWith('FX')?(cell.pot%2?'#00a0d2':'#ff8700'):cell.colour??'var(--accent)';
    return {pot:cell.pot,title:cell.title,destination:entry?.id??null,group:entry?.group??'',off:cell.off,colour,
      paired:other?.cells.find(c=>c.pot===cell.pot)?.title??'',
      reason:cell.off?'This knob is disabled in this layer.':page.runtime?'Slicer controls are runtime settings. This firmware has no CV/MIDI destinations for them.':'This control has no CV/MIDI destination in this firmware.'};
  });
}

export function mountRoutingPanel(root,controller,mode,{onError=()=>{},onSuccess=()=>{},onUndo=null,isConnected=()=>true,learn=learnNextMessage}={}) {
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const details=el('details','routing-panel-guide');details.append(el('summary','','Assign from the module panel'));root.replaceChildren(details);
  let pageIndex=0,layer=0,selected=1,pinned=false,sourceKey=controller.selectedKey,midiIndex=null,learning=null;
  const drafts=new Map();
  const stopLearning=()=>{learning?.abort();learning=null;};
  function render(){
    const old=details.querySelector('.routing-panel-body');old?.remove();
    const pages=panelGuidePages(controller,layer);
    if(!pages.length){details.append(el('p','routing-panel-body','Panel assignments are unavailable on this firmware. Use the parameter lists below.'));return;}
    pageIndex=Math.min(pageIndex,pages.length-1);
    const body=el('div','routing-panel-body'),preview=el('section','routing-panel-preview'),controls=el('div','routing-panel-controls');
    const page=el('select');page.setAttribute('aria-label','Panel page');
    pages.forEach((item,i)=>page.append(new Option(item.label,String(i),false,i===pageIndex)));
    page.addEventListener('change',()=>{stopLearning();pageIndex=Number(page.value);pinned=false;render();});
    const shift=el('button','','B1 layer');shift.type='button';shift.setAttribute('aria-pressed',String(layer===1));
    shift.addEventListener('click',()=>{stopLearning();layer=1-layer;pinned=false;render();});controls.append(page,shift);preview.append(controls);
    const targets=panelTargets(controller,layer,pageIndex),knobs=el('div','routing-panel-knobs');
    const inspector=el('section','routing-panel-inspector');const name=el('h3'),paired=el('p','routing-panel-pair'),explanation=el('p','routing-panel-explanation'),existingList=el('div','routing-panel-usages');
    const source=el('select');source.setAttribute('aria-label',mode==='midi'?'MIDI route to assign':'CV source to assign');
    const sources=controller.view().groups.flatMap(g=>g.sources).filter(s=>s.source.key!=='panelpot');
    if(mode==='midi'){
      const routes=controller.midiRoutesView()?.routes??[];
      for(const r of routes)source.append(new Option(`Route ${r.index+1} · ${r.cc===128?'Velocity':`CC ${r.cc}`}${r.channel?` · Ch ${r.channel}`:''}${r.dest?' · assigned':''}`,String(r.index)));
      midiIndex??=routes.find(r=>!r.dest)?.index??routes[0]?.index;source.value=String(midiIndex);
    }else{
      for(const item of sources)source.append(new Option(`${item.label} · ${item.count}/4`,item.key));
      if(!sources.some(s=>s.key===sourceKey))sourceKey=sources[0]?.key;source.value=sourceKey;
    }
    source.addEventListener('change',()=>{stopLearning();if(mode==='midi')midiIndex=Number(source.value);else sourceKey=source.value;select(selected);});
    const sourceLabel=el('label','routing-panel-field',mode==='midi'?'MIDI route':'CV input');sourceLabel.append(source);
    const depth=el('input');depth.type='number';depth.min='-100';depth.max='100';depth.setAttribute('aria-label','Panel assignment depth, percent');
    const depthLabel=el('label','routing-panel-field','Depth, %');depthLabel.append(depth);
    const apply=el('button','primary');apply.type='button';
    let currentExisting=null,draftKey='';
    function select(pot){
      selected=pot;const target=targets.find(t=>t.pot===pot);if(!target)return;
      currentExisting=mode==='cv'?(controller.usages?.(target.destination)??[]).find(u=>routeSourceKey(u.source)===sourceKey):null;
      const route=mode==='midi'?controller.midiRoutesView()?.routes.find(r=>r.index===Number(source.value)):null;
      draftKey=`${mode}:${source.value}:${target.destination??target.title}`;
      depth.value=drafts.get(draftKey)??String(currentExisting?.depthPct??(route?.dest===target.destination?route.depth:50));
      name.textContent=`${target.group?`${target.group} / `:''}${target.title}`;
      paired.textContent=`${layer===1?'Without B1':'With B1'}: ${target.paired||'Not used'}`;
      const full=mode==='cv' && !currentExisting && sources.find(s=>s.key===source.value)?.canAdd===false;
      explanation.textContent=!target.destination?target.reason:full?'This input already has four routes. Choose another input or remove a route below.':'Hover to inspect; click or tap to keep a knob selected. Then assign an input.';
      apply.textContent=mode==='midi'?(route?.dest&&route.dest!==target.destination?'Replace MIDI assignment':'Assign MIDI route'):currentExisting?'Update CV route':'Add CV route';
      apply.disabled=!target.destination || !isConnected() || controller.view().readOnly || !source.options.length || full || Boolean(learning);
      existingList.replaceChildren();
      const usages=mode==='cv'?(controller.usages?.(target.destination)??[]).map(u=>`${u.sourceLabel} ${u.depthPct>0?'+':''}${u.depthPct}%`)
        :(controller.midiRoutesView()?.routes??[]).filter(r=>r.dest===target.destination).map(r=>`Route ${r.index+1} · CC ${r.cc} · ${r.depth>0?'+':''}${r.depth}%`);
      if(usages.length){existingList.append(el('span','','Assigned: '),...usages.map(text=>el('span','routing-panel-route',text)));}
      for(const knob of knobs.querySelectorAll('button'))knob.setAttribute('aria-pressed',String(Number(knob.dataset.pot)===pot));
    }
    depth.addEventListener('input',()=>{drafts.set(draftKey,depth.value);depth.removeAttribute('aria-invalid');});
    for(const target of targets){
      const knob=el('button','routing-panel-knob');knob.type='button';knob.dataset.pot=target.pot;knob.style.gridColumn=target.pot%2?'3':'1';knob.style.gridRow=String(Math.floor(target.pot/2)+1);knob.style.setProperty('--guide-hue',target.colour);
      knob.setAttribute('aria-label',`Panel knob ${target.pot+1}: ${target.title}`);knob.title=target.destination?`${layer===1?'Normal':'B1'}: ${target.paired}`:target.reason;
      knob.classList.toggle('unavailable',!target.destination);knob.append(el('span','routing-panel-cap'),el('span','',target.title));
      knob.addEventListener('mouseenter',()=>{if(!pinned)select(target.pot);});knob.addEventListener('focus',()=>{if(!pinned)select(target.pot);});knob.addEventListener('click',()=>{pinned=true;select(target.pot);});knobs.append(knob);
    }
    for(let i=0;i<3;++i){const b=el('span','routing-panel-button',`B${i+1}`);b.style.gridRow=String(i+1);b.setAttribute('aria-hidden','true');if(i===0&&layer===1)b.classList.add('active');knobs.append(b);}
    apply.addEventListener('click',()=>{
      const target=targets.find(t=>t.pot===selected);if(!target?.destination || apply.disabled || !isConnected() || controller.view().readOnly)return;
      const value=Number(depth.value);if(!Number.isFinite(value)||depth.value===''||value< -100||value>100){depth.setAttribute('aria-invalid','true');explanation.textContent='Depth must be between −100 and 100%.';depth.focus();return;}
      try{
        let undo;
        if(mode==='midi'){
          const before={...controller.midiRoutesView().routes.find(r=>r.index===Number(source.value))};
          controller.updateMidiRouteFields(Number(source.value),{dest:target.destination,depth:value});
          undo=()=>controller.updateMidiRouteFields(before.index,{dest:before.dest,depth:before.depth});
        }else if(currentExisting){
          const before=currentExisting,key=sourceKey;controller.updateRoute(before.k,{depthPct:value},key);
          undo=()=>controller.updateRoute(before.k,{destId:target.destination,depthPct:before.depthPct},key);
        }else{
          const key=sourceKey,k=controller.addRoute(target.destination,value,key);if(k<0)throw new Error('This input already has four routes.');undo=()=>controller.removeRoute(k,key);
        }
        const committedDraft=draftKey;drafts.delete(committedDraft);render();
        if(onUndo)onUndo(`Assigned ${target.title}`,()=>{drafts.delete(committedDraft);undo();});else onSuccess(`Assigned ${target.title}`);
      }catch(error){onError(error);}
    });
    preview.append(knobs);inspector.append(name,paired,explanation,existingList,sourceLabel,depthLabel);
    if(mode==='midi' && typeof globalThis.navigator?.requestMIDIAccess==='function'){
      const learnButton=el('button','routing-panel-learn',learning?'Cancel learning':'Learn MIDI controller');learnButton.type='button';learnButton.disabled=controller.view().readOnly||!isConnected()||!source.options.length;
      learnButton.addEventListener('click',async()=>{
        if(learning){stopLearning();render();return;}
        const abort=new AbortController(),index=Number(source.value);learning=abort;render();
        try{const result=await learn({signal:abort.signal});if(abort.signal.aborted||learning!==abort)return;learning=null;controller.updateMidiRouteFields(index,{cc:result.cc,ch:result.channel});onSuccess(`Learned CC ${result.cc} · Channel ${result.channel}`);}
        catch(error){if(!abort.signal.aborted)onError(error);}
        finally{if(learning===abort)learning=null;if(details.open)render();}
      });inspector.append(learnButton);
    }
    inspector.append(apply);body.append(preview,inspector);details.append(body);select(selected);
  }
  details.addEventListener('toggle',()=>{if(details.open)render();else stopLearning();});
  const unsubscribe=controller.subscribe(()=>{if(details.open && !details.contains(document.activeElement))render();});
  return ()=>{stopLearning();unsubscribe();root.replaceChildren();};
}
