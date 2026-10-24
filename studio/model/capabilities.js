// Capabilities are inferred from fields emitted by the connected firmware's
// HostLink descriptor. No Studio build-time voice-count constants live here.
const contiguous = (index, suffix) => {
  let count = 0;
  while (index.has(`voice.${count}.${suffix}`)) count += 1;
  return count;
};

export function moduleCapabilities(index) {
  const logicalPlaits = Number(index.firmware?.logicalPlaits) || contiguous(index, 'engine');
  const plaitsVoices = Number(index.firmware?.activePlaits) || logicalPlaits;
  const noteVoices = contiguous(index, 'pitch_source');
  const samplerVoices = Math.max(0, noteVoices - logicalPlaits);
  const granularEnabled = [...index.values()].some((field) =>
    field?.id === 'f1.0' && field?.name === 'Density');
  const tapeEnabled = index.get('f0.2')?.name === 'Tape Speed';
  // The compact build (2 Plaits + 1 sampler, no Tape, no Granular) puts its Master page in the slot granular would have.
  const masterPage = plaitsVoices <= 2 && samplerVoices === 1 && !granularEnabled && !tapeEnabled;
  if(!index.firmware) return Object.freeze({plaitsVoices,samplerVoices,noteVoices,granularEnabled,tapeEnabled,masterPage});
  return Object.freeze({ plaitsVoices, logicalPlaits, samplerVoices, noteVoices, granularEnabled, tapeEnabled, masterPage,
    noteVoiceIndices: [...Array.from({length:plaitsVoices},(_,i)=>i),...Array.from({length:samplerVoices},(_,i)=>logicalPlaits+i)],
    firmwareProfile:index.firmware?.profile??null, panelVersion:index.firmware?.panelVersion??0,
    looper:Boolean(index.firmware?.looper),multitap:Boolean(index.firmware?.multitap),crossFm:index.firmware?.crossFm!==0,sidechain:index.firmware?.sidechain!==0,phaser:index.firmware?.phaser!==0 });
}
