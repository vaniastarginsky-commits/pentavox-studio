// Opt-in Chopper PVXP v2/v3 BODY codecs. Legacy encodeBank/decodeBank stay v1-only.
// Layout: v2,count,chainLength,chain[],roles[count],then v1 pattern/event records.
// Role bytes: base=0, variation=1, fill=2. v3 adds cuePolicy=1 (4/4 half-bar grid). No roles inferred from names/chain.
import {encodeBank, decodeBank} from './break_pattern.js';
export const CHOPPER_ROLES = Object.freeze(['base', 'variation', 'fill']);
export const MAX_CHOPPER_BYTES = 8236;
export const CHOPPER_GRIDS = Object.freeze({'half-bar-grid-v1':8,'quarter-note-grid-v1':4,'eighth-note-grid-v1':2});
export function chopperGridStep(policy) { return Object.hasOwn(CHOPPER_GRIDS,policy) ? CHOPPER_GRIDS[policy] : 0; }
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const signed = v => v < 128 ? v : v - 256;

// Intentionally stricter than legacy decoding: no sorting, repair or clamping.
export function decodeChopperBank(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 3 || bytes.length > MAX_CHOPPER_BYTES || (bytes[0] !== 2 && bytes[0] !== 3 && bytes[0] !== 4)) return null;
  const version=bytes[0],count = bytes[1], length = bytes[2];
  if (count < 1 || count > 8 || length > 16 || bytes.length < 3 + length + count) return null;
  for (let i = 0; i < length; i++) if (bytes[3+i] >= count) return null;
  const roleBytes = bytes.subarray(3+length,3+length+count);
  if ([...roleBytes].some(v => v > 2) || !roleBytes.includes(0)) return null;
  let at = 3+length+count;
  let policy=0;
  if(version>=3){policy=bytes[at++];if(version===3 ? policy!==1 : (policy!==2&&policy!==3))return null;}
  for (let p = 0; p < count; p++) {
    if (at+2 > bytes.length) return null;
    const steps = bytes[at++]*16, n = bytes[at++];
    if (steps < 16 || steps > 128 || n > 128 || at+n*8 > bytes.length) return null;
    let end = 0;
    for (let e = 0; e < n; e++, at += 8) {
      const step = bytes[at], src = signed(bytes[at+1]), len = bytes[at+2], flags = bytes[at+3];
      if ((flags & 128) || (flags & 7) > 5 || ((flags >> 3) & 3) > 2
          || step < end || step >= steps || !len || step+len > steps || src < -2 || src >= 64
          || Math.abs(signed(bytes[at+6])) > 12 || Math.abs(signed(bytes[at+7])) > 12) return null;
      end = step+len;
    }
  }
  if (at !== bytes.length) return null;
  const policyBytes=version>=3?1:0;
  const v1 = new Uint8Array(bytes.length-count-policyBytes);
  v1.set(bytes.subarray(0,3+length)); v1[0] = 1;
  v1.set(bytes.subarray(3+length+count+policyBytes),3+length);
  const bank = decodeBank(v1);
  return {...bank, roles: [...roleBytes].map(v => CHOPPER_ROLES[v]), ...(version>=3?{cuePolicy:Object.keys(CHOPPER_GRIDS)[policy-1]}:{})};
}

export function encodeChopperBank(bank) {
  const patterns = bank?.patterns, chain = bank?.chain, roles = bank?.roles;
  if (!Array.isArray(patterns) || !integer(patterns.length,1,8)
      || !Array.isArray(chain) || chain.length > 16 || [...chain].some(v => !integer(v,0,patterns.length-1))
      || !Array.isArray(roles) || roles.length !== patterns.length
      || [...roles].some(v => !CHOPPER_ROLES.includes(v)) || !roles.includes('base'))
    throw new RangeError('Chopper bank requires 1–8 patterns, a valid chain and explicit roles including BASE');
  for (const p of patterns) {
    if (!integer(p?.steps,16,128) || p.steps%16 || !Array.isArray(p.events) || p.events.length > 128)
      throw new RangeError('Invalid Chopper pattern');
    let end = 0;
    for (const e of p.events) {
      if (!e || !integer(e.step,end,p.steps-1) || !integer(e.len,1,p.steps-e.step)
          || !integer(e.src,-2,63) || ![1,2,3,4,6,8].includes(e.reps) || !integer(e.roll,0,2)
          || typeof e.rev !== 'boolean' || typeof e.gate !== 'boolean'
          || !integer(e.pitch0,-12,12) || !integer(e.pitch1,-12,12)
          || ![e.amp0,e.amp1].every(v => Number.isFinite(v) && v >= 0 && v <= 1))
        throw new RangeError('Invalid or overlapping Chopper event');
      end = e.step+e.len;
    }
  }
  const v1 = encodeBank({patterns,chain}), at = 3+chain.length;
  const out = new Uint8Array(v1.length+roles.length);
  out.set(v1.subarray(0,at)); out[0] = 2;
  out.set(roles.map(role => CHOPPER_ROLES.indexOf(role)),at);
  out.set(v1.subarray(at),at+roles.length);
  return out;
}

// Opt-in PVXP v3. v1 and v2 bytes/decoders are unchanged; byte 3+chain+roles
// declares the one cue interpretation understood by this firmware generation.
export function encodeChopperGridBank(bank) {
  const v2=encodeChopperBank(bank), count=bank?.patterns?.length;
  const out=new Uint8Array(v2.length+1); out.set(v2.subarray(0,3+bank.chain.length+count));
  const policy=bank.cuePolicy??'half-bar-grid-v1';
  if(!chopperGridStep(policy))throw new RangeError('Unknown Chopper grid policy');
  out[0]=policy==='half-bar-grid-v1'?3:4;
  out[3+bank.chain.length+count]=Object.keys(CHOPPER_GRIDS).indexOf(policy)+1;
  out.set(v2.subarray(3+bank.chain.length+count),4+bank.chain.length+count);
  return out;
}
