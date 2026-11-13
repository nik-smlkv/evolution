import { expect, test } from "./fixtures.mjs";

const tracking = "utm_source=e2e";

function expectRoute(page, path, search = "") {
  return expect(page).toHaveURL((url) => (
    url.pathname === path && url.search === search && url.hash === ""
  ));
}

async function activate(locator, isMobile) {
  if (isMobile) await locator.tap();
  else await locator.click();
}

async function revealHeaderItem(page, item, isMobile) {
  await expect(page.locator("header")).toHaveAttribute("data-visible-links", /^\d+$/);
  const inOverflow = await item.evaluate((element) => Boolean(element.closest("#site-overflow-navigation")));
  if (inOverflow) {
    const burger = page.locator(".header__burger");
    if (await burger.getAttribute("aria-expanded") === "false") await activate(burger, isMobile);
    await expect(burger).toHaveAttribute("aria-expanded", "true");
  }
  return inOverflow;
}

async function changeSlide(carousel, direction, index, isMobile) {
  await activate(carousel.locator(`.swiper-button-${direction}`), isMobile);
  await expect(carousel.locator(".swiper-pagination-current")).toHaveText(String(index));
  await expect.poll(() => carousel.locator(".swiper-wrapper").evaluate(
    (wrapper) => wrapper.getAnimations().length,
  )).toBe(0);
}

test("home strips catalog filters and restores clean section routes with Back", async ({ page, isMobile }) => {
  await page.goto(`/?house=tchaikovsky&type=b&floor=4%2F3&${tracking}`);
  await expectRoute(page, "/", `?${tracking}`);

  const about = page.locator('header a[data-target="about-project"]');
  await revealHeaderItem(page, about, isMobile);
  await activate(about, isMobile);
  await expectRoute(page, "/about-project/", `?${tracking}`);
  const aboutIntro = page.locator('#about-project [data-key="h2_represen"]');
  await expect(aboutIntro).toBeInViewport();

  const infrastructure = page.locator('header a[data-target="infrastructure"]');
  await revealHeaderItem(page, infrastructure, isMobile);
  await activate(infrastructure, isMobile);
  await expectRoute(page, "/infrastructure/", `?${tracking}`);
  await expect(page.locator("#infrastructure h2")).toBeInViewport();

  await page.goBack();
  await expectRoute(page, "/about-project/", `?${tracking}`);
  await expect(aboutIntro).toBeInViewport();
  await activate(page.locator(".header__logo"), isMobile);
  await expectRoute(page, "/", `?${tracking}`);
  await expect(page.locator("main h1")).toBeInViewport();
});

test("home section aliases keep the clean path when switching languages", async ({ page, isMobile }) => {
  await page.goto(`/infrastructure/?house=vivaldi&view=grid&${tracking}`);
  await expectRoute(page, "/infrastructure/", `?${tracking}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "sr");
  await expect(page.locator("#infrastructure h2")).toBeInViewport();

  await activate(page.getByRole("link", { name: "English", exact: true }), isMobile);
  await expectRoute(page, "/en/infrastructure/", `?${tracking}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#infrastructure h2")).toBeInViewport();
  await expect(page.getByRole("link", { name: "English", exact: true })).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expectRoute(page, "/infrastructure/", `?${tracking}`);
  await expect(page.getByRole("link", { name: "Srpski", exact: true })).toHaveAttribute("aria-current", "page");
});

test("the scroll gallery remains available by direct link in both languages", async ({ page, isMobile }) => {
  await page.goto("/gallery/");
  await expectRoute(page, "/gallery/");
  await expect(page.locator("#render-gallery .render-gallery__stage")).toBeInViewport();
  await expect(page.locator('header a[data-target="render-gallery"]')).toHaveCount(0);
  const tabTitle = "Evolution Residence – Vaš San je Naša Obaveza";
  await expect(page).toHaveTitle(tabTitle);

  await activate(page.getByRole("link", { name: "English", exact: true }), isMobile);
  await expectRoute(page, "/en/gallery/");
  await expect(page.locator("#render-gallery .render-gallery__stage")).toBeInViewport();
  await expect(page.locator('header a[data-target="render-gallery"]')).toHaveCount(0);
  await expect(page).toHaveTitle(tabTitle);
});

test("the responsive apartments menu opens and shows both uppercase house links", async ({ page, isMobile }) => {
  await page.goto("/en/");
  const toggle = page.locator(".house-menu__toggle");
  const links = page.locator(".house-menu__list a");
  const inOverflow = await revealHeaderItem(page, toggle, isMobile);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");

  if (isMobile || inOverflow) await activate(toggle, isMobile);
  else await toggle.hover();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(links).toHaveCount(2);

  for (const house of ["tchaikovsky", "vivaldi"]) {
    const link = links.filter({ hasText: new RegExp(`^${house}$`, "i") });
    await expect(link).toBeVisible();
    await expect(link).toHaveCSS("text-transform", "uppercase");
    const destination = await link.evaluate((element) => {
      const { pathname, search } = new URL(element.href);
      return pathname + search;
    });
    expect(destination).toBe(`/en/search-by-parameters.html?house=${house}`);
  }

  if (isMobile || inOverflow) await activate(toggle, isMobile);
  else await toggle.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".house-menu__list")).toBeHidden();
});

test("the infrastructure carousel moves on the first click and loops", async ({ page, isMobile }) => {
  await page.goto("/infrastructure/");
  const carousel = page.locator("#infrastructure .swiper-statistic");
  const active = carousel.locator(".swiper-slide-active .statistic__card");
  await expect(carousel.locator(".swiper-pagination-current")).toHaveText("1");
  const firstCard = await active.textContent();

  await changeSlide(carousel, "next", 2, isMobile);
  await expect(active).not.toHaveText(firstCard);
  await changeSlide(carousel, "prev", 1, isMobile);
  await expect(active).toHaveText(firstCard);

  const total = Number(await carousel.locator(".swiper-pagination-total").innerText());
  expect(total).toBeGreaterThan(2);
  await changeSlide(carousel, "prev", total, isMobile);
  await changeSlide(carousel, "next", 1, isMobile);
});

test("the Materials buttons switch complete slides when scroll animation is reduced", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/en/");
  const materials = page.locator("[data-materials]");
  const first = materials.locator(".materials-slide").first();
  const second = materials.locator(".materials-slide--next");
  const count = materials.locator(".materials-controls__count");

  await expect(count).toHaveText("1 / 2");
  await expect(first.getByRole("heading")).toHaveText("Aesthetics and Reliability in Every Detail");
  await expect(second).toHaveAttribute("aria-hidden", "true");

  await activate(materials.getByRole("button", { name: "Next slide" }), isMobile);
  await expect(count).toHaveText("2 / 2");
  await expect(first).toHaveAttribute("aria-hidden", "true");
  await expect(second.getByRole("heading")).toHaveText("High Quality and Exceptional Comfort");
  await expect(second.locator("img")).toHaveAttribute("src", /material-02\.jpg$/);

  await activate(materials.getByRole("button", { name: "Previous slide" }), isMobile);
  await expect(count).toHaveText("1 / 2");
  await expect(second).toHaveAttribute("aria-hidden", "true");
});

test("scrolling overlays the second Materials slide and then reveals financing", async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, "This check compares the full-width desktop layout.");
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/en/");
  await page.evaluate(() => document.fonts.ready);

  const materials = page.locator("[data-materials]");
  const deck = materials.locator(".materials-deck");
  const first = materials.locator(".materials-slide").first();
  const second = materials.locator(".materials-slide--next");
  const financing = page.locator("#financing");
  const move = (fraction) => page.evaluate((progress) => {
    const trigger = window.ScrollTrigger.getById("materials-scroll");
    if (!trigger) return false;
    const height = trigger.pin.querySelector(".materials-deck").offsetHeight;
    const slideDistance = trigger.end - trigger.start - height;
    window.scrollTo({ top: trigger.start + slideDistance * progress, behavior: "instant" });
    return true;
  }, fraction);
  const scrollToProgress = (fraction, min, max) => expect.poll(async () => {
    if (!await move(fraction)) return false;
    const progress = await materials.evaluate((element) => Number(element.style.getPropertyValue("--materials-progress")));
    return progress >= min && progress <= max;
  }).toBe(true);
  const capture = async (name, slide, progress) => {
    if (testInfo.project.name !== "desktop-chromium") return;
    await slide.locator("img").evaluate((image) => image.decode());
    await deck.screenshot({
      path: testInfo.outputPath(name),
      style: `[data-materials] { --materials-progress: ${progress} !important; }`,
    });
  };

  await expect.poll(async () => {
    if (!await move(-0.01)) return false;
    return deck.evaluate((element) => {
      const top = document.querySelector("header").offsetHeight;
      const stage = element.parentElement;
      const progress = Number(stage.style.getPropertyValue("--materials-progress"));
      return Math.abs(element.getBoundingClientRect().top - top) < 12 && progress <= 0.002;
    });
  }).toBe(true);
  await capture("first.png", first, 0);

  await scrollToProgress(0.18, 0.1, 0.26);
  await expect(second).toHaveAttribute("aria-hidden", "true");
  const firstTop = await first.evaluate((element) => element.getBoundingClientRect().top);
  const secondTop = await second.evaluate((element) => element.getBoundingClientRect().top);
  expect(secondTop).toBeGreaterThan(firstTop + 100);

  await scrollToProgress(0.8, 0.7, 0.9);
  await expect(second).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => first.evaluate((element, top) => Math.abs(element.getBoundingClientRect().top - top), firstTop)).toBeLessThan(2);
  const overlapping = await deck.evaluate((element) => {
    const { left, top, width, height } = element.getBoundingClientRect();
    return Boolean(document.elementFromPoint(left + width * 0.7, top + height * 0.85)?.closest(".materials-slide--next"));
  });
  expect(overlapping).toBe(true);

  await scrollToProgress(0.18, 0.1, 0.26);
  await expect(second).toHaveAttribute("aria-hidden", "true");

  await scrollToProgress(1, 0.99, 1);
  await capture("second.png", second, 1);

  await expect.poll(async () => {
    if (!await move(1)) return false;
    return deck.evaluate((element) => {
      const { top, bottom } = element.getBoundingClientRect();
      const headerBottom = document.querySelector("header").getBoundingClientRect().bottom;
      const financingTop = document.querySelector("#financing").getBoundingClientRect().top;
      return top <= headerBottom && Math.abs(bottom - financingTop) < 2;
    });
  }).toBe(true);

  await page.evaluate(() => {
    const trigger = window.ScrollTrigger.getById("materials-scroll");
    const height = trigger.pin.querySelector(".materials-deck").offsetHeight;
    window.scrollTo({ top: trigger.end - height / 2, behavior: "instant" });
  });
  await expect.poll(() => deck.evaluate((element, pinnedTop) => {
    const { left, top, width, bottom } = element.getBoundingClientRect();
    const financing = document.querySelector("#financing");
    const financingTop = financing.getBoundingClientRect().top;
    return Math.abs(top - pinnedTop) < 2
      && financingTop > top && financingTop < bottom
      && document.elementFromPoint(left + width / 2, (financingTop + bottom) / 2)?.closest("#financing") === financing;
  }, firstTop)).toBe(true);
  await expect(financing.getByRole("heading", { name: "How to Buy" })).toBeInViewport();

  await scrollToProgress(0.18, 0.1, 0.26);
  await expect(second).toHaveAttribute("aria-hidden", "true");
});

test("one wheel gesture completes each Materials transition and the next continues scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "This checks mouse and trackpad wheel input.");
  await page.setViewportSize({ width: 1920, height: 1200 });
  await page.goto("/en/");
  await page.evaluate(() => document.fonts.ready);

  const position = () => page.evaluate(() => {
    const trigger = window.ScrollTrigger?.getById("materials-scroll");
    if (!trigger) return null;
    const deck = trigger.pin.querySelector(".materials-deck");
    return {
      fromFirst: scrollY - Math.ceil(trigger.start),
      fromSecond: scrollY - Math.round(trigger.end - deck.offsetHeight),
      moving: Boolean(lenis.isScrolling),
    };
  });
  const goToSlide = async (second) => {
    await expect.poll(async () => {
      await page.evaluate((last) => {
        const trigger = window.ScrollTrigger?.getById("materials-scroll");
        if (!trigger) return;
        const height = trigger.pin.querySelector(".materials-deck").offsetHeight;
        lenis.scrollTo(last ? Math.round(trigger.end - height) : Math.ceil(trigger.start), { immediate: true });
      }, second);
      const at = await position();
      return at ? Math.abs(second ? at.fromSecond : at.fromFirst) : Infinity;
    }).toBeLessThan(2);
  };

  await goToSlide(false);
  await page.mouse.move(960, 500);
  await page.mouse.wheel(0, 40);
  await expect.poll(async () => {
    const at = await position();
    return !at.moving && Math.abs(at.fromSecond) < 2;
  }).toBe(true);

  await page.mouse.wheel(0, 100);
  await expect.poll(async () => {
    const at = await position();
    return !at.moving && at.fromSecond > 45;
  }).toBe(true);

  await goToSlide(true);
  await page.mouse.wheel(0, -40);
  // A burst of small wheel events must not carry the page past the first slide.
  for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, -10);
  await expect.poll(async () => {
    const at = await position();
    return !at.moving && Math.abs(at.fromFirst) < 2;
  }).toBe(true);

  await page.mouse.wheel(0, -100);
  await expect.poll(async () => (await position()).fromFirst).toBeLessThan(-45);
});

test("the gallery covers the pinned Materials slide below the financing cards", async ({ page, isMobile }) => {
  test.skip(isMobile, "The gap appeared in the wide desktop layout.");
  await page.setViewportSize({ width: 3440, height: 1600 });
  await page.goto("/en/");
  await page.evaluate(() => document.fonts.ready);

  await expect.poll(() => page.evaluate(async () => {
    const trigger = window.ScrollTrigger?.getById("materials-scroll");
    if (!trigger) return null;
    const financing = document.getElementById("financing");
    const gallery = document.getElementById("render-gallery");
    const deck = trigger.pin.querySelector(".materials-deck");
    window.scrollTo({ top: trigger.end - 32, behavior: "instant" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const seam = financing.getBoundingClientRect().bottom;
    const galleryTop = gallery.getBoundingClientRect().top;
    const { paddingTop, paddingBottom } = getComputedStyle(financing);
    return {
      pinned: trigger.isActive,
      seamOverSlide: seam > 10 && seam + 8 < deck.getBoundingClientRect().bottom && seam + 8 < innerHeight,
      gap: Math.round(galleryTop - seam),
      belowSeam: document.elementFromPoint(30, seam + 4)?.closest("#render-gallery") === gallery,
      paddingTop,
      paddingBottom,
    };
  })).toEqual({ pinned: true, seamOverSlide: true, gap: 0, belowSeam: true, paddingTop: "180px", paddingBottom: "180px" });
});

test("the hero loads responsive images and reveals the deferred video on scroll", async ({ page, isMobile }) => {
  await page.goto("/");
  const compactHero = await page.evaluate(() => matchMedia("(max-width: 767.99px)").matches);
  const pictureFiles = compactHero
    ? [/\/main-(780|1200)\.webp$/, /\/detail-(780|1200)\.webp$/]
    : [/\/main(?:-(1200|1920))?\.webp$/, /\/detail(?:-(1200|1920))?\.webp$/];
  for (const [i, selector] of [".main-img", ".moving-img"].entries()) {
    const image = page.locator(`.main-block ${selector}`);
    await expect.poll(() => image.evaluate((element) => element.naturalWidth > 0 ? element.currentSrc : ""))
      .toMatch(pictureFiles[i]);
  }

  const video = page.locator("video[data-deferred-video]");
  const source = video.locator("source");
  if (!isMobile) {
    await expect(video).not.toBeInViewport();
    await expect(source).toHaveAttribute("data-src", /\/videos\/evolution-video\.mp4$/);
  }
  await video.scrollIntoViewIfNeeded();
  await expect(video).toBeInViewport();
  await expect(source).toHaveAttribute("src", /\/videos\/evolution-video\.mp4$/);
  await expect(video).toHaveAttribute("preload", "metadata");
});

test("the full Evolution word fits the hero across breakpoints", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "This desktop viewport sweep covers the responsive breakpoints.");
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const evolution = page.getByRole("heading", { level: 1 }).getByText("Evolution", { exact: true });

  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1280, 720], [1470, 900], [1920, 783], [1920, 450], [2560, 1050]]) {
    await page.setViewportSize({ width, height });
    await expect(evolution).toBeVisible();
    await expect.poll(() => evolution.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const hero = element.closest(".section__body-main");
      const photo = hero.querySelector(".position-img").getBoundingClientRect();
      const desktop = matchMedia("(min-width: 768px)").matches;
      const wordmark = hero.querySelector(".hero-wordmark");
      const text = desktop ? wordmark.getBoundingClientRect() : range.getBoundingClientRect();
      // On desktop the upper 168 units of the supplied wordmark are EVOLUTION.
      const titleBottom = desktop ? text.top + text.height * 168 / 355 : text.bottom;
      return text.width > 0 && text.left >= 0 && text.right <= document.documentElement.clientWidth
        && text.top >= 0 && titleBottom <= window.innerHeight
        && (!desktop || (wordmark.naturalWidth > 0 && text.right > photo.left
          && titleBottom > photo.top && text.top < photo.bottom));
    }), { message: `EVOLUTION fits at ${width}×${height}` }).toBe(true);
  }
});
