import { getSelectedHouse, resolveHouse } from "./house-context.js?v=1.0.1";
import { initializeLeadValidation } from "./validation.js?v=1.0.7";
import { directLeadWebhookUrl } from "./lead-settings.js?v=1.0.0";

const siteRoot = new URL("../", import.meta.url);
const phpEndpoint = new URL("../lead.php", import.meta.url);
const language = document.documentElement.lang === "en" ? "en" : "sr";
const serverErrors = new Set(["invalid", "rate_limited", "upstream", "unavailable"]);
const copy = {
  en: {
    sending: "Sending your request…",
    success: "Your request has been sent.",
    invalid: "Check the form fields and try again.",
    rate_limited: "Too many requests. Please try again later.",
    upstream: "Your request could not be sent. Please try again.",
    unavailable: "The form service is unavailable. Please try again.",
  },
  sr: {
    sending: "Slanje upita je u toku…",
    success: "Vaš upit je uspešno poslat.",
    invalid: "Proverite podatke u formularu i pokušajte ponovo.",
    rate_limited: "Previše upita. Pokušajte ponovo kasnije.",
    upstream: "Upit nije poslat. Pokušajte ponovo.",
    unavailable: "Slanje upita trenutno nije dostupno. Pokušajte ponovo.",
  },
}[language];

function planPath(source, house) {
  if (!source || !house) return "";
  const url = new URL(source, siteRoot);
  if (url.origin !== siteRoot.origin || !url.pathname.startsWith(siteRoot.pathname)) return "";
  const path = "/" + url.pathname.slice(siteRoot.pathname.length);
  return path.startsWith("/assets/images/projects/" + house + "/apartments/plans/") ? path : "";
}

function propertyDetails(form) {
  const raw = form.dataset.priceRequestContext;
  if (raw) {
    let context;
    try {
      context = JSON.parse(raw);
    } catch {
      throw new Error("invalid");
    }
    if (!context || !["apartments", "commercial", "parking"].includes(context.propertyType)) {
      throw new Error("invalid");
    }
    const house = getSelectedHouse(context.house)?.id ?? null;
    return {
      house,
      property: {
        type: context.propertyType,
        unit: String(context.unit ?? "").trim(),
        wing: String(context.buildingWing ?? "").trim(),
        floor: String(context.floor ?? "").trim(),
        area: String(context.area ?? "").trim(),
        planUrl: planPath(context.planUrl, house),
      },
    };
  }

  const details = document.querySelector(".popup_type_house.popup_is-opened")
    || document.querySelector(".apartments__info-block");
  const house = getSelectedHouse()?.id ?? null;
  const value = (selector) => details?.querySelector(selector)?.textContent.trim() ?? "";
  return {
    house,
    property: {
      type: "apartments",
      unit: value(".js-apartment-number"),
      wing: value(".js-apartment-wing"),
      floor: value(".js-apartment-floor"),
      area: value(".js-apartment-area"),
      planUrl: planPath(details?.querySelector(".apartment__img")?.src, house),
    },
  };
}

function bitrixPayload({ name, phone, email, house, property }) {
  const houseName = resolveHouse({ house })?.name ?? "Nije izabran";
  let comments = `Objekat: ${houseName}`;
  if (property?.type === "apartments") {
    const plan = property.planUrl ? `. Tlocrt stana na sajtu https://evolutionresidence.rs${property.planUrl}` : "";
    comments = `Saznati cenu stana '${comments}, Površina:${property.area}, Krilo zgrade:${property.wing}, Sprat: ${property.floor}, Broj stana: ${property.unit}${plan}'`;
  } else if (property) {
    const label = property.type === "parking" ? "parking mesta" : "poslovnog prostora";
    const details = [comments];
    for (const [value, caption] of [[property.wing, "Krilo zgrade"], [property.floor, "Sprat"], [property.unit, "Broj"]]) {
      if (value) details.push(`${caption}: ${value}`);
    }
    comments = `Saznati cenu ${label} '${details.join(", ")}'`;
  }
  return {
    fields: {
      TITLE: "Complete CRM form 'Prijava za konsultacije sa sajta (evolutionresidence.rs)'",
      NAME: name,
      PHONE: [{ VALUE: phone, VALUE_TYPE: "WORK" }],
      EMAIL: [{ VALUE: email, VALUE_TYPE: "WORK" }],
      COMMENTS: comments,
    },
    params: { REGISTER_SONET_EVENT: "Y" },
  };
}

async function sendLead(payload) {
  const response = await fetch(directLeadWebhookUrl || phpEndpoint, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(directLeadWebhookUrl ? bitrixPayload(payload) : payload),
    redirect: "error",
    signal: AbortSignal.timeout(25_000),
  });
  const result = await response.json().catch(() => null);
  if (directLeadWebhookUrl) {
    const id = result?.result;
    const positiveId = (Number.isSafeInteger(id) && id > 0) || (typeof id === "string" && /^[1-9]\d*$/.test(id));
    if (response.ok && positiveId && !Object.hasOwn(result, "error")) return;
    throw new Error(response.status === 429 ? "rate_limited" : "upstream");
  }
  if (response.status === 200 && result?.ok === true) return;
  if (serverErrors.has(result?.error)) throw new Error(result.error);
  throw new Error(response.status === 429 ? "rate_limited" : "upstream");
}

function initializeLeadForm(form, kind) {
  if (!form) return;
  const validation = initializeLeadValidation(form);
  const feedback = document.createElement("div");
  feedback.className = "lead-form-feedback";
  const status = document.createElement("p");
  status.className = "lead-form-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-atomic", "true");
  feedback.append(status);
  form.append(feedback);

  function setFeedback(state, message = state) {
    feedback.dataset.state = state;
    status.textContent = copy[message];
  }

  let busy = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!validation.check()) {
      setFeedback("error", "invalid");
      return;
    }
    busy = true;
    validation.setBusy(true);

    try {
      const details = kind === "price" ? propertyDetails(form) : {
        house: getSelectedHouse()?.id ?? null,
        property: null,
      };
      if (kind === "price" && (!details.house || !details.property.unit)) throw new Error("invalid");
      const payload = {
        kind,
        name: form.elements.namedItem("name").value.trim(),
        phone: form.elements.namedItem("phone").value.trim(),
        email: form.elements.namedItem("mail").value.trim(),
        ...details,
      };
      setFeedback("sending");
      await sendLead(payload);
      form.reset();
      form.querySelectorAll(".input-placeholder").forEach((element) => element.removeAttribute("style"));
      validation.clear();
      setFeedback("success");
    } catch (error) {
      const code = serverErrors.has(error?.message) ? error.message : "unavailable";
      setFeedback("error", code);
    } finally {
      busy = false;
      validation.setBusy(false);
    }
  });
}

initializeLeadForm(document.forms.namedItem("form-feedback"), "callback");
initializeLeadForm(document.forms.namedItem("form-feedback-flat"), "price");
