function degToRad(deg) {
  return (deg * Math.PI) / 180;
}
function obbVertices(o) {
  const r = degToRad(o.angle);
  const cos = Math.cos(r),
    sin = Math.sin(r);
  return [
    [o.hw, o.hh],
    [-o.hw, o.hh],
    [-o.hw, -o.hh],
    [o.hw, -o.hh],
  ].map(([x, y]) => [o.cx + x * cos - y * sin, o.cy + x * sin + y * cos]);
}
function obbAxes(o) {
  const r = degToRad(o.angle);
  const cos = Math.cos(r),
    sin = Math.sin(r);
  return [
    [cos, sin],
    [-sin, cos],
  ];
}
function projectOntoAxis(verts, axis) {
  const dots = verts.map(([x, y]) => x * axis[0] + y * axis[1]);
  return [Math.min(...dots), Math.max(...dots)];
}
function obbOverlap(a, b) {
  const va = obbVertices(a);
  const vb = obbVertices(b);
  for (const axis of [...obbAxes(a), ...obbAxes(b)]) {
    const [minA, maxA] = projectOntoAxis(va, axis);
    const [minB, maxB] = projectOntoAxis(vb, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}
function obbEdgeExtents(o) {
  const r = degToRad(o.angle);
  const cos = Math.abs(Math.cos(r)),
    sin = Math.abs(Math.sin(r));
  const extX = o.hw * cos + o.hh * sin;
  const extY = o.hh * cos + o.hw * sin;
  return { x1: o.cx - extX, x2: o.cx + extX, y1: o.cy - extY, y2: o.cy + extY };
}
function rearBoundsOBB(c, bounds, x = c.x, y = c.y) {
  const dx = bounds.x + bounds.width / 2;
  const dy = bounds.y + bounds.height / 2;
  const r = degToRad(c.rotation);
  return {
    cx: x + dx * Math.cos(r) - dy * Math.sin(r),
    cy: y + dx * Math.sin(r) + dy * Math.cos(r),
    hw: bounds.width / 2,
    hh: bounds.height / 2,
    angle: c.rotation,
  };
}
function makeBodyOBB(c) {
  // Conservative envelope includes the projecting sleeve contact.
  return rearBoundsOBB(c, getRearBodyBounds(c));
}
function makeKeepoutOBB(c) {
  return rearBoundsOBB(c, getRearKeepoutBounds(c));
}
function makeRearBodyFootprintOBBAt(c, x, y) {
  if (c.rearBodyW > 0 && c.rearBodyH > 0) {
    return rearBoundsOBB(c, getRearBodyBounds(c), x, y);
  }
  if (c.keepoutW > 0 && c.keepoutH > 0 && c.type !== "customrect") {
    return rearBoundsOBB(c, getRearKeepoutBounds(c), x, y);
  }
  const b = getFrontBounds(c);
  return {
    cx: x,
    cy: y,
    hw: b.w / 2,
    hh: b.h / 2,
    angle: getFrontShape(c) === "circle" ? 0 : c.rotation,
  };
}
function getRearBodyFootprintExtentsAt(c, x, y) {
  return obbEdgeExtents(makeRearBodyFootprintOBBAt(c, x, y));
}
function makeHoleOBB(c) {
  if (c.holeType === "slot") {
    return {
      cx: c.x,
      cy: c.y,
      hw: c.holeDiameter / 2,
      hh: (c.slotLength ?? c.holeDiameter) / 2,
      angle: c.rotation,
    };
  }
  if (c.holeType === "rect") {
    return {
      cx: c.x,
      cy: c.y,
      hw: (c.holeW ?? c.frontW ?? c.holeDiameter) / 2,
      hh: (c.holeH ?? c.frontH ?? c.holeDiameter) / 2,
      angle: c.rotation,
    };
  }
  return {
    cx: c.x,
    cy: c.y,
    hw: c.holeDiameter / 2,
    hh: c.holeDiameter / 2,
    angle: 0,
  };
}
