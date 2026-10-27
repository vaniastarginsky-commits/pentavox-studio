import { detectOnsets, refineOnsetTime } from './onsets.js';
import { classifyHits, hitFeatures } from './classify.js';

export const ADTOF_CLASSES = ['kick', 'snare', 'tom', 'hat', 'cymbal'];
export const ADTOF_THRESHOLDS = [0.22, 0.24, 0.32, 0.22, 0.30];
const MERGE_SECONDS = 0.025;

function activationWindow(activations, time) {
  const at = Math.round(time * 100); const out = Array(5).fill(0);
  for (let f = Math.max(0, at - 3); f <= Math.min(activations.length - 1, at + 3); f += 1) {
    for (let c = 0; c < 5; c += 1) out[c] = Math.max(out[c], Number(activations[f]?.[c]) || 0);
  }
  return out;
}

function neuralPeaks(activations) {
  const peaks = [];
  for (let c = 0; c < 5; c += 1) for (let f = 0; f < activations.length; f += 1) {
    const value = Number(activations[f]?.[c]) || 0;
    if (value < ADTOF_THRESHOLDS[c] || value < (Number(activations[f - 1]?.[c]) || 0) || value < (Number(activations[f + 1]?.[c]) || 0)) continue;
    const previous = peaks.findLast((p) => p.classIndex === c && f / 100 - p.coarse < 0.04);
    if (previous) { if (value > previous.value) { previous.coarse = f / 100; previous.value = value; } }
    else peaks.push({ coarse: f / 100, value, classIndex: c });
  }
  return peaks;
}

function relativeLevel(channels, sampleRate, time) {
  const monoLength = channels[0]?.length || 0; const w = Math.max(1, Math.round(sampleRate * 0.02)); const at = Math.round(time * sampleRate);
  let local = 0; let global = 0;
  for (const channel of channels) for (let i = 0; i < monoLength; i += 1) { const q = channel[i] * channel[i]; if (q > global) global = q; if (i >= at && i < at + w) local += q; }
  return Math.sqrt(local / Math.max(1, w * channels.length)) / Math.sqrt(global + 1e-12);
}

/** Build the transparent feature rows used by the offline trainer and runtime. */
export function hybridCandidates(channels, sampleRate, activations, { sensitivity = 1 } = {}) {
  const rules = detectOnsets(channels, sampleRate, { sensitivity, maxOnsets: 63 });
  const ruleLabels = classifyHits(channels, sampleRate, rules).map((x) => x.split('+')[0]);
  const rows = rules.map((time, i) => ({ time, rule: true, neural: false, ruleLabel: ruleLabels[i] }));
  for (const peak of neuralPeaks(activations || [])) {
    const time = refineOnsetTime(channels, sampleRate, peak.coarse);
    let row = rows.reduce((best, x) => Math.abs(x.time - time) <= MERGE_SECONDS && (!best || Math.abs(x.time - time) < Math.abs(best.time - time)) ? x : best, null);
    if (!row) { row = { time, rule: false, neural: true, ruleLabel: 'other' }; rows.push(row); }
    else row.neural = true;
  }
  rows.sort((a, b) => a.time - b.time);
  return rows.map((row, i) => {
    const f = hitFeatures(channels, sampleRate, row.time, rows[i + 1]?.time) || {};
    return { ...row, activations: activationWindow(activations || [], row.time), relativeLevel: relativeLevel(channels, sampleRate, row.time), features: f };
  });
}

// Runtime model constants are deliberately plain data. They are populated only
// after hybrid_eval demonstrates a held-out improvement.
export const HYBRID_MODEL = {
  mean: [0.75221238938052,0.8220255653883847,0.24483775811209518,0.28711897738446407,0.09832841691248782,0.030481809242871204,0.0019665683382497543,0.03736479842674533,0.2529891838750921,0.2216833825751996,0.09508751243370747,0.23289085537066553,0.07140412978860461,0.3387323305016783,0.30861149136379484,0.4335789546797872,0.4840215588424758,0.13548907470786486,-0.45307322828646435,-0.24553004738435052,1.0925019399362823,0.19376848399670604,0.9237632437134391,0.5357951700043616,0.43010379022501355,0.35483499262536905,0.2881858993941546,0.032338042326905125],
  sd: [0.43172782009382404,0.3824912224303774,0.42999096538733933,0.452417583887016,0.2977581893751545,0.1719088960704262,0.04430238083016214,0.18965408053947605,0.32014484929678017,0.2827466980595069,0.12931261863069748,0.1929005602661195,0.1346924782219038,0.17864372968936126,0.7005853384889101,0.5913527761254866,0.8422534836115704,0.6852572813782183,0.5734509665313766,0.5216542746975827,0.7678530728724348,0.4476781993090645,0.6449098962052597,0.6488392327967799,0.5848976692917252,0.2647432302181319,0.1315974843388391,0.0211335375877165],
  weights: [2.244526462161911,0.35570862609855636,0.4032306790488436,0.3137557368459397,0.06578850792682417,0.26970618822471215,0.14077042386836272,-0.1220530233709455,0.1391334541074098,0.23695936611057386,-0.037519974616438044,0.1541454052160938,0.053643485680296595,0.17572057523057794,-0.07333398529185338,0.047986131670233745,0.3206855027881054,-0.12396705977779165,0.046800510634945766,-0.001553051299868028,0.0115801024710618,-0.7669755401437552,-0.08134037063507012,0.6095624997211144,0.44282119175993095,0.3005556599463781,-0.07512610408453789,-0.0512043151175127,0.017312859335269156],
  keepThreshold: 0.43,
  classWeights: {
    kick: [-1.2936485581986161,0.06057787453241646,0.23724635533860178,0.3898000627832518,-0.0362822485101028,-0.14727150669295203,-0.06954817453047038,-0.024613444480452974,-0.02470698969064509,1.0660631971360972,-0.316973447725478,-0.09853574311131154,-0.12563027277814073,0.08624931832553348,0.13215887541243568,0.2199538827576845,-0.02848274585759857,0.3628719422732687,0.3026241074345584,-0.16151318486993246,-0.25081871765099784,-0.22599990042663334,0.05459267779106658,0.1732440610281211,0.18510940783428148,0.009988959215778252,-0.2642771162635413,-0.223161296269542,-0.047132420493870536],
    snare: [-1.976604832416531,0.15058143314361083,0.0014829088029580384,-0.12773317348534627,0.38003284307860924,-0.08122214666730414,0.1489850083601764,-0.03485862303671828,0.05407132539409713,-0.6752756692289247,0.6651951390065948,0.20415398357399187,0.0017248963139780125,0.1452515543339767,0.15171929958528382,-0.1431734254502362,0.13019631995075992,-0.2720189212665934,-0.33866673311426204,-0.05615405715842472,-0.13280760286784513,-0.09998862022963151,-0.08500142122577432,0.1345692730814619,0.3322081513433406,0.15706290923579228,0.04838079568995129,-0.036490930411616926,-0.04532701806033516],
    hat: [-2.204960144002559,0.10790458310690794,0.11805563798602868,-0.1325167010574714,-0.06704280953544747,0.1099496429252403,-0.09766304213551102,-0.08260496746670203,0.19343919287359815,-0.505441371141971,-0.2954455665457828,-0.06483531709534555,0.03787673725717124,-0.14462852104834023,-0.4951761781427156,-0.1163797746119741,0.25803155420602136,-0.06307499708572774,0.27012112418743206,0.25735181613506897,0.47144359352498577,-0.3149927410373926,-0.09832329823975519,0.02918064666224114,-0.20630399766534402,0.1330574828253091,-0.00505800410219034,0.12272447961406793,-0.033321600433758404],
    tom: [-3.397904639688647,0.06667329525991238,-0.05660557281463745,0.03950574667533786,-0.08354662561866906,0.1816631015333293,0.1938858306503399,-0.010613380911794736,-0.02116520112995767,-0.06855188261025912,-0.16432192483022431,0.25278629826495125,0.03963997399654298,-0.0036734722854475745,0.10816740302464013,0.0884071837859502,-0.09068040608318975,-0.06867378544077049,-0.16556295175678762,0.034980850986870884,0.0031714286039544416,-0.07640837100535791,-0.11223481409156003,0.10827848921713934,-0.12168950860522179,-0.013912595258057969,-0.0017425426353884666,0.08380344964592609,-0.018930804299833365],
    cymbal: [-3.970830715016592,-0.016710560398198192,0.006426918501090483,-0.005540860273872269,-0.0034800524236904854,-0.004627013895112444,-0.0018087428269864569,-0.0006246415650581384,-0.0019129184131175116,-0.012840335060345622,-0.008769276829686175,-0.005459270290434048,0.001515441087547766,0.0010279512082049607,-0.007295763560103511,0.0006967544255853303,-0.01013242001763099,0.0073259115995467985,0.012189887326072178,0.005806395328359978,0.0015114035470770136,0.022835513355004583,-0.004815196322861144,-0.0018248290860823021,0.012473084050016429,-0.010171457110561975,-0.0010391317832460166,0.05137909049509048,-0.007331139378984753],
    perc: [-3.6742672528122484,0.05289845497213016,-0.08055607875498884,-0.007508340244192409,0.06602774600079231,0.009009080799704363,0.1409511660352286,-0.007799436070368573,-0.041468579291313264,-0.11604216206375016,0.005842963850665569,0.01448274412554705,-0.08440848377260422,-0.05245014306388019,-0.05315774010552688,-0.018936008330354106,-0.026489438570819834,0.01947741244993944,-0.021987887872929948,-0.06912548386289234,-0.037038382264017074,-0.014030687557347038,-0.05920042408830976,0.02194965645199322,-0.009856745007745027,-0.005475922660340743,0.12323386077274981,0.014143114112800751,0.09799724595148672],
  },
};

const finite = (x) => Number.isFinite(x) ? x : 0;
function modelVector(r) { const f=r.features||{}, clip=(x,a=-40,b=40)=>Math.max(a,Math.min(b,finite(x))); return [r.rule?1:0,r.neural?1:0,...['kick','snare','hat','tom','cymbal','perc'].map(c=>r.ruleLabel===c?1:0),...r.activations,r.relativeLevel,clip(f.lowRise)/20,clip(f.brightRise)/20,clip(f.lowMinusBright)/20,clip(f.lowMinusMid)/20,clip(f.highMinusMid)/20,clip(f.brightMinusMid)/20,clip(f.decay,0,3),clip(f.lateDecay,0,3),clip(f.rise)/20,clip(f.midRise)/20,clip(f.highRise)/20,clip(f.lowPeakHz,0,500)/250,clip(f.lowTonality,0,1),clip(f.brightTonality,0,1)]; }
function keepProbability(row, model) { const x=modelVector(row); let z=model.weights[0]; for(let i=0;i<x.length;i++)z+=model.weights[i+1]*(x[i]-model.mean[i])/model.sd[i]; return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z)))); }
export function hybridKeepProbability(row, model=HYBRID_MODEL) { return keepProbability(row,model); }
function classProbability(row,weights,model){const x=modelVector(row);let z=weights[0];for(let i=0;i<x.length;i++)z+=weights[i+1]*(x[i]-model.mean[i])/model.sd[i];return 1/(1+Math.exp(-Math.max(-30,Math.min(30,z))));}
function learnedClass(row,model){const scores=Object.fromEntries(Object.entries(model.classWeights).map(([name,w])=>[name,classProbability(row,w,model)]));let label=Object.keys(scores).reduce((a,b)=>scores[b]>scores[a]?b:a);if(row.rule&&scores[row.ruleLabel]>=scores[label]-.1)label=row.ruleLabel;return label;}

function primaryNeural(activations){const all=neuralPeaks(activations).map(p=>({time:p.coarse,label:ADTOF_CLASSES[p.classIndex],score:p.value})).sort((a,b)=>b.score-a.score),out=[];for(const p of all)if(!out.some(q=>Math.abs(q.time-p.time)<MERGE_SECONDS))out.push(p);return out;}

export function detectHybrid(channels, sampleRate, { activations = null, sensitivity = 1, maxOnsets = 63, model = HYBRID_MODEL } = {}) {
  if (!activations || !model) {
    const times = detectOnsets(channels, sampleRate, { sensitivity, maxOnsets });
    return { times, labels: classifyHits(channels, sampleRate, times) };
  }
  const candidates = hybridCandidates(channels, sampleRate, activations, { sensitivity }); const out=primaryNeural(activations);
  for(const p of out){const row=candidates.reduce((best,x)=>Math.abs(x.time-p.time)<.03&&(!best||Math.abs(x.time-p.time)<Math.abs(best.time-p.time))?x:best,null);if(row)p.label=learnedClass(row,model);}
  for(const row of candidates){if(!row.rule||out.some(p=>Math.abs(p.time-row.time)<MERGE_SECONDS))continue;const score=keepProbability(row,model),quiet=score>=.2&&(row.ruleLabel==='cymbal'||(row.ruleLabel==='snare'&&row.relativeLevel>.25));if(score>=.4||quiet)out.push({time:row.time,label:learnedClass(row,model),score});}
  const kept=out.sort((a,b)=>b.score-a.score).slice(0,maxOnsets).sort((a,b)=>a.time-b.time);
  // ADTOF frames are 10 ms and lag the hit: put every marker on the sample-accurate rise next to it (a slice must start on the hit, not near it).
  const snapped = kept.map((x) => { if (x.time <= 0.002) return x; const t = refineOnsetTime(channels, sampleRate, x.time); return { ...x, time: Math.abs(t - x.time) <= 0.012 && t > 0 ? t : x.time }; }).sort((a, b) => a.time - b.time);
  return {times:snapped.map(x=>x.time),labels:snapped.map(x=>x.label)};
}
