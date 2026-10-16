import { noteSourceRows } from './settings_vm.js';

const GROUPS = Object.freeze([
  ['basecv', 'Base CV (J3–J8)'],
  ['panelpot', 'Panel pots'],
  ['route', 'Expander'],
]);

export function sourceKey(source) {
  return `${source.bank}:${source.key}:${source.ch}`;
}

function labelFor(source, includeBank = false) {
  return `${source.name}${includeBank ? ` (${source.bank})` : ''}`;
}

export function rowsView(table, source, destinations) {
  const rows = [];
  const counts = new Map();
  for (let k = 0; k < 4; ++k) {
    const route = table.get(source, k);
    if (route.dest === 0) continue;
    counts.set(route.dest, (counts.get(route.dest) ?? 0) + 1);
    rows.push({
      k,
      destId: route.dest,
      destLabel: destinations.label(route.dest),
      depthPct: Math.round(route.depth * 100),
      duplicate: false,
    });
  }
  return rows.map((row) => ({ ...row, duplicate: counts.get(row.destId) > 1 }));
}

export function sourceGroups(table, destinations, bank = 'A', settings) {
  const noteInputs = settings ? cvNotesView(settings).inputs : [];
  return GROUPS.map(([key, title]) => ({
    title,
    sources: table.sources().filter((source) => source.key === key && source.bank === bank).map((source) => {
      const rows = rowsView(table, source, destinations);
      const names = rows.slice(0, 2).map((row) => row.destLabel).join(', ');
      return {
        key: sourceKey(source),
        source,
        label: labelFor(source),
        count: rows.length,
        canAdd: canAdd(table, source),
        noteChips: ((source.key === 'basecv' || source.key === 'route') && source.ch < 6) ? (noteInputs[source.ch]?.chips ?? []) : [],
        summary: `${names}${rows.length > 2 ? '…' : ''}`,
      };
    }),
  })).filter((group) => group.sources.length);
}

function listNames(names) {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export function cvNotesView(table) {
  const rows = noteSourceRows(table, { pitch: 'V/Oct from', gate: 'Gate from' });
  const inputs = Array.from({ length: 6 }, (_, index) => ({ cv: index + 1, chips: [] }));
  const pitches = new Map();
  for (const row of rows) {
    const [pitch, gate] = row.controls;
    if (pitch.value > 0 && pitch.value <= 6) {
      inputs[pitch.value - 1].chips.push({ kind: 'pitch', label: `V/Oct: ${row.label}`, voice: row.voice });
      const voices = pitches.get(pitch.value) ?? [];
      voices.push(row.label); pitches.set(pitch.value, voices);
    }
    if (gate.value > 0 && gate.value <= 6) inputs[gate.value - 1].chips.push({ kind: 'gate', label: `Gate: ${row.label}`, voice: row.voice });
  }
  const conflicts = [...pitches].filter(([, voices]) => voices.length > 1).map(([cv, voices]) => ({
    cv,
    voices,
    text: `CV ${cv} is the V/Oct of ${listNames(voices)}`,
  }));
  return { rows, conflicts, inputs };
}

export function canAdd(table, source) {
  return table.rows(source).length < 4;
}

export function usedBy(table, destId) {
  return table.sources().flatMap((source) => rowsView(table, source, { label: String })
    .filter((row) => row.destId === destId)
    .map((row) => ({
      sourceLabel: labelFor(source),
      bank: source.bank,
      k: row.k,
      depthPct: row.depthPct,
      source,
    })));
}

export function depthFromPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(-1, Math.min(1, number / 100));
}
