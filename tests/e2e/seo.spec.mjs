import { expect, test } from "./fixtures.mjs";

const production = "https://evolutionresidence.rs/";
const catalog = "search-by-parameters.html";
const buildings = [
  { name: "Tchaikovsky", slug: "tchaikovsky" },
  { name: "Vivaldi", slug: "vivaldi" },
];
const housePath = (slug) => `search-by-parameters/${slug}/`;
const publishedPaths = ["", catalog];
const locales = [
  { lang: "sr", prefix: "" },
  { lang: "en", prefix: "en/" },
];
const siteURL = (root, path) => new URL(path, root.endsWith("/") ? root : `${root}/`).href;

test("robots and sitemap point to the four crawlable pages served by the build", async ({ baseURL, page, request }) => {
  const routes = locales.flatMap(({ lang, prefix }) => publishedPaths.map((path) => ({
    lang,
    path,
    url: siteURL(baseURL, prefix + path),
    canonical: siteURL(production, prefix + path),
  })));
  const [robots, sitemap] = await Promise.all([
    request.get(siteURL(baseURL, "robots.txt"), { maxRedirects: 0 }),
    request.get(siteURL(baseURL, "sitemap.xml"), { maxRedirects: 0 }),
  ]);
  expect(robots.status()).toBe(200);
  expect(sitemap.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toMatch(/^User-agent: \*\s*$/m);
  expect(robotsText).toContain(`Sitemap: ${siteURL(production, "sitemap.xml")}`);
  const sitemapDocument = await page.evaluate((xml) => {
    const document = new DOMParser().parseFromString(xml, "application/xml");
    return {
      namespace: document.documentElement.namespaceURI,
      urls: Array.from(document.getElementsByTagName("loc"), (element) => element.textContent.trim()),
    };
  }, await sitemap.text());
  expect(sitemapDocument.namespace).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
  expect(sitemapDocument.urls.sort()).toEqual(routes.map(({ canonical }) => canonical).sort());

  const htmlPages = await Promise.all(routes.map(async ({ url, path }) => {
    const response = await request.get(url, { maxRedirects: 0 });
    expect(response.status(), url).toBe(200);
    expect(response.headers()["content-type"], url).toMatch(/text\/html/);
    expect(response.headers()["x-robots-tag"] ?? "", url).not.toMatch(/\bnoindex\b/i);
    return { url, path, html: await response.text() };
  }));
  const metadata = await page.evaluate((pages) => pages.map(({ url, path, html }) => {
    const document = new DOMParser().parseFromString(html, "text/html");
    const attributes = (selector, attribute) => Array.from(
      document.querySelectorAll(selector), (element) => element.getAttribute(attribute),
    );
    const base = new URL(document.querySelector("base")?.getAttribute("href") ?? "", url);
    return {
      lang: document.documentElement.lang,
      title: Array.from(document.querySelectorAll("head title"), (element) => element.textContent.trim()),
      description: attributes('head meta[name="description"]', "content"),
      canonical: attributes('head link[rel="canonical"]', "href"),
      openGraphURL: attributes('head meta[property="og:url"]', "content"),
      alternates: Array.from(document.querySelectorAll('head link[rel="alternate"][hreflang]'),
        (element) => [element.getAttribute("hreflang"), element.getAttribute("href")]),
      robots: attributes('head meta[name="robots"]', "content"),
      refresh: attributes('head meta[http-equiv="refresh" i]', "content"),
      headings: Array.from(document.querySelectorAll("main h1"), (element) => element.textContent.trim()),
      houseOfferCount: document.querySelectorAll('[data-key="home_house_offer"]').length,
      houseLinks: path === "" ? attributes("main a[href]", "href").map((href) => new URL(href, base).href) : [],
    };
  }), htmlPages);

  const titles = new Set();
  for (const [index, route] of routes.entries()) {
    const actual = metadata[index];
    const sr = siteURL(production, route.path);
    const en = siteURL(production, `en/${route.path}`);
    expect(actual.lang, route.url).toBe(route.lang);
    expect(actual.canonical, route.url).toEqual([route.canonical]);
    expect(actual.openGraphURL, route.url).toEqual([route.canonical]);
    expect(actual.alternates.sort(), route.url).toEqual([["en", en], ["sr", sr], ["x-default", sr]]);
    expect(actual.robots.join(","), route.url).not.toMatch(/\bnoindex\b/i);
    expect(actual.refresh, route.url).toEqual([]);
    expect(actual.title, route.url).toEqual([expect.stringMatching(/\S/)]);
    expect(actual.description, route.url).toEqual([expect.stringMatching(/\S/)]);
    expect(actual.headings, route.url).toEqual([expect.stringMatching(/\S/)]);
    if (route.path === "") {
      expect(actual.title, route.url).toEqual(["Evolution Residence – Vaš San je Naša Obaveza"]);
      expect(actual.houseOfferCount, route.url).toBe(0);
      for (const { prefix } of locales) {
        for (const { slug } of buildings) {
          expect(actual.houseLinks, route.url).not.toContain(siteURL(baseURL, prefix + housePath(slug)));
        }
      }
    }
    titles.add(actual.title[0]);
  }
  expect(titles.size).toBe(routes.length - 1);
});

test.describe("legacy house links without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const { name, slug } of buildings) {
    for (const { lang, prefix } of locales) {
      test(`${name} redirects directly to the ${lang} catalog`, async ({ baseURL, page }) => {
        await page.goto(siteURL(baseURL, prefix + housePath(slug)));
        await expect(page).toHaveURL(siteURL(baseURL, `${prefix}${catalog}?house=${slug}`));
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteURL(production, prefix + catalog));
        await expect(page.locator("#apartments")).toBeVisible();
        await expect(page.locator("main figure")).toHaveCount(0);
      });
    }
  }

  test("a project-folder legacy link redirects to its localized catalog", async ({ baseURL, page }) => {
    const preview = siteURL(baseURL, "preview/");
    await page.goto(siteURL(preview, `en/${housePath("vivaldi")}`));
    await expect(page).toHaveURL(siteURL(preview, `en/${catalog}?house=vivaldi`));
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteURL(production, `en/${catalog}`));
    await expect(page.locator("#apartments")).toBeVisible();
  });
});

test("legacy house redirects preserve query and hash while selecting the house from the path", async ({ baseURL, page }) => {
  const preview = siteURL(baseURL, "preview/");
  await page.goto(siteURL(preview, `en/${housePath("tchaikovsky")}?house=vivaldi&view=plan&utm_source=legacy#form`));
  await expect(page).toHaveURL((url) => url.pathname === "/preview/en/search-by-parameters.html"
    && url.searchParams.get("house") === "tchaikovsky"
    && url.searchParams.get("view") === "plan"
    && url.searchParams.get("utm_source") === "legacy"
    && url.hash === "#form");
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  await expect(page.locator("body")).toHaveAttribute("data-catalog-house", "tchaikovsky");
  await expect(page.locator("body")).toHaveAttribute("data-catalog-view", "plan");
});

test("catalog filters keep their locale canonical and survive language navigation", async ({ baseURL, page }) => {
  const query = "?house=vivaldi&type=dvosoban&utm_source=seo-test";
  await page.goto(siteURL(baseURL, `${catalog}${query}`));
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  await expect(page.locator("[data-house-title]")).toHaveText("Vivaldi");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteURL(production, catalog));
  await expect(page).not.toHaveTitle(/dvosoban/i);

  await page.getByRole("link", { name: "English", exact: true }).click();
  await expect(page).toHaveURL(siteURL(baseURL, `en/${catalog}${query}`));
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  await expect(page.locator("[data-house-title]")).toHaveText("Vivaldi");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteURL(production, `en/${catalog}`));
});
