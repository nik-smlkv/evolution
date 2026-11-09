import test from "node:test";
import assert from "node:assert/strict";
import { createDeferredPlan, deferPlanImages, activatePlanImages, createPlanImageLoader } from "../js/apartments/deferred-plan.js";

test("floor initialization stays idle until requested and shares concurrent requests", async () => {
  let calls = 0;
  let ready;
  const plan = { level: "3800" };
  const ensure = createDeferredPlan(() => {
    calls += 1;
    return new Promise((resolve) => { ready = resolve; });
  });
  await Promise.resolve();
  assert.equal(calls, 0);
  const first = ensure();
  const second = ensure();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  ready(plan);
  assert.equal(await first, plan);
  assert.equal(await second, plan);
  assert.equal(await ensure(), plan);
  assert.equal(calls, 1);
});

test("a failed request releases initialization for a later retry", async () => {
  let calls = 0;
  const ensure = createDeferredPlan(() => {
    calls += 1;
    if (calls === 1) throw new Error("offline");
    return "ready";
  });
  const first = ensure();
  const concurrent = ensure();
  assert.equal(first, concurrent);
  await assert.rejects(first, /offline/);
  assert.equal(await ensure(), "ready");
  assert.equal(await ensure(), "ready");
  assert.equal(calls, 2);
});

const xlinkNamespace = "http://www.w3.org/1999/xlink";
function image({ href = null, xlink = null } = {}) {
  const attributes = new Map();
  if (href) attributes.set("href", href);
  if (xlink) attributes.set("xlink:href", xlink);
  const writes = [];
  return {
    dataset: {}, writes,
    getAttribute: (name) => attributes.get(name) || null,
    getAttributeNS: (namespace, name) => attributes.get(namespace === xlinkNamespace ? `xlink:${name}` : name) || null,
    removeAttribute: (name) => attributes.delete(name),
    removeAttributeNS: (namespace, name) => attributes.delete(namespace === xlinkNamespace ? `xlink:${name}` : name),
    setAttribute(name, value) { attributes.set(name, value); writes.push([name, value]); },
    setAttributeNS(namespace, name, value) { assert.equal(namespace, xlinkNamespace); attributes.set(name, value); writes.push([name, value]); },
  };
}
const root = (...images) => ({ querySelectorAll: (selector) => { assert.equal(selector, "image"); return images; } });

test("SVG clone preparation removes every fetchable href before insertion", () => {
  const first = image({ href: "./first.jpg", xlink: "./first.jpg" });
  const second = image({ xlink: "./second.jpg" });
  const empty = image();
  deferPlanImages(root(first, second, empty), (path) => path.replace(".jpg", ".webp"));
  assert.equal(first.dataset.planImage, "./first.webp");
  assert.equal(second.dataset.planImage, "./second.webp");
  for (const item of [first, second, empty]) {
    assert.equal(item.getAttribute("href"), null);
    assert.equal(item.getAttributeNS(xlinkNamespace, "href"), null);
    assert.equal(item.writes.length, 0);
  }
});

test("only the selected floor receives its original image URL, with no repeated activation", () => {
  const ground = image({ xlink: "./ground.jpg?v=2" });
  const upper = image({ xlink: "./upper.webp" });
  deferPlanImages(root(ground, upper));
  activatePlanImages(root(ground));
  assert.equal(ground.getAttribute("href"), "./ground.jpg?v=2");
  assert.equal(ground.getAttributeNS(xlinkNamespace, "href"), "./ground.jpg?v=2");
  assert.equal(upper.getAttribute("href"), null);
  assert.equal(upper.getAttributeNS(xlinkNamespace, "href"), null);
  assert.equal(upper.writes.length, 0);
  activatePlanImages(root(ground));
  assert.equal(ground.writes.length, 2);
  activatePlanImages(root(upper));
  assert.equal(upper.getAttribute("href"), "./upper.webp");
});

test("a floor image remains pending until decoding and is reused by concurrent and later requests", async () => {
  const images = [];
  let decoded;
  class Preview {
    constructor() { images.push(this); }
    decode() { return new Promise((resolve) => { decoded = resolve; }); }
  }
  const load = createPlanImageLoader(Preview);
  const first = load("./floor.webp");
  assert.equal(first, load("./floor.webp"));
  assert.equal(images.length, 1);
  assert.equal(images[0].src, "./floor.webp");
  let ready = false;
  first.then(() => { ready = true; });
  images[0].onload();
  await Promise.resolve();
  assert.equal(ready, false);
  decoded();
  await first;
  assert.equal(ready, true);
  assert.equal(first, load("./floor.webp"));
  assert.equal(images.length, 1);
});

test("failed floor images can retry while another ready floor stays cached", async () => {
  const images = [];
  class Preview { constructor() { images.push(this); } }
  const load = createPlanImageLoader(Preview);
  const stable = load("./stable.webp");
  images[0].onload();
  await stable;
  const failed = load("./new.webp");
  images[1].onerror();
  await assert.rejects(failed, /Unable to load/);
  const retry = load("./new.webp");
  assert.equal(images.length, 3);
  images[2].onload();
  await retry;
  assert.equal(stable, load("./stable.webp"));
});
