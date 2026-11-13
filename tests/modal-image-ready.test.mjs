import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/modal.js", import.meta.url), "utf8");

function setup() {
  const listeners = new Map();
  const modals = [];
  const messages = [];
  const classList = (...initial) => {
    const values = new Set(initial);
    return { add: (...names) => names.forEach((name) => values.add(name)), remove: (...names) => names.forEach((name) => values.delete(name)), contains: (name) => values.has(name) };
  };
  const element = () => {
    const attributes = new Map();
    return {
      style: {}, classList: classList(), isConnected: true,
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      removeAttribute(name) { attributes.delete(name); },
      getBoundingClientRect: () => ({ width: 1200 }),
    };
  };
  const trigger = element();
  trigger.closest = () => trigger;
  trigger.focus = () => { document.activeElement = trigger; };
  const body = element();
  body.append = (message) => messages.push(message);
  const root = { ...element(), lang: "en" };
  const document = {
    body, documentElement: root, activeElement: trigger, cookie: "language=srb",
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    querySelector(selector) {
      if (selector === ".modal-image-error") return messages.find((message) => !message.removed) ?? null;
      if (selector.includes(".popup_is-opened")) return modals.find((modal) => modal.classList.contains("popup_is-opened")) ?? null;
      return null;
    },
    createElement() { return { ...element(), remove() { this.removed = true; } }; },
  };
  const context = vm.createContext({ document, AbortController, DOMException, console,
    window: { scrollX: 0, scrollY: 0, scrollTo() {} },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: () => 1, clearTimeout() {},
    getComputedStyle: () => ({ transitionDuration: "0.56s", visibility: "visible" }),
  });
  vm.runInContext(source.replace(/export /g, "") + "\nthis.api = { openModal, closeModal };", context);
  const image = () => {
    const value = { ...element(), src: "https://example.test/A.jpg", complete: false, naturalWidth: 0, decodes: [] };
    const events = new Map();
    value.getAttribute = (name) => name === "src" ? value.src : null;
    value.addEventListener = (type, handler) => events.set(type, handler);
    value.removeEventListener = (type) => events.delete(type);
    value.emit = (type) => events.get(type)?.();
    value.decode = () => new Promise((resolve, reject) => value.decodes.push({ resolve, reject }));
    return value;
  };
  const modal = (type = "popup_type_house", objectImage = null, hasImage = true) => {
    const value = { ...element(), dataset: { hasImage: String(hasImage) } };
    value.matches = (selectors) => selectors.split(",").some((selector) => selector.trim().startsWith("." + type) && (!selector.includes("data-has-image") || hasImage));
    value.querySelector = () => objectImage;
    value.contains = (candidate) => candidate === value;
    value.focus = () => { document.activeElement = value; };
    modals.push(value);
    return value;
  };
  const key = (value) => Array.from(listeners.get("keydown") ?? []).forEach((listener) => listener({ key: value }));
  const ready = (value, index = value.decodes.length - 1) => { value.complete = true; value.naturalWidth = 1200; value.decodes[index].resolve(); };
  return { ...context.api, image, modal, ready, key, trigger, document, messages };
}

test("object panel stays closed and page remains scrollable until decoding finishes", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const opening = s.openModal(modal);
  assert.equal(modal.classList.contains("popup_is-opened"), false);
  assert.equal(s.document.body.style.position, undefined);
  assert.equal(s.trigger.getAttribute("aria-busy"), "true");
  s.ready(image);
  assert.equal(await opening, true);
  assert.equal(modal.classList.contains("popup_is-opened"), true);
  assert.equal(s.document.body.style.position, "fixed");
  assert.equal(s.trigger.getAttribute("aria-busy"), null);
});

test("a second click supersedes the first even if the first image finishes later", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const first = s.openModal(modal);
  image.src = "https://example.test/B.jpg";
  const second = s.openModal(modal);
  s.ready(image, 0);
  assert.equal(await first, false);
  assert.equal(modal.classList.contains("popup_is-opened"), false);
  s.ready(image, 1);
  assert.equal(await second, true);
  assert.equal(image.src, "https://example.test/B.jpg");
});

test("Escape cancels an outstanding image and it cannot open later", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const opening = s.openModal(modal);
  s.key("Escape");
  assert.equal(await opening, false);
  s.ready(image);
  await Promise.resolve();
  assert.equal(modal.classList.contains("popup_is-opened"), false);
  assert.equal(s.trigger.getAttribute("aria-busy"), null);
});

test("closing a panel while its image is pending cancels the pending opening", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const opening = s.openModal(modal);
  s.closeModal(modal);
  assert.equal(await opening, false);
  assert.equal(modal.classList.contains("popup_is-opened"), false);
});

test("a failed image leaves the panel closed and offers a retry", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const opening = s.openModal(modal);
  image.decodes[0].reject(new Error("404"));
  assert.equal(await opening, false);
  assert.equal(modal.classList.contains("popup_is-opened"), false);
  assert.match(s.messages.at(-1).textContent, /retry/);
  assert.equal(s.trigger.getAttribute("aria-busy"), null);
});

test("request forms open immediately and supersede a pending object", async () => {
  const s = setup(), image = s.image(), object = s.modal("popup_type_house", image);
  const pending = s.openModal(object), form = s.modal("popup_type_form_quarter");
  const opening = s.openModal(form);
  assert.equal(form.classList.contains("popup_is-opened"), true);
  assert.equal(await opening, true);
  assert.equal(await pending, false);
  s.ready(image);
  await Promise.resolve();
  assert.equal(object.classList.contains("popup_is-opened"), false);
});

test("property details wait for a supplied photo but need no image when none exists", async () => {
  const s = setup(), image = s.image(), property = s.modal("popup_type_property", image);
  const opening = s.openModal(property);
  assert.equal(property.classList.contains("popup_is-opened"), false);
  s.ready(image);
  assert.equal(await opening, true);
  const withoutImage = s.modal("popup_type_property", null, false);
  assert.equal(await s.openModal(withoutImage), true);
});

test("cached decoded images open successfully", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  image.complete = true;
  image.naturalWidth = 1200;
  image.decode = () => Promise.resolve();
  assert.equal(await s.openModal(modal), true);
});

test("retrying a failed image clears the error and can open the object", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  const failed = s.openModal(modal);
  image.decodes[0].reject(new Error("network error"));
  assert.equal(await failed, false);
  const retried = s.openModal(modal);
  assert.equal(s.document.querySelector(".modal-image-error"), null);
  s.ready(image);
  assert.equal(await retried, true);
});

test("browsers without decode wait for load and valid dimensions", async () => {
  const s = setup(), image = s.image(), modal = s.modal("popup_type_house", image);
  image.decode = undefined;
  const opening = s.openModal(modal);
  assert.equal(modal.classList.contains("popup_is-opened"), false);
  image.complete = true;
  image.naturalWidth = 1200;
  image.emit("load");
  assert.equal(await opening, true);
});
