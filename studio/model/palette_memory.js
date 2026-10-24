// A measured single-Plaits reference; changed palettes remain estimates, never measurements.
export const AXI_FLOOR = 16384;
export const ESTIMATE_RESERVE = 17 * 1024;
export function axiMargin(meta) {
  const match = String(meta?.margins ?? '').match(/AXI: used ([\d,]+) B, free ([\d,]+) B, margin above floor ([\d,]+) B/);
  return match ? Number(match[3].replaceAll(',', '')) : null;
}
function slots(recipe) { return recipe?.voices?.[0]?.slots ?? []; }
function signature(recipe) {
  return JSON.stringify({slots:slots(recipe).map(s=>[s.engine_id,Boolean(s.stereo_enabled),Boolean(s.sync_enabled),s.user_data_bank??null]),resources:recipe?.resources??{}});
}
export function singlePlaitsMemory(model, reference, {diagnostic=false}={}) {
  const summary=model.summary(1), margin=axiMargin(reference);
  if(reference?.profile!=='single-plaits'||margin===null||!slots(reference.recipe).length)return {...summary,memoryUnavailable:true};
  const referenceBytes=model.bytesOfIds(new Set(slots(reference.recipe).map(s=>s.engine_id)));
  const exact=Boolean(reference.diagnostic)===diagnostic && signature(model.recipe())===signature(reference.recipe);
  // Keep the old estimator's uncertainty OUT of the available engine budget.
  const reserve=exact?0:ESTIMATE_RESERVE;
  const budget=referenceBytes+margin-reserve;
  const remaining=budget-summary.unionBytes;
  return {...summary,budgetBytes:budget,estimatedMargin:remaining,usedFraction:summary.unionBytes/budget,overBudget:remaining<0,
    calibrated:true,exact,reserve,referenceCommit:reference.commit,referenceMargin:margin};
}
