import { tchaikovskyFloorLevels } from "./tchaikovsky-floors.js?v=1.0.0";

const planDirectory = "./plans/А3/";
const groundImage = `${planDirectory}2100 Osnova Prizemlja (A,C)_Nisko Prizemlje редакт.jpg`;
const categories = {
  apartments: {
    label: "Apartments", file: "chaikovsky-life.svg",
    levels: tchaikovskyFloorLevels.map((level) => ({
      id: level.id, label: level.id === "2100" ? "P/NPᴮ" : level.label,
      image: level.id === "2100" ? groundImage : level.image,
    })),
  },
  commercial: {
    label: "Commercial", file: "chaikovsky-commercial.svg",
    levels: [
      { id: "2000", label: "Sut", image: `${planDirectory}2000 Osnova Suterena (A,B,C) редакт.jpg` },
      { id: "2100", label: "P/NPᴮ", image: groundImage },
    ],
  },
  parking: {
    label: "Parking", file: "chaikovsky-parking.svg",
    levels: [
      { id: "1100", label: "-4 Po", image: `${planDirectory}1100 Osnova Podruma -4 - Garaža.jpg` },
      { id: "1200", label: "-3 Po", image: `${planDirectory}1200 Osnova Podruma -3 - Garaža.jpg` },
      { id: "1300", label: "-2 Po", image: `${planDirectory}1300 Osnova Podruma -2 - Garaža.jpg` },
      { id: "1400", label: "-1 Po", image: `${planDirectory}1400 Osnova Podruma -1 - Garaža.jpg` },
    ],
  },
};

export async function initializeTchaikovskyFloorPlan(apartments, onApartment) {
  const container = document.querySelector(".houses-plans_container");
  const host = container?.querySelector(".houses-plan");
  const floorRail = container?.querySelector(".floor__filter");
  if (!container || !host || !floorRail) return;

  const params = new URLSearchParams(location.search);
  let activeType = categories[params.get("property")] ? params.get("property") : "apartments";
  const requestedFloor = params.get("floor");
  const requestedWing = params.get("type")?.toUpperCase() || "A";
  const initialLevel = tchaikovskyFloorLevels.find((level) =>
    level.id === requestedFloor || level.label === requestedFloor,
  ) ?? tchaikovskyFloorLevels.find((level) => level.floors[requestedWing] === requestedFloor);
  let activeLevel = categories[activeType].levels.some((level) => level.id === initialLevel?.id)
    ? initialLevel.id : categories[activeType].levels[0].id;
  const selections = new Map();
  const cache = new Map();
  let requestVersion = 0;
  let svg;

  floorRail.innerHTML = `
    <p class="plan-floor-label">Floor</p>
    <button class="plan-floor-arrow plan-floor-arrow--up" type="button" aria-label="Show lower floors"><img src="./images/apartments-arrow.svg" alt=""></button>
    <div class="plan-floor-list" role="group" aria-label="Select floor" data-lenis-prevent></div>
    <button class="plan-floor-arrow plan-floor-arrow--down" type="button" aria-label="Show higher floors"><img src="./images/apartments-arrow.svg" alt=""></button>`;
  const tabs = document.createElement("div");
  tabs.className = "tchaikovsky-plan-types";
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Property type");
  tabs.innerHTML = Object.entries(categories).map(([type, category]) =>
    `<button class="tchaikovsky-plan-types__button" type="button" data-plan-type="${type}" aria-pressed="${type === activeType}">${category.label}</button>`,
  ).join("");
  container.append(tabs);
  const compass = document.createElement("img");
  compass.className = "plan-compass";
  compass.src = "./images/plan-compass.svg";
  compass.alt = "North orientation";
  container.append(compass);
  host.replaceChildren();
  const canvas = document.createElement("div");
  canvas.className = "plan-canvas";
  const markers = document.createElement("div");
  markers.className = "plan-markers";
  const surface = document.createElement("div");
  surface.className = "plan-surface";
  surface.append(canvas, markers);
  host.append(surface);
  host.setAttribute("data-lenis-prevent", "");
  const list = floorRail.querySelector(".plan-floor-list");
  const previous = floorRail.querySelector(".plan-floor-arrow--up");
  const next = floorRail.querySelector(".plan-floor-arrow--down");

  const updateArrows = () => {
    const horizontal = matchMedia("(max-width: 1000px)").matches;
    const position = horizontal ? list.scrollLeft : list.scrollTop;
    const maximum = horizontal ? list.scrollWidth - list.clientWidth : list.scrollHeight - list.clientHeight;
    previous.disabled = position < 1;
    next.disabled = position >= maximum - 1;
  };
  const scrollFloors = (direction) => {
    const horizontal = matchMedia("(max-width: 1000px)").matches;
    list.scrollBy({ [horizontal ? "left" : "top"]: direction * 144, behavior: "smooth" });
  };
  previous.addEventListener("click", () => scrollFloors(-1));
  next.addEventListener("click", () => scrollFloors(1));
  list.addEventListener("scroll", updateArrows, { passive: true });
  new ResizeObserver(updateArrows).observe(list);

  const load = (type) => {
    if (!cache.has(type)) {
      cache.set(type, (async () => {
        const category = categories[type];
        const response = await fetch(`${planDirectory}${category.file}?v=3`);
        if (!response.ok) throw new Error(`Unable to load ${category.file}`);
        const documentSvg = new DOMParser().parseFromString(await response.text(), "image/svg+xml");
        const plan = documentSvg.documentElement;
        plan.classList.add("floors-res", "tchaikovsky-life-plan");
        plan.setAttribute("role", "group");
        plan.setAttribute("aria-label", `${category.label} floor plan`);
        const [, , width, height] = plan.getAttribute("viewBox").split(/\s+/);
        category.levels.forEach((level) => {
          let group = plan.querySelector(`[id="_${level.id}"]`);
          if (!group) {
            group = documentSvg.createElementNS("http://www.w3.org/2000/svg", "g");
            group.id = `_${level.id}`;
            plan.append(group);
          }
          let image = group.querySelector("image");
          if (!image) {
            image = documentSvg.createElementNS("http://www.w3.org/2000/svg", "image");
            image.setAttribute("width", width);
            image.setAttribute("height", height);
            group.prepend(image);
          }
          image.setAttribute("href", level.image);
          image.setAttributeNS("http://www.w3.org/1999/xlink", "href", level.image);
        });
        return plan;
      })().catch((error) => { cache.delete(type); throw error; }));
    }
    return cache.get(type);
  };

  const renderLevel = () => {
    if (!svg) return;
    markers.replaceChildren();
    Array.from(svg.children).filter((element) => /^_\d+$/.test(element.id)).forEach((group) => {
      group.style.display = group.id === `_${activeLevel}` ? "block" : "none";
    });
    const group = svg.querySelector(`[id="_${activeLevel}"]`);
    const [, , width, height] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    group.querySelectorAll('[data-unit]').forEach((shape) => {
      const unit = shape.dataset.unit;
      const apartment = activeType === "apartments"
        ? apartments.find((item) => item.apartmentNumber === `STAN ${unit}`) : null;
      const bounds = shape.getBBox();
      shape.dataset.planUnit = unit;
      shape.classList.remove("is-highlighted");
      const marker = document.createElement(apartment ? "button" : "span");
      marker.className = "plan-unit-marker";
      marker.dataset.planUnit = unit;
      marker.textContent = unit.replace(/^([A-Z])0(\d)$/, "$1$2");
      marker.style.left = `${(bounds.x + bounds.width / 2) / width * 100}%`;
      marker.style.top = `${(bounds.y + bounds.height / 2) / height * 100}%`;
      marker.title = `${categories[activeType].label}: ${unit}`;
      if (apartment) {
        marker.type = "button";
        marker.setAttribute("aria-label", `Open apartment ${unit}`);
        marker.addEventListener("click", () => onApartment(apartment));
        shape.onclick = () => onApartment(apartment);
      }
      let shapeHovered = false;
      let markerHovered = false;
      let markerFocused = false;
      const highlight = () => {
        const enabled = shapeHovered || markerHovered || markerFocused;
        shape.classList.toggle("is-highlighted", enabled);
        marker.classList.toggle("is-highlighted", enabled);
      };
      shape.onmouseenter = () => { shapeHovered = true; highlight(); };
      shape.onmouseleave = () => { shapeHovered = false; highlight(); };
      marker.addEventListener("mouseenter", () => { markerHovered = true; highlight(); });
      marker.addEventListener("mouseleave", () => { markerHovered = false; highlight(); });
      marker.addEventListener("focus", () => { markerFocused = true; highlight(); });
      marker.addEventListener("blur", () => { markerFocused = false; highlight(); });
      markers.append(marker);
    });
    list.querySelectorAll("[data-plan-level]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.planLevel === activeLevel));
    });
    host.dataset.planType = activeType;
    host.dataset.planLevel = activeLevel;
  };

  const renderControls = () => {
    list.innerHTML = categories[activeType].levels.map((level) =>
      `<button class="plan-floor-button" type="button" data-plan-level="${level.id}" aria-pressed="${level.id === activeLevel}">${level.label}</button>`,
    ).join("");
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => { activeLevel = button.dataset.planLevel; renderLevel(); });
    });
    requestAnimationFrame(updateArrows);
  };

  const selectType = async (type) => {
    const request = ++requestVersion;
    selections.set(activeType, activeLevel);
    host.setAttribute("aria-busy", "true");
    try {
      const plan = await load(type);
      if (request !== requestVersion) return;
      activeType = type;
      activeLevel = selections.get(type) || categories[type].levels[0].id;
      svg = plan;
      canvas.replaceChildren(plan);
      tabs.querySelectorAll("button").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.planType === type));
      });
      renderControls();
      renderLevel();
      canvas.classList.remove("plan-load-error");
    } catch (error) {
      console.error("Floor plan could not be loaded", error);
      if (request === requestVersion && !svg) {
        canvas.textContent = "Unable to load the floor plan. Please refresh the page.";
        canvas.classList.add("plan-load-error");
      }
    } finally {
      if (request === requestVersion) host.setAttribute("aria-busy", "false");
    }
  };
  tabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => selectType(button.dataset.planType));
  });
  new ResizeObserver(() => {
    if (host.clientWidth && svg) renderLevel();
  }).observe(host);
  await selectType(activeType);
}
