#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { detectOnsets } from '../model/onsets.js';
import { classifyHits } from '../model/classify.js';
const HERE = dirname(fileURLToPath(import.meta.url));
const CLASSES = ['kick', 'snare', 'hat', 'tom', 'cymbal', 'perc'];

function decodePcm16(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength); let pos=12,fmt,data;
  while(pos+8<=bytes.length){const id=String.fromCharCode(...bytes.subarray(pos,pos+4));const n=view.getUint32(pos+4,true);if(id==='fmt ')fmt={channels:view.getUint16(pos+10,true),sampleRate:view.getUint32(pos+12,true),bits:view.getUint16(pos+22,true)};if(id==='data')data=[pos+8,Math.min(n,bytes.length-pos-8)];pos+=8+n+(n&1);}
  if(!fmt||!data||fmt.bits!==16)throw new Error('benchmark requires PCM16 WAV');
  const frames=Math.floor(data[1]/(2*fmt.channels));const channels=Array.from({length:fmt.channels},()=>new Float32Array(frames));
  for(let i=0;i<frames;i++)for(let c=0;c<fmt.channels;c++)channels[c][i]=view.getInt16(data[0]+2*(i*fmt.channels+c),true)/32768;
  return {channels,sampleRate:fmt.sampleRate};
}
function base(label){return String(label||'other').split('+')[0]||'hat';}
function match(truth,predicted,tolerance){const cs=[];for(let i=0;i<truth.length;i++)for(let j=0;j<predicted.length;j++){const error=Math.abs(truth[i].time-predicted[j].time);if(error<=tolerance)cs.push({i,j,error});}cs.sort((a,b)=>a.error-b.error);const ti=new Set(),pj=new Set(),pairs=[];for(const x of cs)if(!ti.has(x.i)&&!pj.has(x.j)){ti.add(x.i);pj.add(x.j);pairs.push(x);}return pairs;}
function accumulator(name){return{name,loops:0,truth:0,found:0,ms:0,tp15:0,tp25:0,ghosts:0,ghostFound:0,classCorrect:0,classMatched:0,perClass:Object.fromEntries(CLASSES.map(x=>[x,{correct:0,matched:0,total:0}])),confusion:Object.fromEntries(CLASSES.map(x=>[x,Object.fromEntries([...CLASSES,'other'].map(y=>[y,0]))]))};}
async function evaluate(total,item){const bytes=new Uint8Array(await readFile(item.file));const wav=decodePcm16(bytes);const truth=item.events.map(e=>({time:e.onsetSample/item.sampleRate,label:e.class,ghost:e.ghost}));const started=performance.now();let times=detectOnsets(wav.channels,wav.sampleRate,{sensitivity:1,maxOnsets:63});if(truth.some(x=>x.time<.015)&&!times.some(x=>x<.015))times.unshift(0);const labels=classifyHits(wav.channels,wav.sampleRate,times).map(base);total.ms+=performance.now()-started;const predicted=times.map((time,i)=>({time,label:labels[i]})),p15=match(truth,predicted,.015),p25=match(truth,predicted,.025);total.loops++;total.truth+=truth.length;total.found+=predicted.length;total.tp15+=p15.length;total.tp25+=p25.length;for(const hit of truth){total.perClass[hit.label].total++;if(hit.ghost)total.ghosts++;}for(const p of p25){const wanted=truth[p.i];const got=predicted[p.j].label in total.confusion[wanted.label]?predicted[p.j].label:'other';total.perClass[wanted.label].matched++;total.perClass[wanted.label].correct+=wanted.label===got;total.classMatched++;total.classCorrect+=wanted.label===got;total.confusion[wanted.label][got]++;if(wanted.ghost)total.ghostFound++;}}
const ratio=(a,b)=>b?a/b:0;
function metrics(t){const at=tp=>{const p=ratio(tp,t.found),r=ratio(tp,t.truth);return{precision:p,recall:r,f1:p+r?2*p*r/(p+r):0};};return{name:t.name,loops:t.loops,truth:t.truth,found:t.found,at15:at(t.tp15),at25:at(t.tp25),classAccuracy:ratio(t.classCorrect,t.classMatched),ghostRecall:ratio(t.ghostFound,t.ghosts),msPerLoop:ratio(t.ms,t.loops),perClass:t.perClass,confusion:t.confusion};}
const pc=x=>`${(100*x).toFixed(1)}%`;
function print(s){console.log(`\n${s.name}: ${s.loops} loops, ${s.truth} truth, ${s.found} found, ${s.msPerLoop.toFixed(1)} ms/loop`);console.log(`  15 ms P/R/F1 ${pc(s.at15.precision)} ${pc(s.at15.recall)} ${pc(s.at15.f1)} | 25 ms ${pc(s.at25.precision)} ${pc(s.at25.recall)} ${pc(s.at25.f1)}`);console.log(`  class accuracy ${pc(s.classAccuracy)} | ghost recall ${pc(s.ghostRecall)}`);console.log('  truth     correct/matched/total  accuracy');for(const k of CLASSES){const r=s.perClass[k];console.log(`  ${k.padEnd(9)} ${String(r.correct).padStart(4)}/${String(r.matched).padEnd(4)}/${String(r.total).padEnd(4)} ${pc(r.matched?r.correct/r.matched:0).padStart(8)}`);}console.log(`  confusion columns: ${[...CLASSES,'other'].join(' ')}`);for(const k of CLASSES)console.log(`  ${k.padEnd(9)} ${[...CLASSES,'other'].map(x=>String(s.confusion[k][x]).padStart(5)).join(' ')}`);}
const truth=JSON.parse(await readFile(join(HERE,'gen_loops/truth.json'),'utf8'));const selected=process.argv.includes('--split')?process.argv[process.argv.indexOf('--split')+1]:null;const results=[];for(const split of ['tune','heldout'])if(!selected||selected===split){const total=accumulator(split);for(const loop of truth.loops.filter(x=>x.split===split))await evaluate(total,loop);results.push(metrics(total));}if(process.argv.includes('--json'))console.log(JSON.stringify(results,null,2));else for(const result of results)print(result);
