const houseNames = Object.freeze({
  tchaikovsky: "Tchaikovsky",
  vivaldi: "Vivaldi",
});

export function normalizeHouse(value) {
  const id = String(value ?? "").trim().toLowerCase();
  return Object.hasOwn(houseNames, id) ? id : null;
}

export function houseFromUrl(value) {
  if (!value) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  const route = url.pathname.match(/\/search-by-parameters\/(tchaikovsky|vivaldi)(?:\/(?:index\.html)?)?$/);
  if (route) return route[1];
  const house = normalizeHouse(url.searchParams.get("house"));
  if (house) return house;
  // The generic catalog displays Vivaldi when house is absent or unsupported.
  return /\/search-by-parameters\.html$/.test(url.pathname) ? "vivaldi" : null;
}

export function resolveHouse({ house, catalogHouse, url, previousHouse } = {}) {
  const id = normalizeHouse(house) || normalizeHouse(catalogHouse)
    || houseFromUrl(url) || normalizeHouse(previousHouse);
  return id ? { id, name: houseNames[id] } : null;
}

let rememberedHouse = null;

export function getSelectedHouse(house = null) {
  const storageKey = `evolution:selected-house:${new URL("../", import.meta.url).pathname}`;
  let previousHouse = rememberedHouse;
  try { previousHouse = sessionStorage.getItem(storageKey); } catch { /* Storage may be unavailable. */ }
  const selected = resolveHouse({
    house,
    catalogHouse: document.body?.dataset.catalogHouse,
    url: window.location.href,
    previousHouse,
  });
  if (selected) {
    rememberedHouse = selected.id;
    try { sessionStorage.setItem(storageKey, selected.id); } catch { /* Keep the in-page selection. */ }
  }
  return selected;
}
