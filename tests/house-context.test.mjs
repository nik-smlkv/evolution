import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Only pure house resolution is exercised. No browser globals, forms or requests.
const source = readFileSync(new URL("../js/house-context.js", import.meta.url), "utf8");
const { normalizeHouse, houseFromUrl, resolveHouse } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
const tchaikovsky = { id: "tchaikovsky", name: "Tchaikovsky" };
const vivaldi = { id: "vivaldi", name: "Vivaldi" };

test("house names and identifiers normalize to the two canonical choices only", () => {
  for (const value of ["tchaikovsky", "Tchaikovsky", "  TCHAIKOVSKY  "]) {
    assert.equal(normalizeHouse(value), tchaikovsky.id);
  }
  for (const value of ["vivaldi", "Vivaldi", "  VIVALDI  "]) {
    assert.equal(normalizeHouse(value), vivaldi.id);
  }
  for (const value of [undefined, null, "", "unknown", "__proto__", "constructor", 0, false]) {
    assert.equal(normalizeHouse(value), null);
  }
});

test("URL resolution supports house queries and direct catalog routes inside deployment prefixes", () => {
  for (const root of ["https://example.test/", "https://example.test/evolution/", "https://example.test/nested/dist/"]) {
    for (const id of ["tchaikovsky", "vivaldi"]) {
      assert.equal(houseFromUrl(`${root}search-by-parameters.html?house=${id}&floor=2`), id);
      for (const suffix of ["", "/", "/index.html"]) {
        assert.equal(houseFromUrl(`${root}search-by-parameters/${id}${suffix}`), id);
      }
      assert.equal(houseFromUrl(`${root}?house=${id}`), id);
    }
  }
  assert.equal(houseFromUrl("https://example.test/search-by-parameters/tchaikovsky/?house=vivaldi"), "tchaikovsky");
});

test("a generic catalog resolves its actual Vivaldi default even after a prior Tchaikovsky visit", () => {
  for (const query of ["", "?house=unknown", "?house="]) {
    const url = `https://example.test/evolution/search-by-parameters.html${query}`;
    assert.equal(houseFromUrl(url), "vivaldi");
    assert.deepEqual(resolveHouse({ url, previousHouse: "tchaikovsky" }), vivaldi);
  }
});

test("explicit object context takes precedence, then current catalog, URL, and previous choice", () => {
  assert.deepEqual(resolveHouse({
    house: "Tchaikovsky", catalogHouse: "vivaldi",
    url: "https://example.test/?house=vivaldi", previousHouse: "vivaldi",
  }), tchaikovsky);
  assert.deepEqual(resolveHouse({
    catalogHouse: "vivaldi", url: "https://example.test/?house=tchaikovsky", previousHouse: "tchaikovsky",
  }), vivaldi);
  assert.deepEqual(resolveHouse({
    url: "https://example.test/?house=tchaikovsky", previousHouse: "vivaldi",
  }), tchaikovsky);
  assert.deepEqual(resolveHouse({ url: "https://example.test/request-callback/", previousHouse: "vivaldi" }), vivaldi);
});

test("fresh homepage and invalid choices do not invent a selected house", () => {
  assert.equal(resolveHouse(), null);
  for (const url of [undefined, "", "not a URL", "https://example.test/", "https://example.test/contact/", "https://example.test/?house=unknown"]) {
    assert.equal(houseFromUrl(url), null);
    assert.equal(resolveHouse({ house: "unknown", catalogHouse: "unknown", previousHouse: "unknown", url }), null);
  }
  assert.deepEqual(resolveHouse({ house: "unknown", catalogHouse: "tchaikovsky" }), tchaikovsky);
});

test("catalog selection survives a clean home address and a later catalog visit replaces it", () => {
  const selected = resolveHouse({ url: "https://example.test/evolution/search-by-parameters.html?house=tchaikovsky" });
  assert.deepEqual(selected, tchaikovsky);
  const home = resolveHouse({ url: "https://example.test/evolution/", previousHouse: selected.id });
  assert.deepEqual(home, tchaikovsky);
  assert.deepEqual(resolveHouse({ url: "https://example.test/evolution/request-callback/", previousHouse: home.id }), tchaikovsky);
  const switched = resolveHouse({ catalogHouse: "vivaldi", previousHouse: home.id });
  assert.deepEqual(switched, vivaldi);
  assert.deepEqual(resolveHouse({ catalogHouse: "tchaikovsky", previousHouse: switched.id }), tchaikovsky);
});
