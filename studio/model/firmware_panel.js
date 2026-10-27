import { describedFirmware } from './firmware_profiles.js';

/** Adapt the stored two-slot ABI to the controls that this firmware actually has. */
export function firmwarePanelPages(pages, descriptor) {
  const fw=describedFirmware(descriptor);
  if(!fw || (!fw.multitap && Number(fw.activePlaits)!==1))return pages;
  const single=Number(fw.activePlaits)===1;
  const result=[];
  for(const source of pages) {
    if(single && /^(Voice|Plaits) [23]$/.test(source.name))continue;
    let page={...source,perfIndex:source.perfIndex??source.index,pots:source.pots.map(p=>({...p}))};
    if(/^(Voice|Plaits) 1$/.test(page.name)) {
      const shifts=[single?'Engine':'', single && descriptor?.panelFeedback?'Octave':'Twist',fw.sidechain?'Sidechain EQ':'','Reverb send','Attack','Delay send'];
      page.pots=page.pots.map((p,i)=>({...p,...(single && descriptor?.panelFeedback && i===0?{name:'Twist'}:{}),shift:shifts[i],b2:single?'Tap: Slicer; hold: next bank':p.b2}));
    }
    if(page.name==='Looper' && fw.looper) {
      const shifts=['File A','File B',single?'Direction A':'Direction',single?'Direction B':fw.sidechain?'Sidechain EQ':'','Reverb send','Delay send'];
      page.pots=page.pots.map((p,i)=>({...p,shift:shifts[i],b2:single?'Tap: Slicer; hold/release: record; 5 s: clear':p.b2}));
      page.note=single?'B1 is always Shift. Hold/release B2 to record. Short B2+B3: Undo/Redo. B1+B2 hold: save; B1+B2 tap: file page. Release B1 to load selected files. Blue/yellow identify A/B; directions are independent.':'Both slots play. Crossfader selects the recording slot; B1 chooses files and direction.';
    }
    if(page.name==='Slice' && single && Number(descriptor?.slice?.version)>=19) {
      const names=['Loop','Density','Edit','Throw chance','Seed','Wet'];
      const shifts=['Evolve (seed)','Shuffle','Ghost','Finale','Throw level','Throw destination'];
      const colours=['#2846ff','#ff6e00','#d2b46e','#00b4dc','#8c28dc','#28c85a'];
      result.push({...page,name:'Slicer',perfIndex:-1,note:'B1 + tap B2: next style. B2: variation. Hold B2: Fill. Density chooses active phrases; Edit adjusts their events. Delay, reverb and sends stay unchanged.',pots:names.map((name,id)=>({id,name,shift:shifts[id],b2:'Variation / hold Fill; B1 + tap: style',live:false,def:id===1?1:id===2?.5:0,colour:colours[id]}))});
      continue;
    }
    if(page.name==='Slice' && single) {
      const layers=[
        ['Slicer · Base','#002378',['Slot A/B','Division','Jump chance','Mode','Seed','Wet']],
        ['Slicer · Rhythm','#460078',['Size change','Retrigger','Reverse','Grimoire','Evolve','Tape']],
        ['Slicer · Colour','#007878',['Mode Activity','Delay Throw','Protect downbeat','Not used','Hit selection','Depth']],
      ];
      for(const [name,colour,names] of layers)result.push({...page,name,colour,perfIndex:-1,note:'B2 cycles Base → Rhythm → Colour. Wet zero disables Slicer; dim-red pip means off. Hold B2 for Fill. Runtime controls are operated on the module.',pots:names.map((name,id)=>({id,name,shift:'',b2:'Next Slicer page / hold Fill',live:false,def:0,colour}))});
      continue;
    }
    if(page.name==='Slice' && fw.multitap) {
      page.pots[2].shift='Rhythm: Reverse; Colour: Protect downbeat';
      page.pots[3].shift='Rhythm: Grimoire; Colour: not used';
      page.note='Colour Throw sends to the main Delay. Sweep and the dedicated HitDelay are removed.';
    }
    if(page.name==='Master') {
      page.perfIndex=-1;
      page.pots=page.pots.map((p,i)=>({...p,live:false,...(!fw.phaser&&i===1||single&&i===2?{name:'Not used',shift:'',colour:'#000000'}:{})}));
      page.pots[3].shift='Input → Delay';page.pots[5].shift='Input → Reverb';
      page.note='B3 alternates Master and FX. White filter centres bypass; unused controls are dark.';
    }
    result.push(page);
  }
  return result.map((page,index)=>({...page,index}));
}
