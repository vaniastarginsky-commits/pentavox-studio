// Reading and writing the three DX7 bank files on the module's SD card (the firmware loads /DX7/BANK_A|B|C.SYX).
import { HostLinkError } from '../hostlink/client.js';

export const BANK_PATHS = Object.freeze(Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => [letter, `/DX7/BANK_${letter}.SYX`])));
const NOT_FOUND = 12;

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

/** The bytes of each bank file, null for a file that is not on the card. Other errors are thrown. */
export async function readBanksFromSd(files) {
  const out = {};
  for (const letter of Object.keys(BANK_PATHS)) {
    try { out[letter] = await files.download(BANK_PATHS[letter]); }
    catch (error) {
      if (error instanceof HostLinkError && error.status === NOT_FOUND) out[letter] = null;
      else throw error;
    }
  }
  return out;
}

/** Writes every non-null bank, then reads each one back and compares. A null bank is skipped, not deleted. */
export async function writeBanksToSd(files, banks, { onProgress = () => {} } = {}) {
  const written = []; const skipped = [];
  const letters = Object.keys(BANK_PATHS);
  for (const [index, letter] of letters.entries()) {
    const bytes = banks[letter];
    if (!bytes) { skipped.push(letter); continue; }
    await files.upload(BANK_PATHS[letter], bytes, { overwrite: true, makeParents: true });
    const back = await files.download(BANK_PATHS[letter]);
    if (!sameBytes(back, bytes)) throw new Error(`Verification failed: bank ${letter} on the card differs from what was written.`);
    written.push(letter);
    onProgress((index + 1) / letters.length);
  }
  return { written, skipped };
}
