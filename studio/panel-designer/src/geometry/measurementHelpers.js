function computeMaxDepth(components) {
  return components.reduce((m, c) => Math.max(m, c.rearDepth), 0);
}
function distanceBetween(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function edgeClearance(a, b) {
  return frontClearance(a, b);
}
function getScaleReferenceRadius(c) {
  const knobD =
    c.knobEnabled && typeof c.knobDiameter === "number" && c.knobDiameter > 0
      ? c.knobDiameter
      : typeof c.frontDiameter === "number" && c.frontDiameter > 0
        ? c.frontDiameter
        : c.holeDiameter;
  return Math.max(0.1, knobD / 2);
}
function makeCompactKnobScale(c, labelMode) {
  const knobR = getScaleReferenceRadius(c);
  return {
    id: crypto.randomUUID(),
    kind: "knob",
    componentId: c.id,
    x: c.x,
    y: c.y,
    radius: knobR + 1.0,
    startAngle: -135,
    endAngle: 135,
    ticks: 11,
    majorEvery: 2,
    tickLength: 0.85,
    labelMode,
    fontSizeMm: 1.05,
    layer: "foreground",
    visible: true,
    locked: false,
  };
}
function makeFaderScale(c, side, labelMode) {
  const slotH = c.slotLength ?? getFrontBounds(c).h;
  return {
    id: crypto.randomUUID(),
    kind: "fader",
    side,
    componentId: c.id,
    x: c.x,
    y: c.y,
    radius: Math.max(slotH / 2, 1),
    startAngle: 0,
    endAngle: 0,
    ticks: 11,
    majorEvery: 2,
    tickLength: 1.0,
    labelMode,
    fontSizeMm: 1.1,
    layer: "foreground",
    visible: true,
    locked: false,
  };
}
