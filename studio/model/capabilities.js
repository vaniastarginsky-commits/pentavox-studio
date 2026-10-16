// Capabilities are inferred from fields emitted by the connected firmware's
// HostLink descriptor. No Studio build-time voice-count constants live here.
const contiguous = (index, suffix) => {
  let count = 0;
  while (index.has(`voice.${count}.${suffix}`)) count += 1;
  return count;
};

export function moduleCapabilities(index) {
  const plaitsVoices = contiguous(index, 'engine');
  const noteVoices = contiguous(index, 'pitch_source');
  const samplerVoices = Math.max(0, noteVoices - plaitsVoices);
  const granularEnabled = [...index.values()].some((field) =>
    field?.id === 'f1.0' && field?.name === 'Density');
  const tapeEnabled = index.get('f0.2')?.name === 'Tape Speed';
  // The compact build (2 Plaits + 1 sampler, no Tape, no Granular) puts its Master page in the slot granular would have.
  const masterPage = plaitsVoices === 2 && samplerVoices === 1 && !granularEnabled && !tapeEnabled;
  return Object.freeze({ plaitsVoices, samplerVoices, noteVoices, granularEnabled, tapeEnabled, masterPage });
}
