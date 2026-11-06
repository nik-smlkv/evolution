function initializeFilterAccordion(filter) {
  const accordion = filter.closest(".catalog-filter-accordion");
  if (!accordion) return;
  const toggle = accordion.querySelector(".catalog-filter-accordion__toggle");
  const panel = accordion.querySelector(".catalog-filter-accordion__panel");
  const mobile = window.matchMedia("(max-width: 700px)");
  let isOpen = false;
  const sync = () => {
    const expanded = !mobile.matches || isOpen;
    if (!expanded && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    accordion.dataset.open = String(expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    panel.inert = !expanded;
    panel.setAttribute("aria-hidden", String(!expanded));
  };
  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    sync();
  });
  mobile.addEventListener("change", sync);
  sync();
}

export function initializeCatalogFilterControls() {
  const filter = document.querySelector(".catalog-object-filter");
  if (!filter) return;
  initializeFilterAccordion(filter);
  const floors = filter.querySelector(".filter__floor_list");
  // Preserve the existing filtering handlers while making every pill keyboard accessible.
  const upgradeButtons = () => filter.querySelectorAll("span.filter__btn").forEach((span) => {
    const button = document.createElement("button");
    Array.from(span.attributes).forEach(({ name, value }) => button.setAttribute(name, value));
    button.type = "button";
    button.textContent = span.textContent;
    span.replaceWith(button);
  });
  upgradeButtons();
  const syncSelection = () => {
    upgradeButtons();
    update();
    filter.querySelectorAll("button.filter__btn").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    });
    const active = floors.querySelector(".active");
    if (active && floors.clientWidth) {
      const bounds = floors.getBoundingClientRect();
      const selected = active.getBoundingClientRect();
      const offset = selected.left < bounds.left ? selected.left - bounds.left
        : selected.right > bounds.right ? selected.right - bounds.right : 0;
      if (offset) floors.scrollBy({ left: offset, behavior: "instant" });
    }
  };
  const navigation = document.createElement("div");
  navigation.className = "catalog-floor-navigation";
  const arrow = (direction, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `catalog-floor-arrow catalog-floor-arrow--${direction}`;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true"><path d="M1 1L7 7L13 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return button;
  };
  const previous = arrow("previous", "Previous floor");
  const next = arrow("next", "Next floor");
  floors.before(navigation);
  navigation.append(previous, floors, next);
  floors.setAttribute("data-lenis-prevent", "");
  floors.setAttribute("role", "group");
  floors.setAttribute("aria-label", "Select floor");
  floors.tabIndex = 0;
  floors.addEventListener("wheel", (event) => {
    if (event.ctrlKey) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? floors.clientWidth : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    const maximum = Math.max(0, floors.scrollWidth - floors.clientWidth);
    const left = Math.max(0, Math.min(maximum, floors.scrollLeft + delta));
    if (left === floors.scrollLeft) return;
    event.preventDefault();
    floors.scrollTo({ left, behavior: "instant" });
  }, { passive: false });
  const update = () => {
    const floorButtons = Array.from(floors.querySelectorAll(".filter__btn_floor"));
    const index = floorButtons.findIndex((button) => button.classList.contains("active"));
    previous.disabled = index <= 0;
    next.disabled = index >= floorButtons.length - 1;
    navigation.dataset.atStart = String(previous.disabled);
    navigation.dataset.hasFloors = String(floorButtons.length > 1);
  };
  const moveFloor = (direction) => {
    const floorButtons = Array.from(floors.querySelectorAll(".filter__btn_floor"));
    const index = floorButtons.findIndex((button) => button.classList.contains("active"));
    // Use the same handler as a direct floor choice to retain all other filters and update the URL.
    floorButtons[index + direction]?.click();
    syncSelection();
  };
  previous.addEventListener("click", () => moveFloor(-1));
  next.addEventListener("click", () => moveFloor(1));
  syncSelection();
  new MutationObserver(syncSelection).observe(filter, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  new ResizeObserver(syncSelection).observe(floors);

  const social = document.querySelector(".info_footer_content_block .block-social");
  const address = document.querySelector(".footer-address__content");
  if (social && address && !address.querySelector(".catalog-grid-social")) {
    const clone = social.cloneNode(true);
    clone.classList.add("catalog-grid-social");
    address.append(clone);
  }
}
