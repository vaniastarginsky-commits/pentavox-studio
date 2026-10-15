// Pure authoring model. Expressions are parsed rather than executed as JavaScript.
export const RESOURCE_LIMITS = Object.freeze({
  maxEntries: 16,
  wavetableBytes: 8192,
  terrainBytes: 4096,
  waveCount: 64,
  waveSamples: 128,
  terrainSize: 64,
});
const sizes = { wavetable: 8192, terrain: 4096 },
  counts = { wavetable: 3, terrain: 8 };
const funcs = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  exp: Math.exp,
  log: Math.log,
  abs: Math.abs,
  sqrt: Math.sqrt,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
};
export function compileWaveEquation(expression, variables = ["x", "y", "phi"]) {
  if (
    typeof expression !== "string" ||
    !expression.trim() ||
    expression.length > 1024
  )
    throw Error("Equation requires 1–1024 characters");
  const tokens =
    expression.match(
      /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_][A-Za-z_0-9]*|\*\*|[^\s]/g,
    ) || [];
  if (tokens.length > 256) throw Error("Equation is too complex");
  let pos = 0;
  function parse(min = 0, depth = 0) {
    if (depth > 32) throw Error("Equation nesting is too deep");
    const token = tokens[pos++];
    let left;
    if (token === "+" || token === "-") {
      const arg = parse(3, depth + 1);
      left = (v) => (token === "-" ? -arg(v) : arg(v));
    } else if (token === "(") {
      left = parse(0, depth + 1);
      if (tokens[pos++] !== ")") throw Error("Expected closing parenthesis");
    } else if (/^(?:\d|\.)/.test(token || "")) {
      const n = Number(token);
      if (!Number.isFinite(n)) throw Error("Invalid number");
      left = () => n;
    } else if (token === "pi" || token === "e")
      left = () => (token === "pi" ? Math.PI : Math.E);
    else if (variables.includes(token)) left = (v) => v[token] ?? 0;
    else if (Object.hasOwn(funcs, token)) {
      if (tokens[pos++] !== "(") throw Error("Expected arguments");
      const args = [parse(0, depth + 1)];
      while (tokens[pos] === ",") {
        pos++;
        args.push(parse(0, depth + 1));
      }
      if (
        tokens[pos++] !== ")" ||
        args.length !== (["min", "max", "pow"].includes(token) ? 2 : 1)
      )
        throw Error("Invalid arguments");
      left = (v) => funcs[token](...args.map((arg) => arg(v)));
    } else throw Error("Unknown equation token: " + (token ?? "end"));
    while (pos < tokens.length) {
      const op = tokens[pos],
        p = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 4, "**": 4 }[op];
      if (!p || p < min) break;
      pos++;
      const right = parse(p + (p === 4 ? 0 : 1), depth + 1),
        prev = left;
      left = (v) => {
        const a = prev(v),
          b = right(v);
        return op === "+"
          ? a + b
          : op === "-"
            ? a - b
            : op === "*"
              ? a * b
              : op === "/"
                ? a / b
                : op === "%"
                  ? a % b
                  : a ** b;
      };
    }
    return (v) => {
      const n = left(v);
      if (!Number.isFinite(n))
        throw Error("Equation produced a non-finite value");
      return n;
    };
  }
  const result = parse();
  if (pos !== tokens.length) throw Error("Unexpected equation token");
  return result;
}
function encode(bytes) {
  let s = "";
  for (const b of new Uint8Array(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ))
    s += String.fromCharCode(b);
  return btoa(s);
}
export function decodeResourceEntry(entry, kind) {
  if (
    !Object.hasOwn(sizes, kind) ||
    entry?.type !== "sampled" ||
    typeof entry.data !== "string" ||
    entry.data.length !== 4 * Math.ceil(sizes[kind] / 3) ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(entry.data)
  )
    throw Error("Invalid resource data");
  let s;
  try {
    s = atob(entry.data);
  } catch {
    throw Error("Invalid base64 resource");
  }
  if (s.length !== sizes[kind])
    throw Error("Expected " + sizes[kind] + " bytes");
  const bytes = Int8Array.from(s, (c) => c.charCodeAt(0));
  if (encode(bytes) !== entry.data)
    throw Error("Non-canonical base64 resource");
  return bytes;
}
export function defaultResources() {
  return {
    wavetable: {
      entries: Array.from({ length: 3 }, (_, index) => ({
        type: "factory",
        index,
      })),
      mirrored: true,
    },
    terrain: {
      entries: Array.from({ length: 8 }, (_, index) => ({
        type: "factory",
        index,
      })),
    },
  };
}
export function normalizeResources(resources = {}) {
  if (!resources || typeof resources !== "object" || Array.isArray(resources))
    throw Error("Invalid resources");
  for (const kind of Object.keys(resources)) {
    if (!Object.hasOwn(sizes, kind))
      throw Error("Unknown resource bank: " + kind);
  }
  const result = {};
  for (const kind of Object.keys(sizes)) {
    const bank = resources[kind];
    if (bank === undefined) continue;
    if (
      !bank ||
      !Array.isArray(bank.entries) ||
      !bank.entries.length ||
      bank.entries.length > 16
    )
      throw Error("Banks require 1–16 entries");
    result[kind] = {
      entries: Array.from(bank.entries, (entry) => {
        if (entry?.type === "factory") {
          if (
            !Number.isInteger(entry.index) ||
            entry.index < 0 ||
            entry.index >= counts[kind]
          )
            throw Error("Invalid factory index");
          return { type: "factory", index: entry.index };
        }
        decodeResourceEntry(entry, kind);
        if (
          typeof entry.name !== "string" ||
          !entry.name.trim() ||
          entry.name.length > 80
        )
          throw Error("Name requires 1–80 characters");
        if (
          entry.equation !== undefined &&
          (typeof entry.equation !== "string" || entry.equation.length > 1024)
        )
          throw Error("Invalid equation");
        return {
          type: "sampled",
          name: entry.name,
          data: entry.data,
          ...(entry.equation !== undefined ? { equation: entry.equation } : {}),
        };
      }),
    };
    if (kind === "wavetable") {
      if (bank.mirrored !== undefined && typeof bank.mirrored !== "boolean")
        throw Error("Invalid mirrored setting");
      result[kind].mirrored = bank.mirrored ?? true;
    }
  }
  return result;
}
function sampled(name, equation, kind) {
  const evaluate = compileWaveEquation(equation),
    values = new Float64Array(sizes[kind]);
  let peak = 1;
  for (let i = 0; i < values.length; i++) {
    const x =
      kind === "terrain" ? (i % 64) / 31 - 1 : (Math.floor(i / 128) % 8) / 7;
    const y =
      kind === "terrain"
        ? Math.floor(i / 64) / 31 - 1
        : Math.floor(i / 1024) / 7;
    values[i] = evaluate({ x, y, phi: (2 * Math.PI * (i % 128)) / 128 });
    peak = Math.max(peak, Math.abs(values[i]));
  }
  const scale = kind === "terrain" ? 128 : 127;
  const entry = {
    type: "sampled",
    name,
    equation,
    data: encode(
      Int8Array.from(values, (v) =>
        Math.max(-128, Math.min(127, Math.round((v / peak) * scale))),
      ),
    ),
  };
  normalizeResources({ [kind]: { entries: [entry] } });
  return entry;
}
export const sampleWavetableEquation = (name, equation) =>
  sampled(name, equation, "wavetable");
export const sampleTerrainEquation = (name, equation) =>
  sampled(name, equation, "terrain");
export function importPaletteResources(config) {
  const source = config?.recipe?.resources ?? config?.resources ?? config;
  if (source?.wavetable || source?.terrain) {
    // Import wrappers can carry provenance; strict recipe validation remains
    // the responsibility of normalizeResources rather than this converter.
    return normalizeResources(
      Object.fromEntries(
        ["wavetable", "terrain"]
          .filter((kind) => source[kind] !== undefined)
          .map((kind) => [kind, source[kind]]),
      ),
    );
  }
  const result = {};
  for (const [key, kind] of [
    ["wavetableBank", "wavetable"],
    ["terrainBank", "terrain"],
    ["terrains", "terrain"],
  ]) {
    if (!source?.[key]) continue;
    const bank = source[key];
    // Palette schema 26+ wraps Wavetable entries with scan options.
    // Its waveLines describe other engines and are outside this importer.
    const wrapped = kind === "wavetable" && !Array.isArray(bank);
    const entries = wrapped ? bank.entries : bank;
    if (!Array.isArray(entries) || entries.length > 16)
      throw Error("Invalid resource bank");
    result[kind] = {
      entries: entries.map((item) => {
        if (item.kind === "factory")
          return {
            type: "factory",
            index: Number(String(item.id).replace("factory-", "")) - 1,
          };
        const model = item.model ?? item;
        return {
          type: "sampled",
          name: model.name,
          data: model.data,
          ...(model.equation ? { equation: model.equation } : {}),
        };
      }),
      ...(kind === "wavetable"
        ? { mirrored: wrapped ? (bank.mirrored ?? true) : true }
        : {}),
    };
  }
  if (!Object.keys(result).length) throw Error("No wave resources found");
  return normalizeResources(result);
}
export function importWavetableWav(name, arrayBuffer, { waveCount = 64 } = {}) {
  if (waveCount !== 1 && waveCount !== 64)
    throw Error("WAV must contain 1 or 64 waves");
  if (
    !(arrayBuffer instanceof ArrayBuffer) ||
    arrayBuffer.byteLength > 32 * 1024 * 1024 ||
    arrayBuffer.byteLength < 44
  )
    throw Error("Invalid or oversized WAV");
  const view = new DataView(arrayBuffer),
    tag = (p) => String.fromCharCode(...new Uint8Array(arrayBuffer, p, 4));
  const riffEnd = view.getUint32(4, true) + 8;
  if (
    tag(0) !== "RIFF" ||
    tag(8) !== "WAVE" ||
    riffEnd > view.byteLength ||
    riffEnd < 44
  )
    throw Error("Invalid WAV header");
  let format, channels, bits, block, dataOffset, dataLength;
  for (let p = 12; p + 8 <= riffEnd; ) {
    const size = view.getUint32(p + 4, true),
      start = p + 8;
    if (start + size > riffEnd) throw Error("Truncated WAV chunk");
    if (tag(p) === "fmt ") {
      if (size < 16) throw Error("Invalid WAV format");
      format = view.getUint16(start, true);
      channels = view.getUint16(start + 2, true);
      block = view.getUint16(start + 12, true);
      bits = view.getUint16(start + 14, true);
    }
    if (tag(p) === "data") {
      dataOffset = start;
      dataLength = size;
    }
    p = start + size + (size & 1);
  }
  if (
    ![1, 2].includes(channels) ||
    !(
      (format === 1 && [8, 16, 24, 32].includes(bits)) ||
      (format === 3 && bits === 32)
    ) ||
    block !== (channels * bits) / 8 ||
    !dataLength ||
    dataLength % block
  )
    throw Error("Unsupported WAV format");
  const frames = dataLength / block;
  if (dataOffset === undefined || frames < waveCount * 2 || frames % waveCount)
    throw Error("WAV requires equally sized wave frames of at least 2 samples");
  function read(frame) {
    let value = 0;
    for (let ch = 0; ch < channels; ch++) {
      const p = dataOffset + frame * block + (ch * bits) / 8;
      let s;
      if (format === 3) s = view.getFloat32(p, true);
      else if (bits === 8) s = (view.getUint8(p) - 128) / 128;
      else if (bits === 16) s = view.getInt16(p, true) / 32768;
      else if (bits === 32) s = view.getInt32(p, true) / 2147483648;
      else {
        let n =
          view.getUint8(p) |
          (view.getUint8(p + 1) << 8) |
          (view.getUint8(p + 2) << 16);
        if (n & 0x800000) n -= 0x1000000;
        s = n / 8388608;
      }
      if (!Number.isFinite(s)) throw Error("Non-finite WAV sample");
      value += s / channels;
    }
    return value;
  }
  // Inspect skipped source frames too, so invalid float data cannot hide in downsampling.
  for (let i = 0; i < frames; i++) read(i);
  const bytes = new Int8Array(8192);
  const frameLength = frames / waveCount;
  // Each source frame is one periodic cycle. Wrap interpolation inside that
  // cycle, so neighboring waves never bleed into one another.
  for (let wave = 0; wave < 64; wave++) {
    const base = (wave % waveCount) * frameLength;
    for (let phase = 0; phase < 128; phase++) {
      const position = (phase * frameLength) / 128,
        a = Math.floor(position),
        fraction = position - a;
      const value =
        read(base + a) * (1 - fraction) +
        read(base + ((a + 1) % frameLength)) * fraction;
      bytes[wave * 128 + phase] = Math.round(
        Math.max(-1, Math.min(1, value)) * 127,
      );
    }
  }
  const entry = { type: "sampled", name, data: encode(bytes) };
  normalizeResources({ wavetable: { entries: [entry] } });
  return entry;
}
