const COMPONENT_TYPE_SORT_ORDER = {
  potentiometer: 10,
  pot9mm: 11,
  pot16mm: 12,
  pot9mm_ra: 13,
  trimmer6mm: 14,
  jack: 20,
  slimjack: 21,
  switch: 30,
  toggle: 31,
  toggleSpdt: 32,
  toggleSplash: 33,
  slideSwitchMini: 34,
  subMiniSwitch: 35,
  rotary8pos: 36,
  tact6mm: 37,
  tactled: 38,
  momentary12: 39,
  joystick: 40,
  led: 41,
  led3mm: 42,
  encoder: 50,
  fader: 60,
  fader20: 61,
  fader20led: 62,
  fader35: 63,
  fader45: 64,
  custom: 90,
  customrect: 91,
  dip8socket: 92,
};
function componentSortKey(def) {
  const cat = def.category ?? inferCategoryForType(def.type) ?? "custom";
  const order =
    COMPONENT_TYPE_SORT_ORDER[def.type] ??
    COMPONENT_TYPE_SORT_ORDER[cat] ??
    999;
  return `${String(order).padStart(3, "0")}|${shortPartName(def).toLowerCase()}|${def.name.toLowerCase()}`;
}
function sortComponentDefs(parts) {
  return [...parts].sort((a, b) =>
    componentSortKey(a).localeCompare(componentSortKey(b)),
  );
}
