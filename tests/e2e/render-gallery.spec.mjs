import { expect, test } from "./fixtures.mjs";

const frameOrder = [
  "render-10-1280.webp", "render-11-1280.webp", "render-12-1280.webp",
  "render-13-1280.webp", "render-14-1280.webp", "render-15-1280.webp",
  "render-03.jpg", "render-08.jpg", "render-09.jpg", "render-02.jpg",
];
const frameSrc = (index) => `./assets/images/site/gallery/${frameOrder[index]}`;

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
  await expect(gallery.locator(".render-gallery__count")).toHaveText(`1 / ${frameOrder.length}`);
  expect(await gallery.evaluate((section) => [
    section.querySelector(".render-gallery__image").getAttribute("src"),
    ...Array.from(section.querySelectorAll("template[data-render-frame]"),
      (template) => template.content.querySelector("img").getAttribute("src")),
  ].map((src) => src.split("/").pop()))).toEqual(frameOrder);
  await expect.poll(() => gallery.evaluate((section) => {
    const nextSection = section.nextElementSibling;
    return Math.abs(nextSection.getBoundingClientRect().top - section.getBoundingClientRect().bottom);
  })).toBeLessThan(1);

  const scrollToFrame = (index) => gallery.evaluate((section, frameIndex) => {
    const stageHeight = section.querySelector(".render-gallery__stage").offsetHeight;
    const { top, height } = section.getBoundingClientRect();
    const frameCount = section.querySelectorAll("template[data-render-frame]").length + 1;
    const position = window.scrollY + top + (height - stageHeight) * frameIndex / (frameCount - 1);
    if (typeof lenis !== "undefined") {
      lenis.resize();
      lenis.scrollTo(position, { immediate: true });
    } else {
      window.scrollTo({ top: position, behavior: "instant" });
    }
  }, index);

  const expectCoveredTransition = async (index, direction) => {
    await page.waitForFunction((expectedFile) => {
      const stage = document.querySelector(".render-gallery__stage");
      const incoming = stage.querySelector(".is-active");
      const animation = incoming?.getAnimations()[0];
      if (incoming?.getAttribute("src") !== expectedFile ||
          !stage.querySelector(".is-outgoing") || !animation) return false;
      // Inspect an actual transition at its midpoint before letting it finish.
      animation.pause();
      animation.currentTime = Number(animation.effect.getTiming().duration) / 2;
      return true;
    }, frameSrc(index));

    const coverage = await stage.evaluate((element) => {
      const incoming = element.querySelector(".is-active");
      const outgoing = element.querySelector(".is-outgoing");
      const bounds = element.getBoundingClientRect();
      const incomingBounds = incoming.getBoundingClientRect();
      const outgoingBounds = outgoing.getBoundingClientRect();
      return {
        incomingOffset: incomingBounds.top - bounds.top,
        height: bounds.height,
        outgoingCoversStage: outgoingBounds.left <= bounds.left + 1 &&
          outgoingBounds.right >= bounds.right - 1 &&
          outgoingBounds.top <= bounds.top + 1 &&
          outgoingBounds.bottom >= bounds.bottom - 1,
        imagesDecoded: [incoming, outgoing].every((image) => image.complete && image.naturalWidth > 0),
        opacity: [incoming, outgoing].map((image) => getComputedStyle(image).opacity),
      };
    });
    expect(coverage.incomingOffset * direction).toBeGreaterThan(0);
    expect(Math.abs(coverage.incomingOffset)).toBeLessThan(coverage.height);
    expect(coverage.outgoingCoversStage).toBe(true);
    expect(coverage.imagesDecoded).toBe(true);
    expect(coverage.opacity).toEqual(["1", "1"]);
    await expect(activeFrame).toHaveAttribute("src", frameSrc(index));

    await activeFrame.evaluate(async (frame) => {
      const animation = frame.getAnimations()[0];
      animation.play();
      await animation.finished;
    });
    await expect(stage.locator(".is-outgoing")).toHaveCount(0);
    await expect.poll(() => activeFrame.evaluate((image) => {
      const imageBounds = image.getBoundingClientRect();
      const stageBounds = image.closest(".render-gallery__stage").getBoundingClientRect();
      return Math.max(
        Math.abs(imageBounds.top - stageBounds.top),
        Math.abs(imageBounds.bottom - stageBounds.bottom),
        Math.abs(imageBounds.left - stageBounds.left),
        Math.abs(imageBounds.right - stageBounds.right),
      );
    })).toBeLessThan(1);
  };

  await expect.poll(async () => {
    await scrollToFrame(0);
    return stage.evaluate((element) => Math.abs(element.getBoundingClientRect().top));
  }).toBeLessThan(2);
  await expect(activeFrame).toHaveAttribute("src", frameSrc(0));
  await expect.poll(() => activeFrame.evaluate((frame) => frame.complete && frame.naturalWidth > 0)).toBe(true);
  if (compareWithReference) {
    await activeFrame.evaluate((frame) => frame.decode());
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await stage.screenshot({ path: testInfo.outputPath("opening.png") });
  }

  await scrollToFrame(2);
  await expectCoveredTransition(2, 1);
  await expect.poll(() => stage.evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  const belowFrame = await activeFrame.evaluate((image) => {
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
    return bottom - image.getBoundingClientRect().bottom;
  });
  expect(belowFrame).toBeLessThan(1);

  await scrollToFrame(1);
  await expectCoveredTransition(1, -1);

  const skipAnimation = await skip.evaluate(async (button) => {
    const form = document.getElementById("form");
    const headerHeight = document.querySelector("header").offsetHeight;
    const start = form.getBoundingClientRect().top;
    const halfway = (start + headerHeight) / 2;
    const started = performance.now();
    button.click();
    while (performance.now() - started < 1500) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const top = form.getBoundingClientRect().top;
      if (top <= halfway) return { top, headerHeight };
    }
    return null;
  });
  expect(skipAnimation).not.toBeNull();
  expect(skipAnimation.top).toBeGreaterThan(skipAnimation.headerHeight + 8);
  await expect(form).toBeFocused();
  await expect(form).toBeInViewport();
  await expect(page).toHaveURL(/\/en\/$/);
});

test("trackpad momentum stays on one frame and a new gesture can advance or reverse", async ({ page, isMobile }) => {
  test.skip(isMobile, "Trackpads send wheel events.");
  await page.goto("/en/gallery/");
  const stage = page.locator(".render-gallery__stage");
  const count = stage.locator(".render-gallery__count");
  await expect.poll(() => stage.evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  await expect(count).toHaveText(`1 / ${frameOrder.length}`);

  const positions = await stage.evaluate(async (element) => {
    const wheel = (deltaY) => {
      element.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true }));
      return window.scrollY;
    };
    const start = window.scrollY;
    const small = [2, 4, 5, 2].map(wheel);
    const firstStep = wheel(6);
    const momentum = [];
    for (const delta of [28, 18, 8, 4, 3, 2]) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      momentum.push(wheel(delta));
    }
    // Start a second swipe while the tail of the first swipe is still arriving.
    const nextStep = [3, 5, 12].map(wheel).at(-1);
    const reversed = [-3, -5, -10, -8, -3].map(wheel).at(-1);
    return { start, small, firstStep, momentum, nextStep, reversed };
  });

  expect(positions.small).toEqual(Array(4).fill(positions.start));
  expect(positions.firstStep).toBeGreaterThan(positions.start);
  expect(positions.momentum).toEqual(Array(6).fill(positions.firstStep));
  expect(positions.nextStep).toBeGreaterThan(positions.firstStep);
  expect(positions.reversed).toBe(positions.firstStep);
  await expect(count).toHaveText(`2 / ${frameOrder.length}`);
});

test("mobile gallery controls reach the last remaining frame and return", async ({ page, isMobile }) => {
  test.skip(!isMobile, "These controls are shown on touch layouts.");
  await page.goto("/en/gallery/");
  await page.evaluate(() => document.fonts.ready);

  const gallery = page.locator("[data-render-gallery]");
  const stage = gallery.locator(".render-gallery__stage");
  const activeFrame = stage.locator(".render-gallery__image.is-active");
  const count = gallery.locator(".render-gallery__count");
  const next = gallery.locator('[data-render-step="1"]');
  const previous = gallery.locator('[data-render-step="-1"]');
  await expect(next).toBeInViewport();
  await expect(count).toHaveText(`1 / ${frameOrder.length}`);
  await expect(previous).toHaveAttribute("aria-disabled", "true");

  for (let index = 1; index < frameOrder.length; index += 1) {
    await next.tap();
    await expect(count).toHaveText(`${index + 1} / ${frameOrder.length}`);
    await expect(activeFrame).toHaveAttribute("src", frameSrc(index));
    await expect(stage.locator(".is-outgoing")).toHaveCount(0);
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await expect(activeFrame).toHaveAttribute("src", frameSrc(frameOrder.length - 1));

  await previous.tap();
  await expect(count).toHaveText(`${frameOrder.length - 1} / ${frameOrder.length}`);
  await expect(activeFrame).toHaveAttribute("src", frameSrc(frameOrder.length - 2));
  await expect(stage.locator(".is-outgoing")).toHaveCount(0);
  await gallery.getByRole("button", { name: "Skip" }).tap();
  await expect(page.locator("#form")).toBeFocused();
  await expect(page.locator("#form")).toBeInViewport();
});

for (const house of ["tchaikovsky", "vivaldi"]) {
  for (const view of ["grid", "plan"]) {
    test(`the ${house} ${view} catalog shows the ten-frame gallery before the callback form`, async ({ page }) => {
      const prefix = house === "vivaldi" ? "/en" : "";
      const planQuery = view === "plan" ? "&view=plan" : "";
      await page.goto(`${prefix}/search-by-parameters.html?house=${house}${planQuery}`);
      await expect(page.locator(".catalog-plan-button")).toBeEnabled();
      await page.evaluate(() => document.fonts.ready);
      const body = page.locator("body");
      await expect(body).toHaveAttribute("data-catalog-house", house);
      await expect(body).toHaveAttribute("data-catalog-view", view);
      const catalogURL = page.url();

      const gallery = page.locator("main [data-render-gallery]");
      const form = page.locator("#form");
      await expect(gallery).toHaveCount(1);
      expect(await gallery.evaluate((section) => section.nextElementSibling === document.querySelector("#form"))).toBe(true);
      expect(await gallery.evaluate((section) => [
        section.querySelector(".render-gallery__image"),
        ...Array.from(section.querySelectorAll("template[data-render-frame]"), (frame) => frame.content.querySelector("img")),
      ].map((image) => image.getAttribute("src").split("/").pop()))).toEqual(frameOrder);
      await expect(gallery.locator(".render-gallery__count")).toHaveText("1 / 10");

      const skip = gallery.locator("[data-render-skip]");
      await skip.scrollIntoViewIfNeeded();
      // Let lazy catalog batches and scroll anchoring settle before Skip animates.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await skip.click();
      await expect(form).toBeFocused();
      await expect(form).toBeInViewport();
      await expect(page).toHaveURL(catalogURL);
      await expect(body).toHaveAttribute("data-catalog-house", house);
      await expect(body).toHaveAttribute("data-catalog-view", view);
    });
  }
}
