import { describedFirmware } from './firmware_profiles.js';

/** Adapt the stored two-slot ABI to the controls that this firmware actually has. */
export function firmwarePanelPages(pages, descriptor) {
  const fw=describedFirmware(descriptor);
  if(!fw || (!fw.multitap && Number(fw.activePlaits)!==1))return pages;
  const single=Number(fw.activePlaits)===1;
  const swappedLoops=single && !fw.phaser && Number(fw.panelVersion)>=6;
  const globalLoop=single && Number(fw.panelVersion)>=3;
  const result=[];
  for(const source of pages) {
    if(single && /^(Voice|Plaits) [23]$/.test(source.name))continue;
    let page={...source,perfIndex:source.perfIndex??source.index,pots:source.pots.map(p=>({...p}))};
    if(/^(Voice|Plaits) 1$/.test(page.name)) {
      const shifts=[single?'Engine':'', single && descriptor?.panelFeedback?'Octave':'Twist',single?'Sidechain':fw.sidechain?'Sidechain EQ':'','Reverb send','Attack','Delay send'];
      page.pots=page.pots.map((p,i)=>({...p,...(single && descriptor?.panelFeedback && i===0?{name:'Twist'}:{}),shift:shifts[i],b2:single?'Tap: Slicer; hold + turn: FM; hold without editing: next bank':p.b2}));
      if(single && fw.legatoGlide)page.note='Hold B2 and turn to edit FM. Add B1: top-left becomes Glide (Off–3 s), other pots are inactive. Glide applies only to legato; a gap over 5 ms starts at the new pitch. Catch the stored value before editing. FM/Glide editing cancels bank switching; Attack remains on B1 + bottom-left.';
    }
    if(page.name==='Looper' && fw.looper) {
      const shifts=['File A','File B',single?'Direction A':'Direction',single?'Direction B':fw.sidechain?'Sidechain EQ':'',single?'Pan A':'Reverb send',single?'Pan B':'Delay send'];
      page.pots=page.pots.map((p,i)=>({...p,shift:shifts[i],b2:globalLoop?'Tap: Slicer; hold/release: Undo/Redo; B2+B3: record / hold save':single?'Tap: Slicer; hold/release: record; 5 s: clear':p.b2}));
      if(swappedLoops)page.pots[2]={...page.pots[2],name:'Record A/B',live:false};
      page.note=globalLoop?'B2+B3 on every page: tap record/stop; hold save to SD. Looper B2 hold/release: Undo/Redo; 3 s warning, 5 s clear. B1: files, directions and pans A/B. B1+B2 tap: file page; hold: sends and sidechains. Release B1 to load files. Settings: hold all three buttons.':single?'B1 is always Shift. Hold/release B2 to record. Short B2+B3: Undo/Redo. B1+B2 hold: save; B1+B2 tap: file page. Release B1 to load selected files. Blue/yellow identify A/B; directions are independent.':'Both slots play. Crossfader selects the recording slot; B1 chooses files and direction.';
    }
    if(swappedLoops && page.name==='Looper')page.note+=' Middle-left selects recording A/B; Master top-right crossfades playback. The recording target is locked during a queued/running take.';
    if(page.name==='Slice' && single && Number(descriptor?.slice?.version)>=19) {
      const names=Number(descriptor?.slice?.version)>=20?['Loop','Activity',Number(descriptor?.slice?.version)>=23?'Kick doubles':'Detail','Throw','Seed chance','Mix']:['Loop','Density','Edit','Throw chance','Seed','Wet'];
      const lite=Number(descriptor?.slice?.version)>=20;
      const shifts=lite?['Retrigger','Shuffle',Number(descriptor?.slice?.version)>=23?'Jump':'Ghost','Throw destination','Seed','Finale']:['Evolve (seed)','Shuffle','Ghost','Finale','Throw level','Throw destination'];
      const colours=['#2846ff','#ff6e00','#d2b46e','#00b4dc','#8c28dc','#28c85a'];
      if(Number(descriptor?.slice?.version)>=21) {
        for(const [name,labels] of [['Slicer · Main',names],['Slicer · Rhythm',shifts]])
          result.push({...page,name,perfIndex:-1,note:(Number(descriptor?.slice?.version)>=23?'Ghost layers are removed. Rhythm middle left: Jump chance; marked slices preferred, sixteenth grid fallback. Main middle left: kick doubles. ':'')+(Number(descriptor?.slice?.version)>=22?'Loop pot: A / Both / B. Both keeps independent rhythm for each loop; crossfader still controls their levels. ':'')+'B2 switches Main / Rhythm and keeps the page selected. Hold B2: Fill. B1 + tap B2: recall demo. B1 tap: back. Seed and Seed chance choose variations; FX settings stay unchanged.',pots:labels.map((name,id)=>({id,name,shift:'',b2:'Next page / hold Fill; B1 + tap: recall demo',live:false,def:0,colour:colours[id]}))});
        continue;
      }
      result.push({...page,name:'Slicer',perfIndex:-1,note:lite?'Jungle demo script. B2: variation; hold: Fill. B1 + tap B2: recall demo. Seed chance changes the seed only at four-bar phrase boundaries; Retrigger is off by default. FX settings stay unchanged.':'B1 + tap B2: next style. B2: variation. Hold B2: Fill. Density chooses active phrases; Edit adjusts their events. Delay, reverb and sends stay unchanged.',pots:names.map((name,id)=>({id,name,shift:shifts[id],b2:lite?'Variation / hold Fill; B1 + tap: recall demo':'Variation / hold Fill; B1 + tap: style',live:false,def:id===1?1:id===2?.5:0,colour:colours[id]}))});
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
      page.pots=page.pots.map((p,i)=>({...p,live:false,...(!fw.phaser&&i===1?{name:swappedLoops?'Crossfader':single&&Number(fw.panelVersion)>=4?'Record A/B':'Not used',shift:single?'Input sidechain':'',colour:single&&Number(fw.panelVersion)>=4?'#2846ff':'#000000'}:single&&i===2?{name:'Input filter',shift:'Input pan'}:{})}));
      page.pots[3].shift='Input → Delay';page.pots[5].shift='Input → Reverb';
      page.note='B3 alternates Master and FX. White filter centres bypass; unused controls are dark.'+(descriptor?.masterSidechain?' Sidechain moves these same filters toward HP, then returns to your setting. Moving dots show the actual filter: cyan, or amber for loop B; A/B alternate when both are active. Depth knobs are 15% stronger at maximum.':'');
    }
    result.push(page);
  }
  return result.map((page,index)=>({...page,index}));
}
