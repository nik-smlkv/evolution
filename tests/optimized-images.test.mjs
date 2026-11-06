import test from "node:test";
import assert from "node:assert/strict";
import { createOptimizedImageResolver } from "../js/optimized-images.js";

const root = new URL("https://example.test/evolution/");
const resolve = createOptimizedImageResolver({
  "plans/А3/Lamela A/A45.jpg": "plans/А3/Lamela A/A45.webp",
  "images/é.jpg": "images/é.webp",
}, root);

test("converted assets use the correct site root and preserve query/hash", () => {
  assert.equal(resolve("./plans/А3/Lamela A/A45.jpg?v=3#preview"),
    new URL("plans/А3/Lamela A/A45.webp?v=3#preview", root).href);
});

test("encoded and decomposed Unicode names resolve to the same variant", () => {
  assert.equal(resolve("./images/e%CC%81.jpg"), new URL("images/é.webp", root).href);
});

test("external and outside-project images remain unchanged", () => {
  for (const value of ["https://other.test/evolution/images/é.jpg", "/other/images/é.jpg", "data:image/png;base64,AAAA"]) {
    assert.equal(resolve(value), value);
  }
});

test("unconverted, absent and malformed values retain the original", () => {
  for (const value of ["./images/other.jpg", "./images/%.jpg", "", null, undefined]) {
    assert.equal(resolve(value), value);
  }
});
