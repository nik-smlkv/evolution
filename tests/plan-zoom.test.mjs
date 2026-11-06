import test from "node:test";
import assert from "node:assert/strict";
import { getPlanZoomScales } from "../js/apartments/plan-zoom.js";

test("drawing zoom remains full while badge growth is gradual and bounded", () => {
  let previousGrowth = 1;
  for (const requested of [1, 1.25, 1.5, 2, 2.5, 3]) {
    const { planScale, markerCompensation } = getPlanZoomScales(requested);
    const screenGrowth = planScale * markerCompensation;
    assert.equal(planScale, requested);
    assert.ok(Number.isFinite(markerCompensation));
    assert.ok(screenGrowth >= previousGrowth && screenGrowth <= 1.3);
    previousGrowth = screenGrowth;
  }
  const { markerCompensation } = getPlanZoomScales(3);
  assert.ok(32 * 3 * markerCompensation <= 42);
  assert.ok(18 * 3 * markerCompensation <= 24);
});

test("zoom reset removes badge compensation and invalid gesture ratios stay finite", () => {
  assert.deepEqual(getPlanZoomScales(1), { planScale: 1, markerCompensation: 1 });
  for (const requested of [0, -1, NaN, Infinity, undefined, "3", 100]) {
    const { planScale, markerCompensation } = getPlanZoomScales(requested);
    assert.ok(Number.isFinite(planScale) && planScale >= 1 && planScale <= 3);
    assert.ok(Number.isFinite(markerCompensation) && markerCompensation > 0);
    assert.ok(planScale * markerCompensation <= 1.3);
  }
});
