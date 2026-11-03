// Front-shape and DIP-8 socket geometry helpers.
// Depends on: degToRad, obbEdgeExtents (src/geometry/obbMath.js — loaded before this file).
function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    ax - aw / 2 < bx + bw / 2 &&
    ax + aw / 2 > bx - bw / 2 &&
    ay - ah / 2 < by + bh / 2 &&
    ay + ah / 2 > by - bh / 2
  );
}
function circleOverlap(ax, ay, ar, bx, by, br) {
  const dist = Math.hypot(bx - ax, by - ay);
  return ar + br - dist;
}
function getFrontShape(c) {
  if (
    c.frontShape === "rect" ||
    c.frontShape === "slot" ||
    c.frontShape === "circle"
  )
    return c.frontShape;
  if (
    c.holeType === "slot" ||
    (c.frontW !== undefined && c.frontH !== undefined)
  )
    return "slot";
  return "circle";
}
function dip8SocketBodyBounds() {
  return { w: 10.2, h: 10.2 };
}
function getFrontBounds(c) {
  if (isDip8Socket(c)) return dip8SocketBodyBounds();
  const shape = getFrontShape(c);
  if (shape !== "circle") {
    return {
      w: typeof c.frontW === "number" ? c.frontW : c.frontDiameter,
      h: typeof c.frontH === "number" ? c.frontH : c.frontDiameter,
    };
  }
  return { w: c.frontDiameter, h: c.frontDiameter };
}
function isDip8Socket(c) {
  return c.type === "dip8socket";
}
function isJoystick(c) {
  return c.type === "joystick";
}
function joystickMountOffsets() {
  // 25.5mm pitch → ±12.75mm on each axis, at 45° corners
  const offset = 12.75;
  return [
    { x: offset, y: offset },
    { x: -offset, y: offset },
    { x: -offset, y: -offset },
    { x: offset, y: -offset },
  ];
}
function joystickMountHoles(c, cx, cy) {
  const x0 = cx ?? c.x ?? 0;
  const y0 = cy ?? c.y ?? 0;
  const rot = ((c.rotation || 0) * Math.PI) / 180;
  const ca = Math.cos(rot),
    sa = Math.sin(rot);
  const holeR = (c.mountHoleDiameter ?? 3.2) / 2;
  return joystickMountOffsets().map((o) => ({
    x: x0 + o.x * ca - o.y * sa,
    y: y0 + o.x * sa + o.y * ca,
    r: holeR,
  }));
}
function dip8SocketPinOffsets() {
  const row = 7.62 / 2;
  const pitch = 2.54;
  return [-1.5, -0.5, 0.5, 1.5].flatMap((n) => [
    { x: -row, y: n * pitch },
    { x: row, y: n * pitch },
  ]);
}
function rotatePointLocal(x, y, deg) {
  const a = degToRad(deg || 0);
  const co = Math.cos(a);
  const si = Math.sin(a);
  return { x: x * co - y * si, y: x * si + y * co };
}
function dip8SocketPinHoles(c, x = c.x, y = c.y) {
  const r = Math.max(0.25, (c.holeDiameter || 1.0) / 2);
  return dip8SocketPinOffsets().map((o) => {
    const q = rotatePointLocal(o.x, o.y, c.rotation || 0);
    return { x: x + q.x, y: y + q.y, r };
  });
}
function dip8SocketHoleCenters(c, cx, cy) {
  const x0 = cx ?? c.x ?? 0;
  const y0 = cy ?? c.y ?? 0;
  const rot = ((c.rotation || 0) * Math.PI) / 180;
  const ca = Math.cos(rot),
    sa = Math.sin(rot);
  return dip8SocketPinOffsets().map((p) => ({
    x: x0 + p.x * ca - p.y * sa,
    y: y0 + p.x * sa + p.y * ca,
  }));
}
function getFrontOBB(c) {
  const b = getFrontBounds(c);
  return {
    cx: c.x,
    cy: c.y,
    hw: b.w / 2,
    hh: b.h / 2,
    angle: getFrontShape(c) === "circle" ? 0 : c.rotation,
  };
}
function getFrontExtents(c) {
  return obbEdgeExtents(getFrontOBB(c));
}
function getFrontBottomOffset(c) {
  const b = getFrontBounds(c);
  const shape = getFrontShape(c);
  const rotation =
    shape !== "circle" && typeof c.rotation === "number" ? c.rotation : 0;
  let face = b.h / 2;
  if (shape !== "circle" && rotation !== 0) {
    const r = degToRad(rotation);
    face =
      Math.abs(Math.sin(r)) * (b.w / 2) + Math.abs(Math.cos(r)) * (b.h / 2);
  }
  const knob = c.knobEnabled && c.knobDiameter ? c.knobDiameter / 2 : 0;
  return Math.max(face, knob);
}
function frontClearance(a, b) {
  if (getFrontShape(a) === "circle" && getFrontShape(b) === "circle") {
    return (
      Math.hypot(b.x - a.x, b.y - a.y) -
      a.frontDiameter / 2 -
      b.frontDiameter / 2
    );
  }
  const ae = getFrontExtents(a);
  const be = getFrontExtents(b);
  const dx = Math.max(ae.x1 - be.x2, be.x1 - ae.x2, 0);
  const dy = Math.max(ae.y1 - be.y2, be.y1 - ae.y2, 0);
  if (dx === 0 && dy === 0) {
    const overlapX = Math.min(ae.x2, be.x2) - Math.max(ae.x1, be.x1);
    const overlapY = Math.min(ae.y2, be.y2) - Math.max(ae.y1, be.y1);
    return -Math.min(overlapX, overlapY);
  }
  return Math.hypot(dx, dy);
}
