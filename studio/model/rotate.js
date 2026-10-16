// "Shift start": rotate a loop in time. A DAW's audio reaches the module later than its MIDI Start, so a take recorded on
// Start begins with the tail of the previous cycle and misses the last few milliseconds of its own. Moving the first N ms
// to the end puts that tail back where it belongs and the loop lines up. Pure; no DOM, no audio.

/** Rotate every channel left by `frames` (negative rotates right). Returns new arrays of the same length. */
export function rotateChannels(channels, frames) {
  return channels.map((channel) => {
    const n = channel.length; if (!n) return channel.slice();
    const shift = ((Math.trunc(frames) % n) + n) % n;
    const out = new Float32Array(n);
    out.set(channel.subarray(shift), 0); out.set(channel.subarray(0, shift), n - shift);
    return out;
  });
}

/**
 * Where the markers go when the audio is rotated left by `shiftSeconds` (negative = right) within `duration`.
 * `labels[0]` is the slice at the file start, `labels[i + 1]` the slice starting at `markers[i]`. The old start of the
 * file becomes a marker of its own (when there are slices) so no slice is lost, and the new first slice takes the label
 * of the slice that now covers the start.
 */
export function rotateMarkers(markers, labels, duration, shiftSeconds) {
  if (!(duration > 0)) return { markers: [], labels: ['other'] };
  const shift = ((shiftSeconds % duration) + duration) % duration;
  if (shift === 0) return { markers: markers.slice(), labels: labels.slice() };
  const pieces = [{ t: 0, label: labels?.[0] ?? 'other' }];
  markers.forEach((t, i) => pieces.push({ t, label: labels?.[i + 1] ?? 'other' }));
  const moved = pieces.map(({ t, label }) => ({ t: (t - shift + duration) % duration, label }));
  moved.sort((a, b) => a.t - b.t);
  const first = moved[0].t === 0 ? moved.shift() : { t: 0, label: moved[moved.length - 1].label };   // the slice that wraps over the new start
  const out = { markers: [], labels: [first.label] };
  for (const piece of moved) { if (piece.t - (out.markers.at(-1) ?? 0) < 1e-6) continue; out.markers.push(piece.t); out.labels.push(piece.label); }
  if (markers.length === 0) return { markers: [], labels: [labels?.[0] ?? 'other'] };
  return out;
}
