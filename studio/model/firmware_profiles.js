// Build target is a user choice. Connected-module capabilities are independent.
export const FIRMWARE_PROFILES = Object.freeze([
  { id: 'sampler', label: '2 Plaits + Sampler', plaitsVoices: 2, looper: false },
  { id: 'looper', label: '2 Plaits + Looper', plaitsVoices: 2, looper: true },
  { id: 'single-plaits', label: '1 Plaits + Looper · experimental', plaitsVoices: 1, looper: true },
].map(Object.freeze));
export function firmwareProfile(id = 'sampler') {
  const profile=FIRMWARE_PROFILES.find(p=>p.id===id);
  if(!profile) throw new RangeError(`Unknown firmware profile: ${id}`);
  return profile;
}
export function recipeForProfile(recipe, profile) {
  const target=firmwareProfile(profile);
  const result=structuredClone(recipe);
  if(result.voices?.length===3) {
    // Keep v2's three logical banks; unused banks must not inflate the engine union.
    for(let i=target.plaitsVoices;i<3;++i) result.voices[i]=structuredClone(result.voices[0]);
  }
  return result;
}
export function describedFirmware(descriptor) {
  if(Number(descriptor?.pentavox?.version)===1) return descriptor.pentavox;
  // Compatibility with the already-built one-voice experimental images.
  if(/^Single Plaits experiment/i.test(descriptor?.manual?.tagline??''))
    return {version:1,profile:'single-plaits',activePlaits:1,logicalPlaits:2,looper:1,panelVersion:2,multitap:1,crossFm:0,sidechain:0,phaser:0};
  return null;
}
