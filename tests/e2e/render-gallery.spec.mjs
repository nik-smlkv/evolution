import { expect, test } from "./fixtures.mjs";

test("the render gallery follows scrolling in both directions and can be skipped", async ({ page }, testInfo) => {
  const compareWithReference = testInfo.project.name === "desktop-chromium";
  if (compareWithReference) await page.setViewportSize({ width: 1920, height: 1050 });
  await page.goto("/en/");
  await page.evaluate(() => document.fonts.ready);

  const gallery = page.locator("[data-render-gallery]");
  const stage = gallery.locator(".render-gallery__stage");
  const activeFrame = stage.locator(".render-gallery__image.is-active");
  const skip = gallery.getByRole("button", { name: "Skip" });
  const form = page.locator("#form");
  await expect(skip).toBeVisible();
  await expect(stage.locator(".render-gallery__image")).toHaveCount(1);
  await expect.poll(() => gallery.evaluate((section) => {
    const nextSection = section.nextElementSibling;
    return Math.abs(nextSection.getBoundingClientRect().top - section.getBoundingClientRect().bottom);
  })).toBeLessThan(1);

  const scrollToFrame = (progress) => gallery.evaluate((section, fraction) => {
    const stageHeight = section.querySelector(".render-gallery__stage").offsetHeight;
    const { top, height } = section.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + top + (height - stageHeight) * fraction, behavior: "instant" });
  }, progress);

  await expect.poll(async () => {
    await scrollToFrame(0.04);
    return stage.evaluate((element) => Math.abs(element.getBoundingClientRect().top));
  }).toBeLessThan(2);
  await expect(activeFrame).toHaveAttribute("src", /render-01\.jpg$/);
  await expect.poll(() => activeFrame.evaluate((frame) => frame.complete && frame.naturalWidth > 0)).toBe(true);
  if (compareWithReference) {
    await activeFrame.evaluate((frame) => frame.decode());
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: testInfo.outputPath("opening.png") });
  }

  await scrollToFrame(0.60);
  await page.waitForFunction(() => {
    const stage = document.querySelector(".render-gallery__stage");
    const incoming = stage.querySelector(".is-active");
    const outgoing = stage.querySelector(".is-outgoing");
    if (!incoming?.getAttribute("src").endsWith("/render-04.jpg") || !outgoing) return false;
    const opacity = Number(getComputedStyle(incoming).opacity);
    return opacity > 0 && opacity < 1 && getComputedStyle(outgoing).opacity === "1";
  });
  await expect(activeFrame).toHaveAttribute("src", /render-04\.jpg$/);
  await expect.poll(() => stage.evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  const belowFrame = await activeFrame.evaluate((image) => {
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
    return bottom - image.getBoundingClientRect().bottom;
  });
  expect(belowFrame).toBeLessThan(1);

  await scrollToFrame(0.20);
  await expect(activeFrame).toHaveAttribute("src", /render-02\.jpg$/);
  await expect(stage.locator(".is-outgoing")).toHaveCount(0);

  await skip.click();
  await expect(form).toBeFocused();
  await expect(form).toBeInViewport();
  await expect(page).toHaveURL(/\/en\/$/);
});
