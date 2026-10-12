const FIELD_SIZES = Object.freeze({ enum: 1, f32: 4 });

export function indexDescriptor(descriptor) {
  const index = new Map();
  const counts = new Map();
  for (const component of descriptor.components ?? []) {
    const local = new Set();
    for (const field of component.fields ?? []) {
      if (local.has(field.id)) throw new Error(`duplicate field id: ${field.id}`);
      local.add(field.id);
      counts.set(field.id, (counts.get(field.id) ?? 0) + 1);
    }
  }
  for (const component of descriptor.components ?? []) {
    const compOff = Number(component.off ?? 0);
    for (const source of component.fields ?? []) {
      const size = FIELD_SIZES[source.type];
      if (!size) continue;
      const off = Number(source.off);
      const key = counts.get(source.id) === 1 ? source.id : `${component.id}:${source.id}`;
      index.set(key, {
        ...source,
        id: source.id,
        comp: component.id,
        compOff,
        off,
        type: source.type,
        size,
        abs: compOff + off,
      });
    }
  }
  return index;
}

function fieldView(bytes, field) {
  if (field.abs < 0 || field.abs + field.size > bytes.length) {
    throw new RangeError(`field ${field.id} lies outside blob`);
  }
  return new DataView(bytes.buffer, bytes.byteOffset + field.abs, field.size);
}

export function readField(bytes, field) {
  const data = fieldView(bytes, field);
  if (field.type === 'enum') return data.getUint8(0);
  if (field.type === 'f32') return data.getFloat32(0, true);
  throw new TypeError(`unsupported field type: ${field.type}`);
}

export function writeField(bytes, field, value) {
  const data = fieldView(bytes, field);
  if (field.type === 'enum') data.setUint8(0, value);
  else if (field.type === 'f32') data.setFloat32(0, value, true);
  else throw new TypeError(`unsupported field type: ${field.type}`);
}
