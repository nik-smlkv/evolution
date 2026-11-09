import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/deferred-media.js", import.meta.url), "utf8");

function fixture({ observer = true, top = 3000, playFails = false } = {}) {
  const windowEvents = new Map(), documentEvents = new Map(), observers = [], frames = [];
  const mediaSource = { dataset: { src: "./videos/evolution-video.mp4" }, src: "",
    removeAttribute: () => { delete mediaSource.dataset.src; } };
  const video = {
    top, paused: true, loads: 0, plays: 0, pauses: 0,
    querySelectorAll: () => [mediaSource],
    getBoundingClientRect: () => ({ top: video.top, bottom: video.top + 400 }),
    load() { this.loads += 1; },
    play() { this.plays += 1; this.paused = false; return playFails ? Promise.reject(new Error("Autoplay blocked")) : Promise.resolve(); },
    pause() { this.pauses += 1; this.paused = true; },
  };
  const document = { visibilityState: "visible", querySelectorAll: () => [video],
    addEventListener: (type, callback) => documentEvents.set(type, callback) };
  class Observer {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe() {}
    unobserve() {}
    enter(isIntersecting) { this.callback([{ target: video, isIntersecting }]); }
  }
  const window = { innerHeight: 720, addEventListener: (type, callback) => windowEvents.set(type, callback) };
  if (observer) window.IntersectionObserver = Observer;
  const context = vm.createContext({ window, document, IntersectionObserver: Observer,
    requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; } });
  vm.runInContext(source.replace("export function", "function"), context);
  return { video, mediaSource, document, observers,
    emitWindow(type) { windowEvents.get(type)?.(); },
    emitDocument(type) { documentEvents.get(type)?.(); },
    flushFrames() { while (frames.length) frames.shift()(); },
  };
}

test("offscreen video has no source request until visible, and loads only once", () => {
  const s = fixture();
  assert.equal(s.video.loads, 0);
  assert.equal(s.mediaSource.src, "");
  s.observers[0].enter(false);
  assert.equal(s.video.loads, 0);
  s.observers[0].enter(true);
  s.observers[0].enter(true);
  assert.equal(s.video.loads, 1);
  assert.equal(s.mediaSource.src, "./videos/evolution-video.mp4");
  assert.equal(s.mediaSource.dataset.src, undefined);
  assert.equal(s.video.preload, "metadata");
  assert.equal(s.video.plays, 1);
});

test("video plays only when visible, pauses offscreen and in hidden tabs, and resumes on return", () => {
  const s = fixture();
  s.observers[0].enter(true);
  assert.equal(s.video.plays, 1);
  s.document.visibilityState = "hidden";
  s.emitDocument("visibilitychange");
  assert.equal(s.video.paused, true);
  s.document.visibilityState = "visible";
  s.emitDocument("visibilitychange");
  assert.equal(s.video.plays, 2);
  s.observers[0].enter(false);
  assert.equal(s.video.paused, true);
  s.emitDocument("visibilitychange");
  assert.equal(s.video.plays, 2);
});

test("missing IntersectionObserver retains deferred loading and visibility playback", () => {
  const s = fixture({ observer: false });
  assert.equal(s.video.loads, 0);
  s.video.top = 1000;
  s.emitWindow("scroll");
  s.flushFrames();
  assert.equal(s.video.loads, 0);
  assert.equal(s.video.plays, 0);
  s.video.top = 100;
  s.emitWindow("resize");
  s.flushFrames();
  assert.equal(s.video.loads, 1);
  assert.equal(s.video.plays, 1);
  s.video.top = -500;
  s.emitWindow("scroll");
  s.flushFrames();
  assert.equal(s.video.paused, true);
});

test("blocked autoplay is handled without an unhandled rejection; history restores playback", async () => {
  const s = fixture({ playFails: true });
  s.observers[0].enter(true);
  await new Promise(setImmediate);
  s.emitWindow("pagehide");
  assert.equal(s.video.paused, true);
  s.emitWindow("pageshow");
  await new Promise(setImmediate);
  assert.equal(s.video.plays, 2);
});
