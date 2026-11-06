import { test } from "node:test";
import assert from "node:assert/strict";
import { animatePlanFloorChange } from "../js/apartments/plan-transition.js";

function fixture() {
  const classes = new Set();
  const viewport = {
    classList: { add: (value) => classes.add(value), remove: (value) => classes.delete(value) },
    append: (element) => { element.attached = true; },
  };
  const animations = [];
  const animate = (frames, options) => {
    let resolve;
    let reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const animation = { frames, options, finished, resolve, cancellations: 0,
      cancel() { this.cancellations += 1; reject(new Error("cancelled")); } };
    animations.push(animation);
    return animation;
  };
  const layer = { inert: false, animate };
  const outgoing = { animate, attached: false, remove() { this.attached = false; } };
  return { layer, outgoing, viewport, classes, animations };
}

test("down and up move both complete plan layers in opposite vertical directions", async () => {
  for (const direction of [1, -1]) {
    const state = fixture();
    animatePlanFloorChange({ ...state, direction });
    const [incoming, outgoing] = state.animations;
    assert.equal(incoming.frames[0].transform, `translateY(${direction * 100}%)`);
    assert.equal(outgoing.frames[1].transform, `translateY(${-direction * 100}%)`);
    assert.equal(incoming.options.duration, 400);
    assert.equal(state.layer.inert, true);
    incoming.resolve();
    outgoing.resolve();
    await new Promise(setImmediate);
    assert.equal(state.outgoing.attached, false);
    assert.equal(state.layer.inert, false);
    assert.equal(state.classes.size, 0);
  }
});

test("cancelling an old transition cannot clear a newer transition after its promises settle", async () => {
  const state = fixture();
  const cancel = animatePlanFloorChange({ ...state, direction: 1 });
  cancel();
  assert.deepEqual(state.animations.map((animation) => animation.cancellations), [1, 1]);
  const nextOutgoing = { ...state.outgoing };
  const finishNext = animatePlanFloorChange({ ...state, outgoing: nextOutgoing, direction: -1 });
  await new Promise(setImmediate);
  assert.equal(nextOutgoing.attached, true);
  assert.equal(state.layer.inert, true);
  assert.equal(state.classes.has("is-plan-transitioning"), true);
  finishNext();
  finishNext();
  assert.equal(nextOutgoing.attached, false);
  assert.equal(state.layer.inert, false);
  assert.deepEqual(state.animations.map((animation) => animation.cancellations), [1, 1, 1, 1]);
});

test("reduced motion avoids snapshots, transforms, and inert interaction state", () => {
  const state = fixture();
  animatePlanFloorChange({ ...state, direction: 1, reducedMotion: true })();
  assert.equal(state.animations.length, 0);
  assert.equal(state.outgoing.attached, false);
  assert.equal(state.layer.inert, false);
  assert.equal(state.classes.size, 0);
});

test("a partially failed animation setup restores the interactive live plan", async () => {
  const state = fixture();
  state.outgoing.animate = () => { throw new Error("animation unavailable"); };
  animatePlanFloorChange({ ...state, direction: 1 });
  await new Promise(setImmediate);
  assert.equal(state.outgoing.attached, false);
  assert.equal(state.layer.inert, false);
  assert.equal(state.classes.size, 0);
  assert.equal(state.animations[0].cancellations, 1);
});
