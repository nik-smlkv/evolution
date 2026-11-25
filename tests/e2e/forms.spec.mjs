import { expect, test } from "./fixtures.mjs";

const contact = {
  name: "Test Visitor",
  phone: "381601234567",
  mail: "visitor@example.test",
};
const bitrixEndpoint = "https://crm.example.test/rest/test/crm.lead.add.json";
const contactFields = {
  TITLE: "Complete CRM form 'Prijava za konsultacije sa sajta (evolutionresidence.rs)'",
  NAME: contact.name,
  PHONE: [{ VALUE: contact.phone, VALUE_TYPE: "WORK" }],
  EMAIL: [{ VALUE: contact.mail, VALUE_TYPE: "WORK" }],
};
const houseNames = { tchaikovsky: "Tchaikovsky", vivaldi: "Vivaldi" };
const bitrixSubmission = (comments) => ({
  fields: { ...contactFields, COMMENTS: comments },
  params: { REGISTER_SONET_EVENT: "Y" },
});
const sent = "Vaš upit je uspešno poslat.";

async function mockLead(page, baseURL, { statuses = [200], results = [], pauseFirst = false } = {}) {
  const mock = { submissions: [] };
  const origin = new URL(baseURL).origin;
  let releaseFirst;
  const firstResponse = pauseFirst ? new Promise((resolve) => { releaseFirst = resolve; }) : null;
  await page.route((url) => url.origin === origin && url.pathname.endsWith("/js/lead-settings.js"), (route) => route.fulfill({
    contentType: "application/javascript",
    body: `export const directLeadWebhookUrl = ${JSON.stringify(bitrixEndpoint)};`,
  }));
  await page.route(bitrixEndpoint, async (route) => {
    const request = route.request();
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, accept",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.method() !== "POST") return route.abort("blockedbyclient");

    const index = mock.submissions.length;
    const status = statuses[index] ?? statuses.at(-1);
    mock.submissions.push(request.postDataJSON());
    if (index === 0) await firstResponse;
    const json = results[index] ?? {
      200: { result: 12345 },
      429: { error: "QUERY_LIMIT_EXCEEDED" },
      502: { error: "INTERNAL_SERVER_ERROR" },
    }[status];
    if (status === 429) headers["retry-after"] = "30";
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
    expect(mock.submissions).toEqual([
      bitrixSubmission(`Objekat: ${houseNames[house] ?? "Nije izabran"}`),
    ]);
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
    expect(mock.submissions).toEqual([bitrixSubmission(expect.any(String))]);
    const comments = mock.submissions[0].fields.COMMENTS;
    expect(comments).toContain(`Objekat: ${houseNames[house]}`);
    if (expectedDetails.wing) expect(comments.replace(/\s+/g, "")).toContain(`Krilozgrade:${expectedDetails.wing.replace(/\s+/g, "")}`);
    if (expectedDetails.floor) expect(comments.replace(/\s+/g, "")).toContain(`Sprat:${expectedDetails.floor.replace(/\s+/g, "")}`);
    if (property === "apartments") {
      expect(comments).toMatch(/^Saznati cenu stana '/);
      expect(comments).toContain(`Površina:${expectedDetails.area}`);
      expect(comments).toContain(`Tlocrt stana na sajtu https://evolutionresidence.rs${expectedDetails.planUrl}`);
      expect(comments.replace(/\s+/g, "")).toContain(`Brojstana:${unit.replace(/\s+/g, "")}`);
    } else {
      expect(comments).toMatch(property === "parking" ? /^Saznati cenu parking mesta '/ : /^Saznati cenu poslovnog prostora '/);
      expect(comments.replace(/\s+/g, "")).toContain(`Broj:${unit.replace(/\s+/g, "")}`);
    }
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

test("a Bitrix success requires a positive lead ID and no API error", async ({ page, baseURL }) => {
  const results = [{ result: 0 }, { result: "invalid" }, { result: 12345, error: "ACCESS_DENIED" }, { result: "12345" }];
  const { mock } = await mockLead(page, baseURL, { results });
  await page.goto("/en/request-callback/");
  const form = callbackForm(page);
  await fillContact(form);
  for (let index = 0; index < results.length; index += 1) {
    await submitButton(form).click();
    if (index < results.length - 1) {
      await expect(formStatus(form)).toHaveText("Your request could not be sent. Please try again.");
      await expect(form.locator('input[name="name"]')).toHaveValue(contact.name);
      await expect(submitButton(form)).toBeEnabled();
    } else {
      await expect(formStatus(form)).toHaveText("Your request has been sent.");
      await expect(form.locator('input[name="name"]')).toHaveValue("");
    }
    expect(mock.submissions).toHaveLength(index + 1);
  }
});
