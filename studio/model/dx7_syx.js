// DX7 SysEx and voice helpers. A voice is the 128-byte packed form used inside a 32-voice bulk dump:
// 6 operators x 17 bytes (operator 6 first), pitch EG at 102-109, algorithm at 110, feedback at 111, name at 118-127.

export const VOICE_BYTES = 128;
export const BANK_VOICES = 32;
const BANK_DATA_BYTES = VOICE_BYTES * BANK_VOICES;

export function bytesToB64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
export function b64ToBytes(text) { return Uint8Array.from(atob(text), (c) => c.charCodeAt(0)); }
export const voiceKey = (voice) => bytesToB64(voice);

export function voiceName(voice) {
  let text = '';
  for (let i = 118; i < 128; i += 1) { const c = voice[i] & 0x7f; text += c >= 32 && c < 127 ? String.fromCharCode(c) : ' '; }
  return text.replace(/\s+$/, '');
}
export const voiceAlgorithm = (voice) => (voice[110] & 31) + 1;
export const voiceFeedback = (voice) => voice[111] & 7;

export function sysexChecksum(data) {
  let sum = 0;
  for (const byte of data) sum += byte;
  return (-sum) & 0x7f;
}

// An unpacked single voice (155 bytes) to the packed 128-byte form.
function packSingle(u) {
  const p = new Uint8Array(VOICE_BYTES);
  for (let o = 0; o < 6; o += 1) {
    const s = o * 21; const d = o * 17;
    for (let j = 0; j < 8; j += 1) p[d + j] = u[s + j] & 0x7f;
    p[d + 8] = u[s + 8] & 0x7f; p[d + 9] = u[s + 9] & 0x7f; p[d + 10] = u[s + 10] & 0x7f;
    p[d + 11] = (u[s + 11] & 3) | ((u[s + 12] & 3) << 2);
    p[d + 12] = (u[s + 13] & 7) | ((Math.min(u[s + 20], 14) & 15) << 3);
    p[d + 13] = (u[s + 14] & 3) | ((u[s + 15] & 7) << 2);
    p[d + 14] = u[s + 16] & 0x7f;
    p[d + 15] = (u[s + 17] & 1) | ((u[s + 18] & 31) << 1);
    p[d + 16] = u[s + 19] & 0x7f;
  }
  for (let j = 0; j < 8; j += 1) p[102 + j] = u[126 + j] & 0x7f;
  p[110] = u[134] & 31; p[111] = (u[135] & 7) | ((u[136] & 1) << 3);
  p[112] = u[137] & 0x7f; p[113] = u[138] & 0x7f; p[114] = u[139] & 0x7f; p[115] = u[140] & 0x7f;
  p[116] = (u[141] & 1) | ((u[142] & 7) << 1) | ((u[143] & 7) << 4);
  p[117] = u[144] & 0x7f;
  for (let j = 0; j < 10; j += 1) p[118 + j] = u[145 + j] & 0x7f;
  return p;
}

/** Voices from a .syx (32-voice bulk dumps, single-voice dumps) or a raw 4096-byte bank. Never throws on bad input. */
export function parseSyx(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const voices = []; const notes = [];
  if (bytes.length === BANK_DATA_BYTES) {
    for (let k = 0; k < BANK_VOICES; k += 1) voices.push(bytes.slice(k * VOICE_BYTES, (k + 1) * VOICE_BYTES));
    return { voices, notes };
  }
  let i = 0;
  while (i < bytes.length - 7) {
    if (bytes[i] === 0xf0 && bytes[i + 1] === 0x43 && (bytes[i + 2] & 0xf0) === 0) {
      const format = bytes[i + 3];
      if (format === 9 && i + 4104 <= bytes.length) {
        const data = bytes.subarray(i + 6, i + 6 + BANK_DATA_BYTES);
        if (sysexChecksum(data) !== bytes[i + 6 + BANK_DATA_BYTES]) notes.push('checksum mismatch (accepted)');
        for (let k = 0; k < BANK_VOICES; k += 1) voices.push(data.slice(k * VOICE_BYTES, (k + 1) * VOICE_BYTES));
        i += 4104; continue;
      }
      if (format === 0 && i + 163 <= bytes.length) {
        voices.push(packSingle(bytes.subarray(i + 6, i + 6 + 155)));
        i += 163; continue;
      }
    }
    i += 1;
  }
  return { voices, notes };
}

/** One 32-voice bulk dump. Fewer than 32 voices are spread evenly (slot k takes voice floor(k * n / 32)). */
export function buildBankSyx(voices) {
  const count = voices.length;
  if (count < 1) throw new RangeError('a bank needs at least one voice');
  const data = new Uint8Array(BANK_DATA_BYTES);
  for (let k = 0; k < BANK_VOICES; k += 1) data.set(voices[Math.min(count - 1, Math.floor((k * count) / BANK_VOICES))], k * VOICE_BYTES);
  const out = new Uint8Array(4104);
  out.set([0xf0, 0x43, 0x00, 0x09, 0x20, 0x00]);
  out.set(data, 6);
  out[6 + BANK_DATA_BYTES] = sysexChecksum(data);
  out[6 + BANK_DATA_BYTES + 1] = 0xf7;
  return out;
}

// Carrier operators (1-based, operator 1 is the last one in the packed form) per algorithm 1..32.
const CARRIERS = [null,
  [1, 3], [1, 3], [1, 4], [1, 4], [1, 3, 5], [1, 3, 5], [1, 3], [1, 3],            // algorithms 1-8
  [1, 3], [1, 4], [1, 4], [1, 3], [1, 3], [1, 3], [1, 3], [1],                       // 9-16
  [1], [1], [1, 4, 5], [1, 2, 4], [1, 2, 4, 5], [1, 3, 4, 5], [1, 2, 4, 5], [1, 2, 3, 4, 5],  // 17-24
  [1, 2, 3, 4, 5], [1, 2, 4], [1, 2, 4], [1, 3, 6], [1, 2, 3, 5], [1, 2, 3, 6], [1, 2, 3, 4, 5], [1, 2, 3, 4, 5, 6], // 25-32
];

/** Sound tags guessed from a voice's parameters, for imported files that carry no catalog tags. */
export function deriveTags(voice) {
  const carriers = CARRIERS[voiceAlgorithm(voice)] ?? [1];
  const base = (op) => (6 - op) * 17;                 // operator 1 is stored last
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const sustain = mean(carriers.map((op) => voice[base(op) + 6]));
  const attack = mean(carriers.map((op) => voice[base(op)]));
  let modulation = 0; let inharmonic = false;
  for (let op = 1; op <= 6; op += 1) {
    const at = base(op);
    const level = voice[at + 14];
    if (!carriers.includes(op)) modulation += level;
    if (level === 0) continue;
    const fixed = (voice[at + 15] & 1) === 1;
    const coarse = (voice[at + 15] >> 1) & 31;
    if (fixed || ![0, 1, 2, 3, 4, 6, 8].includes(coarse)) inharmonic = true;
  }
  const tags = [];
  tags.push(sustain < 20 ? 'percussive' : 'sustained');
  if (attack < 35) tags.push('slowAttack');
  tags.push(inharmonic ? 'inharmonic' : 'harmonic');
  tags.push(modulation > 150 ? 'bright' : 'dark');
  return tags;
}
