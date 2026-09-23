import apartments from "../apartments/data_28_03.js";
import { openModal } from "../modal.js";
let data = JSON.parse(apartments);
const [firstApartment, ...lastApartment] = data;
let apartmentFancyBox = document.querySelector(".apartment__fancybox");
document.querySelector(".apartment__img").src = firstApartment.planImg;
apartmentFancyBox.setAttribute("href", firstApartment.planImg);
let selectedLamela = null;
let selectedFloor = null;
let visibleCards = null;
const popupCurrentHouse = document.querySelector(".popup.popup_type_house");

const updateSEOTags = (params) => {
  const stanoviDo = params.get("stanovi-do");
  const type = params.get("type");
  const kvadratiOd = params.get("kvadrati-od");

  let title = "Prodaja Stanova u Novogradnji Beograd | Evolution Residence";
  let description =
    "Prodaja stanova u novogradnji Beograd – direktno od investitora, bez posrednika.";
  let canonical = window.location.href;

  if (stanoviDo) {
    title = `Stanovi do ${stanoviDo} Kvadrata Beograd | Evolution Residence`;
    description = `Prodaja stanova do ${stanoviDo} kvadrata u Beogradu – novogradnja direktno od investitora. Pogledajte aktuelnu ponudu.`;
  }

  const typeMap = {
    jednosoban: {
      title: "Jednosoban Stan Beograd | Prodaja | Evolution Residence",
      desc: "Jednosoban stan u Beogradu – prodaja u novogradnji direktno od investitora.",
    },
    dvosoban: {
      title: "Dvosoban Stan Beograd | Prodaja | Evolution Residence",
      desc: "Dvosoban stan u Beogradu – novogradnja, centar, direktno od investitora.",
    },
    trosoban: {
      title: "Trosoban Stan Beograd | Prodaja | Evolution Residence",
      desc: "Trosoban stan u Beogradu – prodaja trosobnih stanova u novogradnji.",
    },
    garsonjere: {
      title: "Garsonjere Beograd | Prodaja Garsonjera | Evolution Residence",
      desc: "Garsonjere u Beogradu – novogradnja, centar, povoljne cene. Direktno od investitora.",
    },
  };

  if (type && typeMap[type]) {
    title = typeMap[type].title;
    description = typeMap[type].desc;
  }

  // Применяем
  document.title = title;

  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.name = "description";
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", description);
 
  let canonicalTag = document.querySelector('link[rel="canonical"]');
  if (!canonicalTag) {
    canonicalTag = document.createElement("link");
    canonicalTag.rel = "canonical";
    document.head.appendChild(canonicalTag);
  }
  canonicalTag.href = canonical;
};

const applyURLParams = () => {
  const params = new URLSearchParams(window.location.search);
  const stanoviDo = params.get("stanovi-do");  
  const type = params.get("type");  
  const kvadratiOd = params.get("kvadrati-od"); 

  // Фильтр по метражу (stanovi-do)
  if (stanoviDo) {
    const maxArea = parseInt(stanoviDo);
    const minArea = 30;  
    filterAndRenderApartments(minArea, maxArea);

    
    const range = document.querySelector(".js-range-slider");
    if (range) {
      const sliderInstance = $(range).data("ionRangeSlider");
      if (sliderInstance) sliderInstance.update({ from: minArea, to: maxArea });
    }
 
    const inputTo = document.querySelector("#example_2_input_to");
    if (inputTo) inputTo.value = maxArea;
  }

 
  if (type) {
    const lamelaButtons = document.querySelectorAll(".filter__btn_lamela");
    lamelaButtons.forEach((btn) => {
      if (btn.textContent.trim().toLowerCase() === type.toLowerCase()) {
        btn.click();  
      }
    });
  }

  if (kvadratiOd) {
    const minArea = parseInt(kvadratiOd);
    const maxArea = 126; // твой максимум
    filterAndRenderApartments(minArea, maxArea);

    const range = document.querySelector(".js-range-slider");
    if (range) {
      const sliderInstance = $(range).data("ionRangeSlider");
      if (sliderInstance) sliderInstance.update({ from: minArea, to: maxArea });
    }

    const inputFrom = document.querySelector("#example_2_input_from");
    if (inputFrom) inputFrom.value = minArea;
  }

  updateSEOTags(params);
};

const getFirstApartment = () => {
  document.querySelector(".js-apartment-wing").textContent =
    firstApartment.buldingWing.replace("Lamela", "").trim();
  document.querySelector(".js-apartment-floor").textContent =
    firstApartment.floor;
  document.querySelector(".js-apartment-area").textContent =
    firstApartment.area + "m²";
  document.querySelector(".js-apartment-number").textContent =
    firstApartment.apartmentNumber;
};

const getApartmentFloors = () => {
  const apartmentFloorsLists = document.querySelectorAll(".filter__floor_list");
  const filterApartmentFloorList = document.querySelector(
    ".apartments__filter .filter__floor_list",
  );
  const priorityOrder = ["NP", "VP", "P"];
  const uniqueFloors = [...new Set(data.map((item) => item.floor))].sort(
    (a, b) => {
      const indexA = priorityOrder.indexOf(a);
      const indexB = priorityOrder.indexOf(b);
      return indexA !== -1 && indexB !== -1
        ? indexA - indexB
        : indexA !== -1
          ? -1
          : indexB !== -1
            ? 1
            : a - b;
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

  const filterHouseFloorList = document.querySelectorAll(
    ".floor__list_houses_plans .filter__btn_floor",
  )[0];
  filterHouseFloorList.classList.add("active");
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
			 <div class="apartment__item flex-style-column  ${firstApartment.id === item.id ? "active" : ""}" data-key="${item.id}">
				  <div class="apartment__img-card">
						<img src="${img}?v=3" alt="apartment" />
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
      floorIsAll || apartment.floor.toString() === selectedFloor.toString();
    if (lamelaMatch && floorMatch) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
  visibleCards = getVisibleFlexCards();
  filterAndRenderApartments(30, 126);
  getObjectCount(visibleCards.length);
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
        ).textContent = matchedData.area + "m²";
        document.querySelector(
          ".popup_type_house .js-apartment-number",
        ).textContent = matchedData.apartmentNumber;
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

if (window.innerWidth <= 767) {
  const apartment = document.querySelector(".apartments");
  const headerSubMenu = document.querySelector(".header__submenu");
  apartment.addEventListener("click", (evt) => {
    evt.preventDefault();

    headerSubMenu.classList.toggle("submenu-active");
  });
}

function filterAndRenderApartments(minValue, maxValue) {
  let filteredCount = 0;
  visibleCards.forEach((card) => {
    const cardId = card.getAttribute("data-key");
    const apartment = data.find((item) => item.id.toString() === cardId);

    if (apartment) {
      if (apartment.area >= minValue && apartment.area <= maxValue) {
        card.style.display = "flex";
        filteredCount++;
      } else {
        card.style.display = "none";
      }
    }
  });

  getObjectCount(filteredCount);
}
const initializeRangeSlider = () => {
  const range = document.querySelector(".js-range-slider");
  const inputFrom = document.querySelector("#example_2_input_from");
  const inputTo = document.querySelector("#example_2_input_to");
  const min = 30;
  const max = 126;

  if (!range || !inputFrom || !inputTo) {
    console.error("Ошибка: один из элементов не найден!");
    return;
  }

  $(range).ionRangeSlider({
    skin: "round",
    type: "double",
    min,
    max,
    from: min,
    to: max,
    onStart: (data) => updateRangeSliderInputs(data, inputFrom, inputTo),
    onFinish: (data) => updateRangeSliderInputs(data, inputFrom, inputTo),
  });
};

function updateRangeSliderInputs(data, inputFrom, inputTo) {
  inputFrom.value = data.from;
  inputTo.value = data.to;
  filterAndRenderApartments(data.from, data.to);
}

document.addEventListener("DOMContentLoaded", () => {
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
    });
  });
  function redirectBack() {
    if (document.referrer) {
      window.location.href = "https://evolutionresidence.rs/new-evolution/";
    } else {
      alert("Предыдущий URL недоступен!");
    }
  }
});

window.addEventListener("DOMContentLoaded", () => {
  getFirstApartment();
  getApartmentFloors();
  getApartmentCards(firstApartment);
  getLamela();
  setupLamelaFilter();
  setupFloorFilter(".apartments__filter");
  handleFilteredCards();
  getVisibleFlexCards();
  getObjectCount(visibleCards.length);
  handleFilteredHousePlans("np");
  getVisiblePolygons(data);
  initializeRangeSlider();
  applyURLParams();
});

window.addEventListener("DOMContentLoaded", () => {
  var apartmentCards = document.querySelectorAll(".apartment__item");
  apartmentCards.forEach((item) => {
    item.addEventListener("click", () => {
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
          currentItem.floor;
        document.querySelector(".js-apartment-area").textContent =
          currentItem.area + "m²";
        document.querySelector(".js-apartment-number").textContent =
          currentItem.apartmentNumber;
      }
    });
  });
});
