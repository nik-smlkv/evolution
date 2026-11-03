export function initializeCatalogFilterControls() {
  const filter = document.querySelector(".catalog-object-filter");
  if (!filter) return;
  const floors = filter.querySelector(".filter__floor_list");
  // Preserve the existing filtering handlers while making every pill keyboard accessible.
  filter.querySelectorAll("span.filter__btn").forEach((span) => {
    const button = document.createElement("button");
    Array.from(span.attributes).forEach(({ name, value }) => button.setAttribute(name, value));
    button.type = "button";
    button.textContent = span.textContent;
    span.replaceWith(button);
  });
  const syncSelection = () => {
    filter.querySelectorAll("button.filter__btn").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.classList.contains("active")));
    });
    const active = floors.querySelector(".active");
    if (active && floors.clientWidth) {
      const bounds = floors.getBoundingClientRect();
      const selected = active.getBoundingClientRect();
      const offset = selected.left < bounds.left ? selected.left - bounds.left
        : selected.right > bounds.right ? selected.right - bounds.right : 0;
      if (offset) floors.scrollBy({ left: offset, behavior: "auto" });
    }
  };
  syncSelection();
  new MutationObserver(syncSelection).observe(filter, { subtree: true, attributes: true, attributeFilter: ["class"] });

  const navigation = document.createElement("div");
  navigation.className = "catalog-floor-navigation";
  const arrow = (direction, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `catalog-floor-arrow catalog-floor-arrow--${direction}`;
    button.setAttribute("aria-label", label);
    const image = document.createElement("img");
    image.src = "./images/apartments-arrow.svg";
    image.alt = "";
    button.append(image);
    return button;
  };
  const previous = arrow("previous", "Show previous floor options");
  const next = arrow("next", "Show more floor options");
  floors.before(navigation);
  navigation.append(previous, floors, next);
  floors.setAttribute("data-lenis-prevent", "");
  floors.setAttribute("role", "group");
  floors.setAttribute("aria-label", "Select floor");
  const update = () => {
    const maximum = floors.scrollWidth - floors.clientWidth;
    previous.disabled = floors.scrollLeft <= 1;
    next.disabled = floors.scrollLeft >= maximum - 1;
    navigation.dataset.atStart = String(previous.disabled);
    navigation.dataset.overflow = String(maximum > 1);
  };
  const scroll = (direction) => floors.scrollBy({
    left: direction * 210,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
  previous.addEventListener("click", () => scroll(-1));
  next.addEventListener("click", () => scroll(1));
  floors.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(() => {
    syncSelection();
    update();
  }).observe(floors);
  update();

  const social = document.querySelector(".info_footer_content_block .block-social");
  const address = document.querySelector(".footer-address__content");
  if (social && address && !address.querySelector(".catalog-grid-social")) {
    const clone = social.cloneNode(true);
    clone.classList.add("catalog-grid-social");
    address.append(clone);
  }
}
