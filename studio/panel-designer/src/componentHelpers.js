// Component type predicates and visual geometry helpers.
// No dependencies — safe to load first.
const TOP_COLOR_PRESETS = [
  "#202020",
  "#f3f4f6",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
];
const TEXT_FONT_OPTIONS = [
  {
    label: "System",
    value: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier", value: "Courier New, monospace" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
  { label: "Trebuchet", value: "Trebuchet MS, sans-serif" },
  { label: "Brush Script", value: "Brush Script MT, cursive" },
];
function defaultTopColor(c) {
  if (c.type === "led3mm" || c.type === "tactled" || c.type === "fader20led")
    return "#ef4444";
  if (c.type === "jack" || c.type === "slimjack") return "#111827";
  if (
    c.type === "toggle" ||
    c.type === "toggleSpdt" ||
    c.type === "toggle2m" ||
    c.type === "toggleSplash" ||
    c.type === "slideSwitchMini" ||
    c.type === "slideSwitch8pos"
  )
    return "#f3f4f6";
  if (c.type === "tact6mm") return "#b9bec4";
  if (c.type === "momentary12") return "#3b82f6";
  if (c.type === "fader20" || c.type === "fader35" || c.type === "fader45")
    return "#e5e7eb";
  if (
    c.type === "pot9mm" ||
    c.type === "pot16mm" ||
    c.type === "pot9mm_ra" ||
    c.type === "encoder" ||
    c.type === "trimmer6mm"
  )
    return "#202020";
  return "#9ca3af";
}
function topColor(c) {
  return c.topColor || defaultTopColor(c);
}
function topHardwareVisible(c) {
  if (c.topHardwareVisible === false) return false;
  if (isPotLike(c)) return !!c.knobEnabled;
  return true;
}
function isPotLike(c) {
  return (
    c.type === "pot9mm" ||
    c.type === "pot16mm" ||
    c.type === "pot9mm_ra" ||
    c.type === "encoder" ||
    c.type === "trimmer6mm" ||
    c.type === "rotary8pos"
  );
}
function isScaleEligibleComponent(c) {
  return (
    c.category === "potentiometer" ||
    c.type === "pot9mm" ||
    c.type === "pot16mm" ||
    c.type === "pot9mm_ra" ||
    c.type === "trimmer6mm" ||
    c.type === "rotary8pos"
  );
}
function isJackLike(c) {
  return c.type === "jack" || c.type === "slimjack";
}
function isButtonLike(c) {
  return (
    c.type === "tact6mm" || c.type === "momentary12" || c.type === "tactled"
  );
}
function isLedLike(c) {
  return c.type === "led3mm" || c.type === "tactled";
}
function isFaderLike(c) {
  if (c.type === "cutout") return false;
  return (
    c.type === "fader20" ||
    c.type === "fader20led" ||
    c.type === "fader35" ||
    c.type === "fader45" ||
    c.holeType === "slot"
  );
}
function isMiniSlideSwitch(c) {
  return (
    c.type === "slideSwitchMini" ||
    c.type === "slideSwitch8pos" ||
    c.type === "subMiniSwitch"
  );
}
function isTrimPot(c) {
  return c.type === "trimmer6mm";
}
function hasNutWasherHardware(c) {
  if (isFaderLike(c)) return false;
  return !(c.type === "tactled" || c.type === "tact6mm" || c.type === "led3mm");
}
function visualKnobDiameter(c) {
  if (c.knobDiameter && c.knobDiameter > 0) return c.knobDiameter;
  if (c.type === "tactled") return 5.5;
  if (c.type === "trimmer6mm") return 6.3;
  if (c.type === "pot16mm" || c.type === "pot9mm" || c.type === "pot9mm_ra")
    return 10;
  if (c.type === "encoder") return 16;
  return Math.max(c.frontDiameter, c.holeDiameter + 4);
}
function visualButtonRadius(c) {
  if (c.type === "tact6mm") return 3.5 / 2;
  if (c.type === "tactled") return 5.5 / 2;
  if (c.type === "momentary12") return c.frontDiameter / 2;
  return Math.max(c.frontDiameter / 2, c.holeDiameter / 2 + 1.2);
}
function ergonomicDiameter(c) {
  if (c.ergonomicEnabled && c.ergonomicDiameter && c.ergonomicDiameter > 0)
    return c.ergonomicDiameter;
  if (c.knobEnabled && c.knobDiameter && c.knobDiameter > 0)
    return c.knobDiameter;
  return 0;
}

// Thonk PJ301M-12 / PJ398SM drawing (mm, viewed along the panel axis):
// https://www.thonk.co.uk/wp-content/uploads/2014/02/Thonkiconn_Jack_Datasheet.pdf
// Housing: x +/-4.5, y -6..4.5. Sleeve/GND pin 1: y=6.48, 1.3 x 0.6.
function normalizeLegacyJackGeometry(c) {
  if (c.type !== "jack" || c.rearBodyW !== 8.5 || c.rearBodyH !== 10.5)
    return c;
  return {
    ...c,
    rearBodyW: 9,
    keepoutW: c.keepoutW === 10.5 ? 11 : c.keepoutW,
    keepoutH: c.keepoutH === 12.5 ? 14.8 : c.keepoutH,
  };
}
function getRearBodyRects(c) {
  if (c.type !== "jack")
    return [
      {
        x: -c.rearBodyW / 2,
        y: -c.rearBodyH / 2,
        width: c.rearBodyW,
        height: c.rearBodyH,
        name: "Housing",
      },
    ];
  // Preserve explicitly customized housing sizes by scaling the drawing.
  const sx = c.rearBodyW / 9,
    sy = c.rearBodyH / 10.5;
  return [
    { x: -4.5, y: -6, width: 9, height: 10.5, name: "Housing" },
    { x: -0.4, y: 4.5, width: 0.8, height: 1.98, name: "GND lead" },
    { x: -0.65, y: 6.18, width: 1.3, height: 0.6, name: "1 · GND / Sleeve" },
    { x: -0.75, y: 3.08, width: 1.5, height: 0.6, name: "2 · Normal" },
    { x: -0.75, y: -5.17, width: 1.5, height: 0.5, name: "3 · Tip" },
  ].map((r) => ({
    ...r,
    x: r.x * sx,
    y: r.y * sy,
    width: r.width * sx,
    height: r.height * sy,
  }));
}
function getRearBodyBounds(c) {
  const rects = getRearBodyRects(c);
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const width = Math.max(...rects.map((r) => r.x + r.width)) - x;
  const height = Math.max(...rects.map((r) => r.y + r.height)) - y;
  return { x, y, width, height };
}
function getRearKeepoutBounds(c) {
  const body = getRearBodyBounds(c);
  const cx = c.type === "jack" ? body.x + body.width / 2 : 0;
  const cy = c.type === "jack" ? body.y + body.height / 2 : 0;
  return {
    x: cx - c.keepoutW / 2,
    y: cy - c.keepoutH / 2,
    width: c.keepoutW,
    height: c.keepoutH,
  };
}
