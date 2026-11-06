import { openModal, closeModal, setModalEventListeners } from "../modal.js?v=1.0.4";
import { openPriceRequest } from "../price-request.js?v=1.0.2";
import { optimizedImageUrl } from "../optimized-images.js?v=1.0.3";

const dialogs = new Map();
const copy = {
  en: {
    commercial: "Commercial space", parking: "Parking space", project: "Project",
    wing: "Building wing", floor: "Floor", area: "Area", price: "PRICE UPON REQUEST",
    parkingKind: "Parking type",
    parkingKinds: { standard: "Standard", accessible: "Accessible parking", ev: "For electric vehicles" },
    close: "Close property details",
  },
  srb: {
    commercial: "Poslovni prostor", parking: "Parking mesto", project: "Objekat",
    wing: "Lamela", floor: "Sprat", area: "Površina", price: "CENA NA ZAHTEV",
    parkingKind: "Tip parking mesta",
    parkingKinds: { standard: "Standardno", accessible: "Za osobe sa invaliditetom", ev: "Za električna vozila" },
    close: "Zatvori informacije o prostoru",
  },
};

const getCopy = () => {
  const language = document.cookie.match(/(?:^|;\s*)language=([^;]*)/)?.[1];
  return copy[language === "en" || (!language && document.querySelector('header [data-lang="en"].active')) ? "en" : "srb"];
};

const makeElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const createDialog = (type) => {
  const dialog = makeElement("div", `popup popup_type_property popup_type_property_${type}`);
  dialog.id = `${type}Details`;
  dialog.tabIndex = -1;
  dialog.dataset.propertyType = type;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", `${type}-details-category ${type}-details-title`);

  const panel = makeElement("div", "popup__content property-dialog__panel");
  const close = makeElement("button", "popup__close property-dialog__close");
  close.type = "button";
  const closeIcon = document.querySelector(".popup_type_house .popup__close svg")?.cloneNode(true);
  if (closeIcon) close.append(closeIcon);
  else close.textContent = "Close";
  close.addEventListener("click", () => closeModal(dialog));

  const layout = makeElement("div", "property-dialog__layout");
  const body = makeElement("div", "property-dialog__body");
  body.setAttribute("data-lenis-prevent", "");
  const heading = makeElement("div", "property-dialog__heading");
  const category = makeElement("p", "property-dialog__category");
  category.id = `${type}-details-category`;
  const title = makeElement("h2", "property-dialog__title");
  title.id = `${type}-details-title`;
  heading.append(category, title);
  const details = makeElement("dl", "property-dialog__details");
  const request = makeElement("button", "btn-style property-dialog__request");
  request.type = "button";
  request.dataset.key = "p_price";
  const media = makeElement("figure", "property-dialog__media");
  media.hidden = true;
  const image = makeElement("img", "property-dialog__image");
  image.decoding = "async";
  image.addEventListener("error", () => {
    media.hidden = true;
    dialog.dataset.hasImage = "false";
  });
  media.append(image);
  body.append(heading, details, request);
  layout.append(body, media);
  panel.append(close, layout);
  dialog.append(panel);
  document.body.append(dialog);
  setModalEventListeners(dialog);

  const state = { dialog, close, category, title, details, request, media, image, context: null };
  request.addEventListener("click", () => openPriceRequest(state.context));
  dialogs.set(type, state);
  return state;
};

const appendDetail = (list, label, value, key) => {
  if (value === undefined || value === null || String(value).trim() === "") return;
  const row = makeElement("div", "property-dialog__detail");
  const term = makeElement("dt", "property-dialog__label", label);
  if (key) term.dataset.key = key;
  const description = makeElement("dd", "property-dialog__value", String(value));
  row.append(term, description);
  list.append(row);
};

export function openPropertyDetails(property, houseName) {
  const type = property?.propertyType;
  if (type !== "commercial" && type !== "parking") return;
  if (!dialogs.size) {
    createDialog("commercial");
    createDialog("parking");
  }
  const state = dialogs.get(type);
  const text = getCopy();
  const unit = String(property.unit ?? property.apartmentNumber ?? "").replace(/^STAN\s*/i, "").trim();
  const buildingWing = String(property.buildingWing ?? property.buldingWing ?? "").replace(/^Lamela\s*/i, "").trim();
  const house = houseName || property.house || "";
  state.category.textContent = text[type];
  state.title.textContent = unit;
  state.close.setAttribute("aria-label", text.close);
  state.request.textContent = text.price;
  state.details.replaceChildren();
  appendDetail(state.details, text.project, house);
  appendDetail(state.details, text.wing, buildingWing, "p_section");
  appendDetail(state.details, text.floor, property.floor, "p_floor");
  if (Number.isFinite(property.area)) {
    appendDetail(state.details, text.area, `${property.area.toLocaleString("en-GB", { maximumFractionDigits: 2 })} m²`, "p_area");
  }
  if (type === "parking") {
    appendDetail(state.details, text.parkingKind, text.parkingKinds[property.parkingKind]);
  }
  (property.details || []).forEach(({ label, value }) => {
    if (label) appendDetail(state.details, label, value);
  });
  state.context = { propertyType: type, unit, buildingWing, floor: property.floor || "", house };

  const hasImage = typeof property.image === "string" && property.image.trim() !== "";
  state.dialog.dataset.hasImage = String(hasImage);
  state.media.hidden = !hasImage;
  if (hasImage) {
    state.image.alt = `${text[type]} ${unit}`;
    state.image.src = optimizedImageUrl(property.image);
  } else {
    state.image.removeAttribute("src");
  }
  state.dialog.querySelector(".property-dialog__body").scrollTop = 0;
  openModal(state.dialog);
}
