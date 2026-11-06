// Keep the drawing's full zoom while letting badges grow only a little.
export function getPlanZoomScales(value) {
  const planScale = Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 1;
  const markerGrowth = Math.min(1.3, planScale ** 0.25);
  return { planScale, markerCompensation: markerGrowth / planScale };
}
