import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { homeRoutes } = JSON.parse(readFileSync(new URL("../config/site-routes.json", import.meta.url)));
const source = readFileSync(new URL("../js/home-navigation.js", import.meta.url), "utf8")
  .replace(/^import homeRoutes[^\n]+;/, `const homeRoutes = ${JSON.stringify(homeRoutes)};`);
const { normalizeHomeUrl, homeSectionUrl, isHomeUrl, getHomeSection, isPlainNavigation } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const filters = "house=tchaikovsky&house=vivaldi&type=b&floor=4%2F3&property=10&view=grid&kvadrati-od=26&stanovi-do=109&unit=A30";

test("home and section routes remove all catalog filters while preserving unrelated parameters", () => {
  for (const root of ["https://site.test/", "https://site.test/evolution/", "https://site.test/dist/"]) {
    for (const path of ["", "index.html", ...Object.keys(homeRoutes).flatMap(route => [route, `${route}/`, `${route}/index.html`])]) {
      const cleaned = normalizeHomeUrl(`${root}${path}?${filters}&utm_source=test&gclid=123&custom=yes`, root);
      assert.deepEqual([...cleaned.searchParams], [["utm_source", "test"], ["gclid", "123"], ["custom", "yes"]]);
      assert.equal(cleaned.pathname, new URL(path, root).pathname);
    }
  }
});

test("catalog, unknown pages and external pages retain their filter URLs", () => {
  const root = "https://site.test/evolution/";
  for (const path of ["search-by-parameters.html", "search-by-parameters/vivaldi/", "search-by-parameters/tchaikovsky/", "unknown/"]) {
    const url = `${root}${path}?${filters}`;
    assert.equal(normalizeHomeUrl(url, root).href, url);
    assert.equal(isHomeUrl(url, root), false);
    assert.equal(getHomeSection(url, root), null);
  }
  assert.equal(isHomeUrl("https://other.test/evolution/contact/", root), false);
});

test("legacy section URLs become clean paths under the current deployment prefix", () => {
  const root = "https://site.test/nested/evolution/";
  for (const [route, section] of Object.entries(homeRoutes)) {
    for (const old of [`?${filters}&section=${section}&utm_source=test`, `?utm_source=test#${section}`]) {
      const result = normalizeHomeUrl(root + old, root);
      assert.equal(result.href, `${root}${route}/?utm_source=test`);
      assert.equal(result.hash, "");
    }
  }
  assert.equal(normalizeHomeUrl(`${root}?section=unknown&house=vivaldi`, root).href, root);
  assert.equal(normalizeHomeUrl(`${root}#main`, root).href, root);
});

test("navigation links resolve every section without leaking catalog filters", () => {
  const root = "https://site.test/evolution/";
  for (const [route, section] of Object.entries(homeRoutes)) {
    const target = homeSectionUrl(section, root, `${root}search-by-parameters.html?${filters}&utm_campaign=launch`);
    assert.equal(target.href, `${root}${route}/?utm_campaign=launch`);
    assert.equal(getHomeSection(target, root), section);
  }
  assert.equal(homeSectionUrl("main", root).href, root);
  assert.equal(getHomeSection(root + "index.html", root), "main");
  assert.throws(() => homeSectionUrl("missing", root), RangeError);
});

test("modified clicks, new tabs and downloads keep native browser navigation", () => {
  const link = { target: "", hasAttribute: () => false };
  assert.equal(isPlainNavigation({ button: 0 }, link), true);
  for (const event of [{ button: 1 }, { button: 2 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }]) {
    assert.equal(isPlainNavigation(event, link), false);
  }
  assert.equal(isPlainNavigation({}, { ...link, target: "_blank" }), false);
  assert.equal(isPlainNavigation({}, { ...link, hasAttribute: () => true }), false);
});
