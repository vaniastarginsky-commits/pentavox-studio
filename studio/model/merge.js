const ROUTE_ID = /^(?:(?:route|routeB|panelpot|ppotB|basecv|basecvB)\.\d+\.\d+\.(?:dest|depth)|potmap\.\d+\.\d+\.\d+)$/;

export function isRouteField(field) {
  return ROUTE_ID.test(field.id);
}

export function merge3(base, fresh, mine, index, ownedFields) {
  if (base.length !== fresh.length || base.length !== mine.length) {
    throw new RangeError('merge blobs must have equal lengths');
  }
  if (!(ownedFields instanceof Set)) throw new TypeError('owned fields must be a Set');
  const output = Uint8Array.from(fresh);
  for (const field of index.values()) {
    if (!ownedFields.has(field.id)) continue;
    let changed = false;
    for (let i = 0; i < field.size; ++i) {
      if (mine[field.abs + i] !== base[field.abs + i]) {
        changed = true;
        break;
      }
    }
    if (changed) output.set(mine.subarray(field.abs, field.abs + field.size), field.abs);
  }
  return output;
}
