import { expect, test } from "./fixtures.mjs";

const contact = {
  name: "Test Visitor",
  phone: "381601234567",
  mail: "visitor@example.test",
};
const contactPayload = { name: contact.name, phone: contact.phone, email: contact.mail };
const sent = "Vaš upit je uspešno poslat.";

async function mockLead(page, baseURL, { statuses = [200], pauseFirst = false } = {}) {
  const mock = { submissions: [] };
  const origin = new URL(baseURL).origin;
  let releaseFirst;
  const firstResponse = pauseFirst ? new Promise((resolve) => { releaseFirst = resolve; }) : null;
  await page.route((url) => url.origin === origin && url.pathname === "/lead.php", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.abort("blockedbyclient");

    const index = mock.submissions.length;
    const status = statuses[index] ?? statuses.at(-1);
    mock.submissions.push(request.postDataJSON());
    if (index === 0) await firstResponse;
    const json = {
      200: { ok: true },
      429: { error: "rate_limited" },
      502: { error: "upstream" },
    }[status];
    const headers = status === 429 ? { "retry-after": "30" } : undefined;
    return route.fulfill({ status, json, headers });
  });
  return { mock, releaseFirst };
}

const callbackForm = (page) => page.locator('form[name="form-feedback"]');
const submitButton = (form) => form.locator('button[type="submit"]');
const formStatus = (form) => form.locator('.lead-form-status[role="status"]');

async function fillContact(form) {
  for (const [field, value] of Object.entries(contact)) {
    await form.locator(`input[name="${field}"]`).fill(value);
  }
  await expect(submitButton(form)).toBeEnabled();
}

async function openCatalog(page, house, property = "apartments") {
  const query = new URLSearchParams({ house, property });
  await page.goto(`/search-by-parameters.html?${query}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".catalog-plan-button")).toBeEnabled();
  await expect(page.locator("body")).toHaveAttribute("data-catalog-house", house);
}

test("the callback form blocks empty and invalid input", async ({ page, baseURL }) => {
  const { mock } = await mockLead(page, baseURL);
  await page.goto("/request-callback/");
  const form = callbackForm(page);
  await expect(submitButton(form)).toBeDisabled();

  const name = form.locator('input[name="name"]');
  await name.fill("123");
  await expect(name).toHaveClass(/popup__input_type_error/);
  await expect(form.locator(".place-name-error")).toBeVisible();
  await name.fill(contact.name);
  await expect(name).not.toHaveClass(/popup__input_type_error/);

  const phone = form.locator('input[name="phone"]');
  await phone.fill("123");
  await expect(phone).toHaveClass(/popup__input_type_error/);
  await phone.fill(contact.phone);

  const email = form.locator('input[name="mail"]');
  await email.fill("invalid");
  await expect(submitButton(form)).toBeDisabled();
  await expect(form.locator(".place-email-error")).not.toBeEmpty();
  expect(mock.submissions).toHaveLength(0);
});

for (const house of [null, "tchaikovsky", "vivaldi"]) {
  test(`a callback request carries the correct house context (${house ?? "no house"})`, async ({ page, baseURL }) => {
    const { mock } = await mockLead(page, baseURL);
    if (house) {
      await openCatalog(page, house);
      const requestLink = page.locator(".js-scroll-form");
      if (!(await requestLink.isVisible())) {
        await page.getByRole("button", { name: "Open menu", exact: true }).click();
      }
      await requestLink.click();
    } else {
      await page.goto("/request-callback/");
    }
    await expect(page).toHaveURL(/\/request-callback\/$/);
    const form = callbackForm(page);
    await fillContact(form);
    await submitButton(form).click();
    await expect(formStatus(form)).toHaveText(sent);
    expect(mock.submissions).toEqual([{
      ...contactPayload,
      kind: "callback",
      house,
      property: null,
    }]);
    await expect(form.locator('input[name="name"]')).toHaveValue("");
  });
}

for (const [house, property, dialogSelector, requestSelector] of [
  ["tchaikovsky", "apartments", ".popup_type_house", ".button__price-request"],
  ["vivaldi", "apartments", ".popup_type_house", ".button__price-request"],
  ["tchaikovsky", "commercial", ".popup_type_property_commercial", ".property-dialog__request"],
  ["tchaikovsky", "parking", ".popup_type_property_parking", ".property-dialog__request"],
]) {
  test(`a price request carries the selected ${property} unit in ${house}`, async ({ page, baseURL }) => {
    const { mock } = await mockLead(page, baseURL);
    await openCatalog(page, house, property);
    const card = page.locator(".available-apartments__list .apartment__item").first();
    const unit = (await card.locator(".apartment-card-item__name").innerText()).trim();
    await card.click();
    const details = page.locator(`${dialogSelector}.popup_is-opened`);
    const expectedDetails = await details.evaluate((dialog, type) => {
      const value = (selector) => dialog.querySelector(selector)?.textContent.trim() ?? "";
      if (type === "apartments") {
        return {
          wing: value(".js-apartment-wing"),
          floor: value(".js-apartment-floor"),
          area: value(".js-apartment-area"),
          planUrl: new URL(dialog.querySelector(".apartment__img").src).pathname,
        };
      }
      return {
        wing: value('[data-key="p_section"] + dd'),
        floor: value('[data-key="p_floor"] + dd'),
        area: "",
        planUrl: "",
      };
    }, property);
    await details.locator(requestSelector).click();
    const form = page.locator('form[name="form-feedback-flat"]');
    await expect(form).toBeVisible();
    await fillContact(form);
    await submitButton(form).click();
    await expect(formStatus(form)).toHaveText(sent);
    expect(mock.submissions).toEqual([{
      ...contactPayload,
      kind: "price",
      house,
      property: { type: property, unit: expect.any(String), ...expectedDetails },
    }]);
    expect(mock.submissions[0].property.unit.replace(/\s+/g, "")).toBe(unit.replace(/\s+/g, ""));
    await expect(form.locator('input[name="name"]')).toHaveValue("");
  });
}

test("a callback prevents duplicate submission, reports an upstream outage, and allows retry", async ({ page, baseURL }) => {
  const { mock, releaseFirst } = await mockLead(page, baseURL, { statuses: [502, 200], pauseFirst: true });
  await page.goto("/en/request-callback/");
  const form = callbackForm(page);
  await fillContact(form);
  try {
    await submitButton(form).click();
    await expect.poll(() => mock.submissions.length).toBe(1);
    await expect(form).toHaveAttribute("aria-busy", "true");
    await expect(submitButton(form)).toBeDisabled();
    await form.evaluate((element) => element.requestSubmit());
  } finally {
    releaseFirst();
  }
  await expect(formStatus(form)).toHaveText("Your request could not be sent. Please try again.");
  await expect(submitButton(form)).toBeEnabled();
  await expect(form.locator('input[name="name"]')).toHaveValue(contact.name);
  expect(mock.submissions).toHaveLength(1);

  await submitButton(form).click();
  await expect(formStatus(form)).toHaveText("Your request has been sent.");
  expect(mock.submissions).toHaveLength(2);
  expect(mock.submissions[1]).toEqual(mock.submissions[0]);
});

test("a rate-limited callback preserves contact details for a later retry", async ({ page, baseURL }) => {
  const { mock } = await mockLead(page, baseURL, { statuses: [429, 200] });
  await page.goto("/en/request-callback/");
  const form = callbackForm(page);
  await fillContact(form);

  await submitButton(form).click();
  await expect(formStatus(form)).toHaveText("Too many requests. Please try again later.");
  await expect(submitButton(form)).toBeEnabled();
  expect(mock.submissions).toHaveLength(1);
  for (const [field, value] of Object.entries(contact)) {
    await expect(form.locator(`input[name="${field}"]`)).toHaveValue(value);
  }

  await submitButton(form).click();
  await expect(formStatus(form)).toHaveText("Your request has been sent.");
  expect(mock.submissions).toHaveLength(2);
  expect(mock.submissions[1]).toEqual(mock.submissions[0]);
  await expect(form.locator('input[name="name"]')).toHaveValue("");
});
