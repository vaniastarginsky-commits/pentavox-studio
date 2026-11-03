function fallbackCopy(text) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}
function copyTable(components) {
  const header =
    "Name\tType\tX (mm)\tY (mm)\tHole Ø (mm)\tFront Ø (mm)\tRear Depth (mm)";
  const rows = components.map((c) =>
    [
      c.label || c.name,
      c.type,
      c.x.toFixed(2),
      c.y.toFixed(2),
      c.holeDiameter.toFixed(1),
      c.frontDiameter.toFixed(1),
      c.rearDepth.toFixed(1),
    ].join("\t"),
  );
  const text = [header, ...rows].join("\n");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}
