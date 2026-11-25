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

test("the header opens the scroll gallery and preserves its route when switching languages", async ({ page, isMobile }) => {
  await page.goto("/");
  const gallery = page.locator('header a[data-target="render-gallery"]');
  await revealHeaderItem(page, gallery, isMobile);
  await activate(gallery, isMobile);
  await expectRoute(page, "/gallery/");
  await expect(page.locator("#render-gallery .render-gallery__stage")).toBeInViewport();
  const tabTitle = "Evolution Residence – Vaš San je Naša Obaveza";
  await expect(page).toHaveTitle(tabTitle);

  await activate(page.getByRole("link", { name: "English", exact: true }), isMobile);
  await expectRoute(page, "/en/gallery/");
  await expect(page.locator("#render-gallery .render-gallery__stage")).toBeInViewport();
  expect(await gallery.evaluate((link) => new URL(link.href).pathname)).toBe("/en/gallery/");
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

test("the apartments button stays consistent from the homepage through both catalogs", async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto("/en/");
  const toggle = page.locator("header .house-menu__toggle");
  let homeStyle;
  for (const house of ["", "tchaikovsky", "vivaldi"]) {
    if (house) {
      await toggle.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const choice = page.locator("header .house-menu__list").getByRole("link", { name: new RegExp(house, "i") });
      await activate(choice, isMobile);
      await expectRoute(page, "/en/search-by-parameters.html", `?house=${house}`);
      await expect(page.locator("body")).toHaveAttribute("data-catalog-house", house);
    }

    await page.evaluate(() => document.fonts.ready);
    await revealHeaderItem(page, toggle, isMobile);
    await expect(toggle).toHaveAccessibleName(/^apartments$/i);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const style = await toggle.evaluate((button) => {
      const css = getComputedStyle(button);
      return {
        headerHeight: button.closest("header").offsetHeight,
        width: button.offsetWidth,
        height: button.offsetHeight,
        font: css.fontFamily,
        fontSize: css.fontSize,
        padding: css.paddingInline,
        border: css.border,
        radius: css.borderRadius,
      };
    });
    if (house) {
      expect(style).toEqual(homeStyle);
    } else {
      homeStyle = style;
      if (!isMobile) {
        expect(style.headerHeight).toBe(88);
        expect(style.height).toBe(56);
        expect(Math.abs(style.width - 181)).toBeLessThanOrEqual(2);
      }
    }
  }
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

test("the residence hero loads both photos and opens each localized house floor plan", async ({ page, isMobile }) => {
  for (const [home, selected] of [["/", 0], ["/en/", 1]]) {
    await page.goto(home);
    const hero = page.locator(".residence-hero");
    const title = hero.getByRole("heading", { level: 1, name: /Evolution Residence/i });
    const cards = hero.locator(".residence-hero__card");
    await expect(title).toBeInViewport();
    await expect(cards).toHaveCount(2);

    for (const [i, name] of ["Tchaikovsky", "Vivaldi"].entries()) {
      const card = cards.nth(i);
      await expect(card.locator(".residence-hero__name")).toHaveText(new RegExp(name, "i"));
      const link = card.locator(".residence-hero__link");
      await expect(link).toHaveAttribute("href", `.${home}search-by-parameters.html?house=${name.toLowerCase()}&view=plan`);
      const image = card.locator(".residence-hero__photo");
      const expected = i === 0
        ? /\/(?:residence-street-(?:compact-1080|480|832|1664)\.webp|render-14-full\.jpg)$/
        : /\/residence-aerial-(?:(?:480|832|1664)\.webp|full\.jpg)$/;
      await expect.poll(() => image.evaluate((element) => element.naturalWidth ? new URL(element.currentSrc).pathname : "")).toMatch(expected);
    }

    await expect(hero.locator("video")).toHaveCount(0);
    expect(await hero.evaluate((element) => element.nextElementSibling.id)).toBe("about-project");
    const house = selected === 0 ? "tchaikovsky" : "vivaldi";
    await activate(cards.nth(selected).locator(".residence-hero__link"), isMobile);
    await expectRoute(page, `${home}search-by-parameters.html`, `?house=${house}&view=plan`);
    await expect(page.locator("body")).toHaveAttribute("data-catalog-house", house);
    await expect(page.locator("body")).toHaveAttribute("data-catalog-view", "plan");
    await expect(page.locator(".houses-plans_container .houses-plan")).toBeVisible();
  }
});

test("the residence hero fits the wordmark and both cards at the design widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "A single viewport sweep covers the design widths.");
  await page.goto("/");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const hero = page.locator(".residence-hero");
  for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1280, 699], [1400, 735], [1920, 976]]) {
    await page.setViewportSize({ width, height });
    const layout = await hero.evaluate((element) => {
      const rects = (selector) => [...element.querySelectorAll(selector)].map((node) => node.getBoundingClientRect());
      const words = rects(".residence-hero__word img");
      const [first, second] = rects(".residence-hero__photo");
      const fits = (rect) => rect.width > 0 && rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
      return {
        fits: words.length === 2 && words.every((rect) => fits(rect) && rect.bottom <= innerHeight)
          && [first, second, ...rects(".residence-hero__link")].every(fits),
        arrangement: first.right <= second.left + 1 && Math.abs(first.top - second.top) < 2 ? "row"
          : first.bottom <= second.top + 1 && Math.abs(first.left - second.left) < 2 ? "column" : "overlap",
      };
    });
    expect(layout, `hero at ${width}×${height}`).toEqual({ fits: true, arrangement: width < 768 ? "column" : "row" });
  }
});

test("the residence hero title reappears Evolution first and Residence second", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const title = page.locator(".residence-hero__title");
  const words = title.locator(".residence-hero__word img");
  const opacity = () => words.evaluateAll((nodes) => nodes.map((word) => getComputedStyle(word).opacity));
  await expect.poll(opacity).toEqual(["1", "1"]);
  const duration = await words.first().evaluate((word) => parseFloat(getComputedStyle(word).transitionDuration));
  expect(duration).toBeGreaterThan(0);
  await title.evaluate((element) => window.scrollBy({ top: element.getBoundingClientRect().bottom + 32, behavior: "instant" }));
  await expect.poll(opacity).toEqual(["0", "0"]);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(async () => {
    const [evolution, residence] = (await opacity()).map(Number);
    return evolution > 0.1 && residence === 0;
  }).toBe(true);
  await expect.poll(opacity).toEqual(["1", "1"]);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await title.evaluate((element) => window.scrollBy({ top: element.getBoundingClientRect().bottom + 32, behavior: "instant" }));
  await expect(title).toHaveAttribute("data-revealed", "false");
  expect(await opacity()).toEqual(["1", "1"]);
});
