import { expect, test } from "./fixtures.mjs";

const houses = [
  { id: "tchaikovsky", name: "Tchaikovsky", floor: "2/1ᴮ" },
  { id: "vivaldi", name: "Vivaldi", floor: "1" },
];

const cards = (page) => page.locator(".available-apartments__list .apartment__item");
const wing = (page, name) => page.locator(".lamela__list").getByRole("button", { name, exact: true });
const floor = (page, name) => page.locator(".catalog-object-filter .filter__floor_list").getByRole("button", { name, exact: true });
const query = (page) => Object.fromEntries(new URL(page.url()).searchParams);
const units = (page) => cards(page).locator(".apartment-card-item__name").allTextContents();
const usesFilterAccordion = (page) => page.viewportSize().width <= 700;

async function openCatalog(page, house, path = `/search-by-parameters.html?house=${house}`) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveAttribute("data-catalog-house", house);
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  await expect(page.locator(".catalog-startup__error")).toBeHidden();
}

async function openFilters(page) {
  const toggle = page.locator(".catalog-filter-accordion__toggle");
  const panel = page.locator("#catalog-filter-panel");
  const hasAccordion = usesFilterAccordion(page);
  if (hasAccordion && await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toHaveAttribute("aria-hidden", "false");
  if (hasAccordion) {
    await panel.evaluate(async (element) => {
      // Flush layout before observing the CSS transitions started by the toggle.
      element.getBoundingClientRect();
      await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
    });
  }
}

async function expectAreaRange(page, min, max) {
  await expect(cards(page).first()).toBeVisible();
  const details = await cards(page).locator(".apartment-card-item__details").allTextContents();
  const areas = details.map((text) => Number(text.match(/([\d.]+)\s*m²\s*$/)?.[1]));
  expect(areas.length).toBeGreaterThan(0);
  expect(areas.every((area) => area >= min && area <= max)).toBe(true);
}

async function closeDetails(dialog) {
  await dialog.locator(".popup__close").click();
  await expect(dialog).not.toHaveClass(/popup_is-opened/);
  await expect(dialog).toBeHidden();
}

for (const house of houses) {
  test(`${house.name} filters apartments by area, section and floor and resets the selection`, async ({ page, isMobile }) => {
    await openCatalog(page, house.id, `/search-by-parameters.html?house=${house.id}&kvadrati-od=40&stanovi-do=80`);
    const toggle = page.locator(".catalog-filter-accordion__toggle");
    if (usesFilterAccordion(page)) {
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#catalog-filter-panel")).toHaveAttribute("inert", "");
    } else {
      await expect(toggle).toBeHidden();
    }
    await openFilters(page);
    await expect(page.locator("#example_2_input_from")).toHaveValue("40");
    await expect(page.locator("#example_2_input_to")).toHaveValue("80");
    await expectAreaRange(page, 40, 80);

    if (!isMobile) {
      const slider = page.locator(".catalog-filter-group--area");
      const handle = slider.locator(".irs-handle.to");
      // The slider rebuilds its thumbs when initial sizing finishes.
      await slider.scrollIntoViewIfNeeded();
      await expect(slider).not.toHaveClass(/\bcatalog-range-pending\b/);
      await expect(handle).toBeVisible();
      const thumb = await handle.boundingBox();
      const track = await slider.locator(".irs-line").boundingBox();
      expect(thumb).not.toBeNull();
      expect(track).not.toBeNull();
      const x = thumb.x + thumb.width / 2;
      const y = thumb.y + thumb.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - track.width * 0.16, y, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => Number(query(page)["stanovi-do"])).toBeLessThan(80);
      await expectAreaRange(page, 40, Number(query(page)["stanovi-do"]));
    }

    const reset = page.locator("[data-reset-filters]");
    const resetFilters = () => isMobile ? reset.tap() : reset.click();
    await resetFilters();
    await expect.poll(() => query(page)).toEqual({ house: house.id });
    await wing(page, "A").click();
    await floor(page, house.floor).click();
    await expect(wing(page, "A")).toHaveAttribute("aria-pressed", "true");
    await expect(floor(page, house.floor)).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => query(page)).toMatchObject({ house: house.id, type: "a", floor: house.floor });
    await expect(cards(page).first()).toBeVisible();
    expect((await units(page)).every((unit) => /^A\d+$/.test(unit.trim()))).toBe(true);
    const metadata = await cards(page).locator(".apartment-card-item__details").allTextContents();
    expect(metadata.every((value) => value.trim().startsWith(`${house.floor} `))).toBe(true);

    await resetFilters();
    await expect(wing(page, "All")).toHaveAttribute("aria-pressed", "true");
    await expect(floor(page, "All")).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => query(page)).toEqual({ house: house.id });
    if (usesFilterAccordion(page)) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#catalog-filter-panel")).toHaveAttribute("inert", "");
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`${house.name} opens an apartment with its decoded plan and closes the details`, async ({ page }) => {
    await openCatalog(page, house.id);
    const card = cards(page).first();
    await expect(card).toBeVisible();
    const unit = (await card.locator(".apartment-card-item__name").textContent()).trim();
    await card.click();
    const dialog = page.locator(".popup_type_house");
    await expect(dialog).toHaveClass(/popup_is-opened/);
    await expect.poll(async () => (await dialog.locator(".js-apartment-number").textContent()).replace(/\s/g, "")).toBe(unit.replace(/\s/g, ""));
    const image = dialog.locator(".apartment__img");
    await expect(image).toBeVisible();
    expect(await image.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true);
    await closeDetails(dialog);
    await expect(card).toBeVisible();
  });

  test(`${house.name} switches to the floor plan, selects a floor and returns to the grid`, async ({ page }) => {
    await openCatalog(page, house.id);
    const planButton = page.locator(".catalog-plan-button");
    const plan = page.locator(".houses-plans_container .houses-plan");
    await expect(plan.locator("svg image")).toHaveCount(0);
    await planButton.click();
    await expect(page.locator("body")).toHaveAttribute("data-catalog-view", "plan");
    await expect(plan).toBeVisible();
    await expect(planButton).toHaveAttribute("aria-pressed", "true");

    if (house.id === "tchaikovsky") {
      const selectedFloor = page.locator('.plan-floor-button[data-plan-level="3100"]');
      await selectedFloor.click();
      await expect(selectedFloor).toHaveAttribute("aria-pressed", "true");
      await expect(plan).toHaveAttribute("data-plan-level", "3100");
      const unavailable = plan.locator('.plan-canvas [id="_3100"] [data-unit="A15"]');
      await expect(unavailable).toHaveAttribute("aria-disabled", "true");
      await expect(unavailable).toHaveCSS("pointer-events", "none");
      await expect(plan.locator('.plan-unit-marker[data-plan-unit="A15"]')).toHaveCount(0);
      await unavailable.dispatchEvent("click");
      await expect(page.locator(".popup_is-opened")).toHaveCount(0);
      await expect(page.locator("html")).not.toHaveClass(/modal-image-loading/);

      const marker = plan.locator("button.plan-unit-marker").first();
      await expect(marker).toBeVisible();
      const unit = await marker.getAttribute("data-plan-unit");
      await marker.click();
      const details = page.locator(".popup_type_house");
      await expect(details).toHaveClass(/popup_is-opened/);
      await expect(details.locator(".js-apartment-number")).toHaveText(unit);
      await closeDetails(details);
    } else {
      await expect(plan.locator(".floors-res.plans-np")).toBeVisible();
      await expect(plan.locator(".floors-res.plans-np polygon.disabled").first()).toHaveCSS("pointer-events", "none");
      await page.locator(".floor__filter .filter__floor_list").getByText("1", { exact: true }).click();
      await expect(plan.locator(".floors-res.plans-1")).toBeVisible();
      await expect(plan.locator(".floors-res.plans-np")).toBeHidden();
    }
    await expect(plan.locator(".plan-load-error")).toHaveCount(0);
    await planButton.click();
    await expect(page.locator("body")).toHaveAttribute("data-catalog-view", "grid");
    await expect(planButton).toHaveAttribute("aria-pressed", "false");
    await expect(plan).toBeHidden();
    await expect(cards(page).first()).toBeVisible();
    await expect.poll(() => query(page).view).toBeUndefined();
  });
}

test("all offered Tchaikovsky floors display their assigned plans", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run the full floor asset sweep once");
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCatalog(page, "tchaikovsky", "/search-by-parameters.html?house=tchaikovsky&view=plan");
  const plan = page.locator(".houses-plans_container .houses-plan");
  const floors = page.locator(".plan-floor-list .plan-floor-button");
  const levels = {
    apartments: ["3800", "3700", "3600", "3500", "3400", "3300", "3200", "3100", "2100"],
    commercial: ["2000", "2100"],
    parking: ["1100", "1200", "1300", "1400"],
  };

  for (const [category, offeredFloors] of Object.entries(levels)) {
    const tab = page.locator(`.tchaikovsky-plan-types [data-plan-type="${category}"]`);
    if (category !== "apartments") await tab.click();
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    await expect(plan).toHaveAttribute("data-plan-type", category);
    await expect.poll(() => floors.evaluateAll((buttons) => buttons.map((button) => button.dataset.planLevel))).toEqual(offeredFloors);

    for (const level of offeredFloors) {
      await test.step(`${category}, floor ${level}`, async () => {
        const control = floors.and(page.locator(`[data-plan-level="${level}"]`));
        await control.click();
        await expect(control).toHaveAttribute("aria-pressed", "true");
        await expect(plan).toHaveAttribute("data-plan-level", level);
        await expect(plan).toHaveAttribute("aria-busy", "false");
        const background = plan.locator(`.plan-canvas [id="_${level}"] image`);
        await expect(background).toBeVisible();
        await expect(background).toHaveAttribute("href", new RegExp(`/level-${level}(?:-edited)?\\.(?:webp|jpg)$`));
      });
    }
  }
  await expect(plan.locator(".plan-load-error")).toHaveCount(0);
});

test("all offered Vivaldi floors display their assigned plans", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run the full floor asset sweep once");
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCatalog(page, "vivaldi", "/search-by-parameters.html?house=vivaldi&view=plan");
  const plan = page.locator(".houses-plans_container .houses-plan");
  const floors = page.locator(".floor__filter .filter__btn_floor");
  const levels = [["NP", 1], ["P", 2], ["VP", 2], ["1", 3], ["2", 4], ["3", 5], ["4", 6], ["5", 7]];
  await expect(floors).toHaveText(levels.map(([label]) => label));

  for (const [label, image] of levels) {
    await test.step(`Vivaldi floor ${label}`, async () => {
      const control = floors.and(page.getByText(label, { exact: true }));
      await control.click();
      await expect(control).toHaveClass(/\bactive\b/);
      const visible = plan.locator(".floors-res:visible");
      await expect(visible).toHaveCount(1);
      await expect(visible).toHaveClass(new RegExp(`\\bplans-${label.toLowerCase()}\\b`));
      await expect(visible.locator("image")).toHaveAttribute("href", new RegExp(`/level-${image}\\.jpg$`));
      await expect(plan).toHaveAttribute("aria-busy", "false");
      await expect.poll(() => query(page)).toMatchObject({ house: "vivaldi", view: "plan", floor: label });
    });
  }
  await expect(plan.locator(".plan-load-error")).toHaveCount(0);
});

test("Tchaikovsky opens commercial and parking details from the selected category", async ({ page }) => {
  await openCatalog(page, "tchaikovsky");
  await openFilters(page);
  for (const type of ["commercial", "parking"]) {
    const option = page.locator(`.catalog-object-filter [data-property-type="${type}"]`);
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("body")).toHaveAttribute("data-catalog-property", type);
    await expect.poll(() => query(page)).toMatchObject({ house: "tchaikovsky", property: type });
    const card = cards(page).first();
    await expect(card).toBeVisible();
    const unit = (await card.locator(".apartment-card-item__name").textContent()).trim();
    await card.click();
    const details = page.locator(`.popup_type_property_${type}`);
    await expect(details).toHaveClass(/popup_is-opened/);
    await expect(details.locator(".property-dialog__title")).toHaveText(unit);
    await expect(details.getByText("Tchaikovsky", { exact: true })).toBeVisible();
    await expect(details.locator(".property-dialog__details")).toContainText("m²");
    await closeDetails(details);
  }
  await page.locator("[data-reset-filters]").click();
  await expect(page.locator("body")).toHaveAttribute("data-catalog-property", "apartments");
  await expect.poll(() => query(page)).toEqual({ house: "tchaikovsky" });
});

test("switching houses in the English catalog opens the correct inventory", async ({ page }) => {
  await openCatalog(page, "tchaikovsky", "/en/search-by-parameters.html?house=tchaikovsky");
  for (const house of [...houses].reverse()) {
    await openFilters(page);
    await page.locator(`[data-house-option="${house.id}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/en/search-by-parameters.html");
    await expect(page.locator("body")).toHaveAttribute("data-catalog-house", house.id);
    await expect(page.locator(".catalog-plan-button")).toBeEnabled();
    await expect(page.locator("[data-house-title]")).toHaveText(house.name);
    await expect.poll(() => query(page)).toEqual({ house: house.id });
    await expect(cards(page).first()).toBeVisible();
    if (house.id === "vivaldi") {
      await expect(page.locator(".catalog-filter-group--property")).toHaveAttribute("hidden", "");
    }
  }
});

test("switching between English and Serbian retains the catalog house and filters", async ({ page }) => {
  const filters = {
    house: "tchaikovsky", property: "commercial", type: "b", floor: "2100",
    "kvadrati-od": "80", "stanovi-do": "100",
  };
  await openCatalog(page, filters.house, `/en/search-by-parameters.html?${new URLSearchParams(filters)}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(cards(page).first()).toBeVisible();
  const selectedUnits = await units(page);
  expect(selectedUnits.length).toBeGreaterThan(0);
  const commercial = page.locator('.catalog-object-filter [data-property-type="commercial"]');
  await expect(commercial).toHaveText("Commercial");

  for (const [lang, id, path, label] of [
    ["sr", "srb", "/search-by-parameters.html", "Poslovni prostor"],
    ["en", "en", "/en/search-by-parameters.html", "Commercial"],
  ]) {
    await page.locator(`#language-switcher a[data-lang="${id}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(path);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator(".catalog-plan-button")).toBeEnabled();
    await expect.poll(() => query(page)).toEqual(filters);
    await openFilters(page);
    await expect(commercial).toHaveText(label);
    await expect(commercial).toHaveAttribute("aria-pressed", "true");
    await expect(wing(page, "B")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#example_2_input_from")).toHaveValue("80");
    await expect(page.locator("#example_2_input_to")).toHaveValue("100");
    await expect.poll(() => units(page)).toEqual(selectedUnits);
  }
});

test("mobile pinch enlarges the Tchaikovsky plan while compensating marker scale", async ({ page, isMobile }) => {
  test.skip(!isMobile || page.viewportSize().width > 600, "Plan pinch is available on phones");
  await openCatalog(page, "tchaikovsky", "/search-by-parameters.html?house=tchaikovsky&view=plan&floor=3100");
  const plan = page.locator(".houses-plans_container .houses-plan");
  await expect(plan).toHaveAttribute("data-plan-level", "3100");
  await expect(plan.locator("button.plan-unit-marker").first()).toBeVisible();
  await plan.scrollIntoViewIfNeeded();

  const result = await plan.evaluate((host) => {
    const surface = host.querySelector(".plan-surface");
    const { left, top } = host.getBoundingClientRect();
    const touch = (type, positions) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touches = positions.map((x) => ({ clientX: left + x, clientY: top + 60 }));
      Object.defineProperties(event, {
        touches: { value: touches },
        targetTouches: { value: touches },
      });
      host.dispatchEvent(event);
    };
    touch("touchstart", [80, 140]);
    touch("touchmove", [40, 200]);
    touch("touchend", []);
    return {
      scale: new DOMMatrix(getComputedStyle(surface).transform).a,
      compensation: Number(surface.style.getPropertyValue("--plan-marker-compensation")),
    };
  });
  expect(result.scale).toBeGreaterThan(1);
  expect(result.compensation).toBeGreaterThan(0);
  expect(result.compensation).toBeLessThan(1);
});
