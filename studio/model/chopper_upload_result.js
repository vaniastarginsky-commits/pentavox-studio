// SD persistence, live staging and audible playback are separate outcomes.
export function describePatternUpload(result) {
  if (!result || !['uploaded', 'sent', 'failed'].includes(result.state))
    throw Error('Invalid pattern upload confirmation. Inspect module SD before retrying.');
  const stored = Array.isArray(result.stored) ? result.stored : [];
  const live = Array.isArray(result.live) ? result.live : [];
  const answers = live.map(entry => {
    const name = entry.slot === 0 ? 'A' : entry.slot === 1 ? 'B' : String(entry.slot);
    if (entry.error) return `Chopper ${name}: no live confirmation (${entry.error})`;
    if (entry.result === 'noGrid') return `Chopper ${name}: not staged — no loop grid in this module slot`;
    return `Chopper ${name}: ${entry.result}${entry.windowQuarters ? ` on a ${entry.windowQuarters}-quarter grid` : ''}`;
  });
  const storageErrors=Array.isArray(result.storage)?result.storage.filter(s=>s.error):[];
  const expectedFiles=Array.isArray(result.banks)?result.banks.length:2;
  const waiting = live.some(entry => entry.result === 'noGrid');
  const failed = live.some(entry => entry.error || !['staged', 'gridAdapted', 'noGrid'].includes(entry.result));
  const text = [
    stored.length ? `Stored ${stored.join(' and ')} on module SD.` : 'No pattern files stored on SD.',
    ...storageErrors.map(s=>`SD ${s.slot?'B':'A'}: no complete write confirmation (${s.error}); inspect the file before retrying.`),
    ...(Array.isArray(result.banks)?result.banks.map(b=>`Requested bank ${b.slot?'B':'A'}: ${b.patterns} patterns, ${b.bytes} bytes${b.names?.length?` (${b.names.join(', ')})`:''}.`):[]),
    ...answers,
    !live.length ? 'Not staged live.' : '',
    waiting ? 'Load or record a loop in the indicated module slots, then send the patterns again. A WAV in Studio is not a loop loaded in the module. No reboot is required for live staging.' : '',
    failed ? 'A live transfer failed. Inspect the connection before retrying; successful slots may already have changed.' : '',
    'Boot loading and audible playback are not verified by this transfer.',
  ].filter(Boolean).join(' ');
  return { message: text, error: result.state==='failed' || storageErrors.length>0 || failed || (waiting && stored.length !== expectedFiles) };
}
