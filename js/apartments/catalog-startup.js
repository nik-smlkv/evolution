import { langArr } from "../languages/languages.js?v=1.0.5";

const root = document.documentElement;
const wrapper = document.querySelector(".wrapper");
document.querySelector("[data-house-title]").textContent = document.body.dataset.catalogHouse === "tchaikovsky" ? "Tchaikovsky" : "Vivaldi";
const savedLanguage = document.cookie.match(/(?:^|;\s*)language=([^;]*)/)?.[1];
const viewButton = document.querySelector(".catalog-plan-button");
viewButton.dataset.key = document.body.dataset.catalogView === "plan"
  ? (document.body.dataset.catalogHouse === "tchaikovsky" ? "catalog_select_parameters" : "catalog_back_grid")
  : "catalog_select_plan";
viewButton.textContent = langArr[savedLanguage === "en" ? "en" : "srb"][viewButton.dataset.key];
const messages = savedLanguage === "en"
  ? { loading: "Loading apartments…", error: "Unable to load apartments. Please try again.", retry: "Reload page" }
  : { loading: "Učitavanje apartmana…", error: "Nije moguće učitati apartmane. Pokušajte ponovo.", retry: "Učitaj ponovo" };

document.querySelector("[data-catalog-loading]").textContent = messages.loading;
document.querySelector("[data-catalog-error]").textContent = messages.error;
document.querySelector("[data-catalog-retry]").textContent = messages.retry;

const waitForImage = (image) => image.decode
  ? image.decode()
  : new Promise((resolve, reject) => {
    if (image.complete) {
      image.naturalWidth ? resolve() : reject(new Error("Image could not be loaded"));
      return;
    }
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", reject, { once: true });
  });

try {
  const { catalogReady, refreshCatalogLayout } = await import("./requestt.js?v=1.0.59");
  await catalogReady;
  await document.fonts.ready;

  if (document.body.dataset.catalogView === "plan") {
    if (document.querySelector(".plan-load-error")) throw new Error("Floor plan could not be loaded");
    const host = document.querySelector(".houses-plan");
    const activePlan = host.dataset.planLevel
      ? host.querySelector(`[id="_${host.dataset.planLevel}"]`)
      : Array.from(host.querySelectorAll(".floors-res")).find((plan) => getComputedStyle(plan).display !== "none");
    const images = Array.from(activePlan?.querySelectorAll("image") || [])
      .map((image) => {
        const preview = new Image();
        preview.src = image.getAttribute("href") || image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        return waitForImage(preview);
      });
    if (!images.length) throw new Error("Floor plan is not ready");
    await Promise.all(images);
  } else {
    const list = document.querySelector(".available-apartments__list");
    const columns = getComputedStyle(document.querySelector(".catalog-skeleton__cards")).gridTemplateColumns.split(/\s+/).length;
    const images = Array.from(list.querySelectorAll("img")).slice(0, columns);
    await Promise.allSettled(images.map((image) => {
      image.fetchPriority = "high";
      image.loading = "eager";
      return waitForImage(image);
    }));
  }

  wrapper.setAttribute("aria-busy", "false");
  document.querySelector(".catalog-plan-button").disabled = false;
  root.classList.remove("catalog-loading");
  refreshCatalogLayout();
  document.querySelector(".catalog-startup").remove();
  document.querySelector(".catalog-skeleton").remove();
} catch (error) {
  console.error("Catalog could not be initialized", error);
  wrapper.setAttribute("aria-busy", "false");
  root.classList.add("catalog-load-error");
}
