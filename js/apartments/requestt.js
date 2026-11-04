import { loadHouse } from "./houses.js?v=1.0.8";
import { tchaikovskyFloorLevels } from "./tchaikovsky-floors.js?v=1.0.0";
import { openModal } from "../modal.js";
import { initializeTchaikovskyFloorPlan } from "./floor-plan.js?v=1.0.5";
import { initializeCatalogFilterControls } from "./catalog-filter-controls.js?v=1.0.1";
const requestedHouse = new URLSearchParams(window.location.search).get("house");
const catalog = await loadHouse(requestedHouse);
const house = catalog.id;
let data = JSON.parse(catalog.apartments);
document.body.dataset.catalogHouse = house;
document.body.dataset.catalogView = "grid";
document.body.classList.toggle("tchaikovsky-catalog", house === "tchaikovsky");
document.body.classList.toggle("tchaikovsky-grid-view", house === "tchaikovsky");
document.documentElement.classList.toggle("tchaikovsky-catalog", house === "tchaikovsky");
document.title = `${catalog.name} — Apartments`;
const catalogTitle = document.querySelector("[data-house-title]");
if (catalogTitle) catalogTitle.textContent = catalog.name;
document
  .querySelector(`[data-house-option="${house}"]`)
  ?.classList.add("is-active");
const floorPlanButton = document.querySelector(".catalog-plan-button");
const [firstApartment, ...lastApartment] = data;
let apartmentFancyBox = document.querySelector(".apartment__fancybox");
document.querySelector(".apartment__img").src = firstApartment.planImg;
apartmentFancyBox.setAttribute("href", firstApartment.planImg);
let selectedLamela = null;
let selectedFloor = null;
const areaValues = data.map((apartment) => apartment.area).filter(Number.isFinite);
const areaBounds = house === "tchaikovsky"
  ? { min: Math.floor(Math.min(...areaValues)), max: Math.ceil(Math.max(...areaValues)) }
  : { min: 30, max: 126 };
let selectedMinArea = areaBounds.min;
let selectedMaxArea = areaBounds.max;
const readAreaRange = (params) => {
  const read = (key, fallback) => {
    const raw = params.get(key);
    const number = raw === null || raw.trim() === "" ? NaN : Number(raw);
    return Number.isFinite(number) ? Math.min(areaBounds.max, Math.max(areaBounds.min, number)) : fallback;
  };
  const from = read("kvadrati-od", areaBounds.min);
  const to = read("stanovi-do", areaBounds.max);
  return { from: Math.min(from, to), to: Math.max(from, to) };
};
const popupCurrentHouse = document.querySelector(".popup.popup_type_house");
const formatArea = (apartment) =>
  Number.isFinite(apartment.area) ? `${apartment.area}m²` : "—";
const formatModalApartmentNumber = (number) =>
  String(number).replace(/^STAN\s*/i, "").replace(/^([A-Z])\s*(\d+)/i, "$1 $2");
const formatModalArea = (apartment) =>
  Number.isFinite(apartment.area) ? `${apartment.area} m²` : "—";
const formatApartmentDetails = (apartment) =>
  apartment.floor
    ? `${apartment.floor} <i></i> ${formatArea(apartment)}`
    : formatArea(apartment);
const whenDocumentReady = (callback) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
};

const setTchaikovskyPlanPopup = (apartment) => {
  const popup = document.querySelector(".popup_type_house");
  if (!popup || !apartment) return;

  popup.querySelector(".js-apartment-wing").textContent = apartment.buldingWing.replace("Lamela", "").trim();
  popup.querySelector(".js-apartment-floor").textContent = apartment.floor ?? "";
  popup.querySelector(".js-apartment-area").textContent = formatModalArea(apartment);
  popup.querySelector(".js-apartment-number").textContent = formatModalApartmentNumber(apartment.apartmentNumber);
  popup.querySelector(".apartment__img").src = apartment.planImg;
  openModal(popup);
};

whenDocumentReady(() => {
  if (house === "tchaikovsky") initializeTchaikovskyFloorPlan(data, setTchaikovskyPlanPopup);
});

const updateSEOTags = (params) => {
  const stanoviDo = params.get("stanovi-do");
  const type = params.get("type");
  const kvadratiOd = params.get("kvadrati-od");

  const seoMap = {
    // Фильтры по типу квартиры
    garsonjere: {
      title:
        "Garsonjere Beograd | Prodaja Garsonjera u Novogradnji | Evolution Residence",
      desc: "Garsonjere u Beogradu na prodaju – novogradnja u centru, jeftine garsonjere za studente. Direktno od investitora.",
    },
    jednosoban: {
      title: "Jednosoban Stan Beograd | Cene i Prodaja | Evolution Residence",
      desc: "Jednosoban stan u Beogradu – prodaja jednosobnih stanova u centru i novogradnji direktno od investitora.",
    },
    dvosoban: {
      title:
        "Dvosoban Stan Beograd | Prodaja Dvosobnih Stanova | Evolution Residence",
      desc: "Dvosoban stan u Beogradu – prodaja dvosobnih stanova u novogradnji i centru direktno od investitora.",
    },
    trosoban: {
      title:
        "Trosoban Stan Beograd | Prodaja Trosobnih Stanova | Evolution Residence",
      desc: "Trosoban stan u Beogradu – prodaja trosobnih stanova u novogradnji direktno od investitora.",
    },
    // Фильтры по метражу
    30: {
      title: "Stanovi do 30 Kvadrata Beograd | Prodaja | Evolution Residence",
      desc: "Prodaja stanova do 30 kvadrata u Beogradu – novogradnja direktno od investitora. Pogledajte aktuelnu ponudu malih stanova.",
    },
    35: {
      title: "Prodaja Stanova do 35 Kvadrata Beograd | Evolution Residence",
      desc: "Prodaja stanova do 35 kvadrata u Beogradu – mali stanovi u novogradnji direktno od investitora.",
    },
    40: {
      title: "Prodaja Stanova do 40 Kvadrata Beograd | Evolution Residence",
      desc: "Prodaja stanova do 40 kvadrata u Beogradu – novogradnja, povoljne cene, direktno od investitora.",
    },
    50: {
      title: "Stanovi do 50 Kvadrata Beograd | Prodaja | Evolution Residence",
      desc: "Stanovi do 50 kvadrata u Beogradu na prodaju – novogradnja direktno od investitora.",
    },
  };

  // Определяем какой ключ использовать
  let seo = null;

  if (type && seoMap[type]) {
    seo = seoMap[type]; // ?type=garsonjere → ключ "garsonjere"
  } else if (stanoviDo && seoMap[stanoviDo]) {
    seo = seoMap[stanoviDo]; // ?stanovi-do=35 → ключ "35"
  }

  // Дефолтные значения если нет параметров
  const title = seo?.title ?? `${catalog.name} — Apartments`;
  const description =
    seo?.desc ?? `Available apartments in ${catalog.name}.`;

  // Применяем title
  document.title = title;

  // Применяем meta description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", description);

  // Применяем canonical
  let canonicalTag = document.querySelector('link[rel="canonical"]');
  if (!canonicalTag) {
    canonicalTag = document.createElement("link");
    canonicalTag.rel = "canonical";
    document.head.appendChild(canonicalTag);
  }
  canonicalTag.href = window.location.href;
};

const applyURLParams = () => {
  const params = new URLSearchParams(window.location.search);
  const stanoviDo = params.get("stanovi-do");
  const type = params.get("type");
  const kvadratiOd = params.get("kvadrati-od");
  const floor = params.get("floor"); // ← было не объявлено, поэтому падало
  const normalizedFloor = house === "tchaikovsky" && floor
    ? (tchaikovskyFloorLevels.find((level) => level.label === floor || level.id === floor)
      ?? tchaikovskyFloorLevels.find((level) => level.floors[type?.toUpperCase() || "A"] === floor)
      ?? tchaikovskyFloorLevels.find((level) => floor === "VP" && level.id === "3100"))?.label
    : floor;

  const { from: minArea, to: maxArea } = readAreaRange(params);
  selectedMinArea = minArea;
  selectedMaxArea = maxArea;

  // Применяем тип квартиры (lamela)
  if (type) {
    const lamelaButtons = document.querySelectorAll(".filter__btn_lamela");
    lamelaButtons.forEach((btn) => {
      if (btn.textContent.trim().toLowerCase() === type.toLowerCase()) {
        selectedLamela = btn.textContent.trim();
        lamelaButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  }

  // Применяем этаж
  if (floor) {
    const floorButtons = document.querySelectorAll(
      ".apartments__filter .filter__btn_floor",
    );
    floorButtons.forEach((btn) => {
      if (btn.textContent.trim() === normalizedFloor) {
        selectedFloor = btn.textContent.trim();
        floorButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
      }
    });
  }

  // Применяем фильтрацию карточек с учётом типа и этажа
  handleFilteredCards(selectedLamela, selectedFloor);

  // Применяем метраж через слайдер
  const range = document.querySelector(".js-range-slider");
  if (range) {
    const sliderInstance = $(range).data("ionRangeSlider");
    if (sliderInstance) sliderInstance.update({ from: minArea, to: maxArea });
  }

  const inputFrom = document.querySelector("#example_2_input_from");
  const inputTo = document.querySelector("#example_2_input_to");
  if (inputFrom) inputFrom.value = minArea;
  if (inputTo) inputTo.value = maxArea;

  // Применяем фильтрацию по метражу поверх карточек
  filterAndRenderApartments(minArea, maxArea);

  updateSEOTags(params);
};

const updateURL = () => {
  const params = new URLSearchParams();
  params.set("house", house);
  if (document.body.dataset.catalogView === "plan") params.set("view", "plan");

  if (selectedLamela && selectedLamela !== "All") {
    params.set("type", selectedLamela.toLowerCase());
  }

  if (selectedFloor && selectedFloor !== "All") {
    params.set("floor", selectedFloor);
  }

  const inputFrom = document.querySelector("#example_2_input_from");
  const inputTo = document.querySelector("#example_2_input_to");
  if (inputFrom && inputTo) {
    const { min, max } = areaBounds;
    if (Number(inputFrom.value) !== min)
      params.set("kvadrati-od", inputFrom.value);
    if (Number(inputTo.value) !== max)
      params.set("stanovi-do", inputTo.value);
  }

  const newURL = params.toString()
    ? `${window.location.pathname}?${params.toString()}`
    : window.location.pathname;

  window.history.pushState({}, "", newURL);

  // Обновляем SEO теги
  updateSEOTags(params);
};

const getFirstApartment = () => {
  document.querySelector(".js-apartment-wing").textContent =
    firstApartment.buldingWing.replace("Lamela", "").trim();
  document.querySelector(".js-apartment-floor").textContent =
    firstApartment.floor ?? "";
  document.querySelector(".js-apartment-area").textContent = formatArea(firstApartment);
  document.querySelector(".js-apartment-number").textContent =
    firstApartment.apartmentNumber;
};

const getApartmentFloors = () => {
  const apartmentFloorsLists = document.querySelectorAll(".filter__floor_list");
  const filterApartmentFloorList = document.querySelector(
    ".apartments__filter .filter__floor_list",
  );
  const priorityOrder = house === "tchaikovsky"
    ? tchaikovskyFloorLevels.map((level) => level.label)
    : ["NP", "P", "VP", "1", "2", "3", "4", "5", "6", "PS"];
  const uniqueFloors = [...new Set(data.map((item) => item.floor))]
    .filter((floor) => floor && floor !== "—")
    .sort(
    (a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      return indexA !== -1 && indexB !== -1
        ? indexA - indexB
        : indexA !== -1
          ? -1
          : indexB !== -1
            ? 1
            : String(a).localeCompare(String(b), undefined, { numeric: true });
    },
  );
  filterApartmentFloorList.insertAdjacentHTML(
    "beforeend",
    `
<span class="filter__btn control filter__btn_floor active">All</span>
		`,
  );
  apartmentFloorsLists.forEach((apartmentFloors) => {
    uniqueFloors.forEach((uniqueFloor) => {
      apartmentFloors.insertAdjacentHTML(
        "beforeend",
        `
<span class="filter__btn control filter__btn_floor">${uniqueFloor}</span>
`,
      );
    });
  });

  const filterHouseFloorList = document.querySelector(
    ".floor__list_houses_plans .filter__btn_floor",
  );
  filterHouseFloorList?.classList.add("active");
};

const getLamela = () => {
  const apartmentLamelaList = document.querySelector(".lamela__list");
  const uniqueLamelas = [
    ...new Set(
      data.map((item) => item.buldingWing.replace("Lamela", "").trim()),
    ),
  ];
  uniqueLamelas.map((uniqueLamela) => {
    apartmentLamelaList.insertAdjacentHTML(
      "beforeend",
      `
			 <span class="filter__btn control filter__btn_lamela">${uniqueLamela}</span>
		`,
    );
  });
};

const getApartmentCards = (firstApartment) => {
  const apartmentCards = document.querySelector(".available-apartments__list");
  data.map((item) => {
    const img = item.apartmentImg;
    apartmentCards.insertAdjacentHTML(
      "beforeend",
      `
				<div class="apartment__item apartment-card-item flex-style-column ${house !== "tchaikovsky" && firstApartment.id === item.id ? "active" : ""}" data-key="${item.id}" tabindex="0" role="button" aria-label="Open apartment ${item.apartmentNumber}">
				  <div class="apartment-card-item__meta">
						<span class="apartment-card-item__name">${item.apartmentNumber}</span>
						<span class="apartment-card-item__details">${formatApartmentDetails(item)}</span>
				  </div>
				  <div class="apartment-card-item__image">
						<img src="${img}?v=3" alt="Plan of ${item.apartmentNumber}" loading="lazy" />
				  </div>
				</div>
			`,
    );
  });
};

const handleFilteredCards = (selectedLamela, selectedFloor) => {
  const apartmentCards = document.querySelectorAll(".apartment__item");

  apartmentCards.forEach((card) => {
    const cardId = card.getAttribute("data-key");
    const apartment = data.find((item) => item.id.toString() === cardId);
    const lamelaIsAll = selectedLamela === "All" || !selectedLamela;
    const floorIsAll = selectedFloor === "All" || !selectedFloor;
    const lamelaMatch =
      lamelaIsAll ||
      apartment.buldingWing.replace("Lamela", "").trim() === selectedLamela;
    const floorMatch =
      floorIsAll || String(apartment.floor ?? "") === String(selectedFloor);
    const areaMatch = !catalog.hasAreaFilter ||
      (apartment.area >= selectedMinArea && apartment.area <= selectedMaxArea);
    if (lamelaMatch && floorMatch && areaMatch) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
  getObjectCount(getVisibleFlexCards().length);
};

const getVisibleFlexCards = () => {
  const allCards = document.querySelectorAll(".apartment__item");
  const visibleCards = Array.from(allCards).filter((card) => {
    return getComputedStyle(card).display === "flex";
  });
  return visibleCards;
};

const setupLamelaFilter = () => {
  const lamelaButtons = document.querySelectorAll(".filter__btn_lamela");
  lamelaButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedLamela = button.textContent.trim();
      lamelaButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      handleFilteredCards(selectedLamela, selectedFloor);
      updateURL();
    });
  });
};

const setupFloorFilter = (targetSelector) => {
  const floorButtons = document.querySelectorAll(
    `${targetSelector} .filter__btn_floor`,
  );
  floorButtons.forEach((button) => {
    button.addEventListener("click", (evt) => {
      const isFilterCards = evt.target.parentElement.classList.contains(
        "floor__list_houses_plans",
      );
      selectedFloor = button.textContent.trim();
      floorButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      !isFilterCards
        ? handleFilteredCards(selectedLamela, selectedFloor)
        : handleFilteredHousePlans(selectedFloor);
      updateURL();
    });
  });
};

const getVisiblePolygons = (data) => {
  const availableFloors = data.map((item) => item.floor.toLowerCase());
  const availableFloorName = data.map((item) =>
    item.apartmentNumber.replace("STAN", "").toLowerCase(),
  );
  const splitNames = availableFloorName.map((name) => {
    const trimmed = name.trim().toUpperCase();
    const letter = trimmed.match(/[A-Z]/)[0];
    const number = trimmed.match(/\d+/)[0];
    return { letter, number };
  });
  const combined = availableFloorName.map((name, index) => {
    const floor = availableFloors[index];
    return `${splitNames[index].letter.toUpperCase()}_${floor.toLowerCase()}_${splitNames[index].number}`;
  });
  setEventCurrentPolygon(combined, data);
};

const currentHouses = document.querySelectorAll(".current_home");
currentHouses.forEach((currentHouse) => {
  currentHouse.addEventListener("click", (evt) => {
    openModal(popupCurrentHouse);
  });
});

function setEventCurrentPolygon(combined, data) {
  const polygons = document.querySelectorAll(".enabled");
  polygons.forEach((item) => {
    if (!combined.includes(item.id)) {
      item.classList.remove("enabled");
      item.classList.add("disabled");
    }
    item.addEventListener("click", (evt) => {
      const currentPolygon = evt.target;
      const polygonId = currentPolygon.id;
      const matched = combined.find((entry) => entry.includes(polygonId));
      console.log(matched, combined);
      if (matched) {
        const letter = matched[0];
        const number = matched.split("_")[2];
        const searchKey = letter + number;
        console.log(searchKey);
        const matchedData = data.find((item) =>
          item.apartmentNumber.toLowerCase().includes(searchKey.toLowerCase()),
        );
        document.querySelector(
          ".popup_type_house .js-apartment-wing",
        ).textContent = matchedData.buldingWing;
        document.querySelector(
          ".popup_type_house .js-apartment-floor",
        ).textContent = matchedData.floor;
        document.querySelector(
          ".popup_type_house .js-apartment-area",
        ).textContent = formatModalArea(matchedData);
        document.querySelector(
          ".popup_type_house .js-apartment-number",
        ).textContent = formatModalApartmentNumber(matchedData.apartmentNumber);
        document.querySelector(".popup_type_house .apartment__img").src =
          matchedData.planImg;
      }

      openModal(popupCurrentHouse);
    });
  });
}

function handleFilteredHousePlans(selectedFloor) {
  const housesPlans = document.querySelectorAll(".floors-res");
  housesPlans.forEach((card) => {
    card.classList.contains(`plans-${selectedFloor.toLowerCase()}`)
      ? (card.style.display = "flex")
      : (card.style.display = "none");
  });
}

const getObjectCount = (visibleCards) => {
  document.querySelector(".js-get-apartments").textContent = visibleCards;
};

function filterAndRenderApartments(minValue, maxValue) {
  selectedMinArea = minValue;
  selectedMaxArea = maxValue;
  handleFilteredCards(selectedLamela, selectedFloor);
}
const initializeRangeSlider = () => {
  if (!catalog.hasAreaFilter) return;
  const range = document.querySelector(".js-range-slider");
  const inputFrom = document.querySelector("#example_2_input_from");
  const inputTo = document.querySelector("#example_2_input_to");
  const { min, max } = areaBounds;
  const params = new URLSearchParams(window.location.search);
  const { from: fromURL, to: toURL } = readAreaRange(params);

  if (!range || !inputFrom || !inputTo) {
    console.error("Ошибка: один из элементов не найден!");
    return;
  }

  $(range).ionRangeSlider({
    skin: "round",
    type: "double",
    min,
    max,
    from: fromURL, // ← берём из URL
    to: toURL, // ← берём из URL
    onStart: (data) => updateRangeSliderInputs(data, inputFrom, inputTo),
    onChange: (data) => updateRangeSliderInputs(data, inputFrom, inputTo),
    onFinish: (data) => {
      updateRangeSliderInputs(data, inputFrom, inputTo);
      updateURL();
    },
  });
};

function updateRangeSliderInputs(data, inputFrom, inputTo) {
  inputFrom.value = data.from;
  inputTo.value = data.to;
  filterAndRenderApartments(data.from, data.to);
}

whenDocumentReady(() => {
  const views = {
    1: ".apartments__filter",
    2: ".houses-plans_container",
  };

  Object.entries(views).forEach(([key, selector]) => {
    const el = document.querySelector(selector);
    if (el) {
      el.style.display = key === "1" ? "flex" : "none";
    }
  });

  document.querySelectorAll(".button__choice").forEach((button) => {
    button.addEventListener("click", (evt) => {
      const key = evt.currentTarget.dataset.key;

      document
        .querySelectorAll(".button__choice")
        .forEach((btn) => btn.classList.remove("choice-active"));
      evt.currentTarget.classList.add("choice-active");

      Object.values(views).forEach((selector) => {
        const el = document.querySelector(selector);
        if (el) el.style.display = "none";
      });

      const targetSelector = views[key];
      const targetElement = document.querySelector(targetSelector);
      setupFloorFilter(targetSelector);
      if (targetElement) targetElement.style.display = "flex";
      document.body.dataset.catalogView = key === "2" ? "plan" : "grid";
      document.body.classList.toggle("tchaikovsky-plan-view", house === "tchaikovsky" && key === "2");
      document.body.classList.toggle("tchaikovsky-grid-view", house === "tchaikovsky" && key !== "2");
    });
  });
  function redirectBack() {
    if (document.referrer) {
      window.location.href = "https://evolutionresidence.rs/";
    } else {
      alert("Предыдущий URL недоступен!");
    }
  }
});

whenDocumentReady(() => {
  if (!catalog.hasFloorPlans || !floorPlanButton) return;

  const gridButton = document.querySelector('.button__choice[data-key="1"]');
  const planButton = document.querySelector('.button__choice[data-key="2"]');
  const gridView = document.querySelector(".apartments__filter");
  const floorPlanView = document.querySelector(".houses-plans_container");
  const updateViewButton = () => {
    const isPlan = document.body.dataset.catalogView === "plan";
    floorPlanButton.textContent = isPlan
      ? (house === "tchaikovsky" ? "SELECT BY PARAMETERS" : "BACK TO THE GRID")
      : "SELECT ON THE FLOOR PLAN";
    floorPlanButton.setAttribute("aria-pressed", String(isPlan));
  };

  floorPlanButton.addEventListener("click", () => {
    if (document.body.dataset.catalogView === "plan") {
      gridButton?.click();
      gridView?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      planButton?.click();
      (house === "tchaikovsky" ? document.querySelector("#apartments") : floorPlanView)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    updateViewButton();
    updateURL();
  });
  if (new URLSearchParams(location.search).get("view") === "plan") planButton?.click();
  updateViewButton();
});

whenDocumentReady(() => {
  getFirstApartment();
  getApartmentFloors();
  getApartmentCards(firstApartment);
  getLamela();
  if (house === "tchaikovsky") initializeCatalogFilterControls();
  setupLamelaFilter();
  setupFloorFilter(".apartments__filter");
  handleFilteredCards();
  if (catalog.hasFloorPlans && house !== "tchaikovsky") {
    handleFilteredHousePlans("np");
    getVisiblePolygons(data);
  }
  initializeRangeSlider();
  applyURLParams();
});

whenDocumentReady(() => {
  var apartmentCards = document.querySelectorAll(".apartment__item");
  const openApartment = (item) => {
      const apartmentCardsList = document.querySelectorAll(".apartment__item");
      apartmentCardsList.forEach((item) => {
        item.classList.remove("active");
      });
      item.classList.add("active");
      const apartmentId = item.getAttribute("data-key");
      let currentItem = data.find((apartment) => apartment.id == apartmentId);
      if (currentItem) {
        // Обновляем данные в секции с информацией
        const imgElement = document.querySelector(
          ".apartment-card__content .apartment__img",
        );
        let apartmentFancyBox = document.querySelector(".apartment__fancybox");
        if (imgElement) {
          apartmentFancyBox.setAttribute("href", currentItem.planImg);
          imgElement.src = currentItem.planImg;
        }
        document.querySelector(".js-apartment-wing").textContent =
          currentItem.buldingWing.replace("Lamela", "").trim();
        document.querySelector(".js-apartment-floor").textContent =
          currentItem.floor ?? "";
        document.querySelector(".js-apartment-area").textContent = formatArea(currentItem);
        document.querySelector(".js-apartment-number").textContent =
          currentItem.apartmentNumber;
        document.querySelector(".popup_type_house .js-apartment-wing").textContent =
          currentItem.buldingWing.replace("Lamela", "").trim();
        document.querySelector(".popup_type_house .js-apartment-floor").textContent =
          currentItem.floor ?? "";
        document.querySelector(".popup_type_house .js-apartment-area").textContent =
          formatModalArea(currentItem);
        document.querySelector(".popup_type_house .js-apartment-number").textContent =
          formatModalApartmentNumber(currentItem.apartmentNumber);
        document.querySelector(".popup_type_house .apartment__img").src =
          currentItem.planImg;
        openModal(popupCurrentHouse);
      }
  };
  apartmentCards.forEach((item) => {
    item.addEventListener("click", () => openApartment(item));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openApartment(item);
      }
    });
  });
});

document.querySelector("[data-reset-filters]")?.addEventListener("click", () => {
  selectedLamela = null;
  selectedFloor = null;
  selectedMinArea = areaBounds.min;
  selectedMaxArea = areaBounds.max;
  document.querySelectorAll(".filter__btn_lamela, .filter__btn_floor").forEach((button) => {
    button.classList.toggle("active", button.textContent.trim() === "All");
  });
  handleFilteredCards(selectedLamela, selectedFloor);
  const range = document.querySelector(".js-range-slider");
  const slider = range ? $(range).data("ionRangeSlider") : null;
  if (slider) slider.update({ from: areaBounds.min, to: areaBounds.max });
  document.querySelector("#example_2_input_from").value = areaBounds.min;
  document.querySelector("#example_2_input_to").value = areaBounds.max;
  const params = new URLSearchParams({ house });
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  updateSEOTags(params);
});

if (window.innerWidth <= 767) {
  const apartment = document.querySelector(".apartments");
  const headerSubMenu = document.querySelector(".header__submenu");
  if (apartment && headerSubMenu) {
    apartment.addEventListener("click", (evt) => {
      evt.preventDefault();

      headerSubMenu.classList.toggle("submenu-active");
    });
  }
}
