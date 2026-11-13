import { expect, test } from "./fixtures.mjs";

test("apartment details wait for the plan and recover from a failed image", async ({ page }) => {
  await page.goto("/en/search-by-parameters.html?house=tchaikovsky", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  const card = page.locator(".available-apartments__list .apartment__item").first();
  const dialog = page.locator(".popup_type_house");
  const planUrl = await page.locator(".apartment__fancybox").evaluate((link) => link.href);

  let releasePlan;
  const pendingPlan = new Promise((resolve) => {
    releasePlan = resolve;
  });
  await page.route(planUrl, async (route) => {
    await pendingPlan;
    await route.abort("failed");
  }, { times: 1 });

  try {
    await card.click();
    await expect(page.locator("html")).toHaveClass(/modal-image-loading/);
    await expect(dialog).not.toHaveClass(/popup_is-opened/);
  } finally {
    releasePlan();
  }

  await expect(page.locator(".modal-image-error")).toContainText("retry");
  await expect(dialog).toBeHidden();
  await card.click();
  await expect(dialog).toHaveClass(/popup_is-opened/);
  await expect(page.locator(".modal-image-error")).toHaveCount(0);
  await expect.poll(() => dialog.locator(".apartment__img").evaluate(
    (image) => image.complete && image.naturalWidth > 0,
  )).toBe(true);
});
