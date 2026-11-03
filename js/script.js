import { langArr } from "./languages/languages.js";
import { openModal, closeModal, setModalEventListeners } from "./modal.js";
const siteRootUrl = new URL("../", import.meta.url);
const config = {
  baseUrl: "https://pb17539.profitbase.ru/api/v4/json",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "api-app",
    credentials: {
      pb_api_key: "e670162bcfb0bedfe52c8339e40921ce",
    },
  }),
};

async function request(url, options) {
  return fetch(url, options).then((res) => {
    if (res.ok) {
      return res.json();
    }
    return Promise.reject(`Ошибка: ${res.status}`);
  });
}

async function getAccesToken() {
  return request(`${config.baseUrl}/authentication`, {
    method: "POST",
    headers: config.headers,
    body: config.body,
  })
    .then((data) => {
      if (data) {
        console.log("Access Token:", data);
        return data;
      } else {
        throw new Error("Токен не найден в ответе");
      }
    })
    .catch((error) => {
      console.error("Ошибка запроса:", error);
    });
}

/* getAccesToken(); */

async function getHouses() {
  return request(`${config.baseUrl}/houses`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => console.log("Список домов:", data))
    .catch((error) => console.error("Ошибка:", error));
}
/* async function getHouses(accessToken) {
	const response = await fetch('https://pb17539.profitbase.ru/api/v4/json/house', {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${accessToken}`
		}
	});

	if (response.ok) {
		const data = await response.json();
		console.log(data); // Выводим данные о домах
	} else {
		throw new Error('Ошибка получения домов');
	}
}
 */
// Пример использования

const burger = document.querySelector(".header__burger");
const headerMenu = document.querySelector(".header__menu");
const headerBlock = document.querySelector(".header-block");
const popups = document.querySelectorAll(".popup");
const updateCheckWidth = () => {
  return window.innerWidth <= 1500 && window.innerWidth >= 768;
};

const closeHeaderMenu = () => {
  headerMenu.classList.remove("active");
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-label", "Open menu");
  document.body.classList.remove("header-menu-open");
};

burger.addEventListener("click", () => {
  const isOpen = !headerMenu.classList.contains("active");
  headerMenu.classList.toggle("active", isOpen);
  burger.setAttribute("aria-expanded", String(isOpen));
  burger.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  document.body.classList.toggle("header-menu-open", isOpen);
});

headerMenu.querySelectorAll(".menu__item_link, .house-menu__list a").forEach((link) => {
  link.addEventListener("click", closeHeaderMenu);
});
document.querySelector(".header-block .js-scroll-form")?.addEventListener("click", closeHeaderMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && headerMenu.classList.contains("active")) {
    closeHeaderMenu();
    burger.focus();
  }
});
document.addEventListener("click", (event) => {
  if (headerMenu.classList.contains("active") &&
      !headerMenu.contains(event.target) &&
      !headerBlock.contains(event.target)) {
    closeHeaderMenu();
  }
});
window.matchMedia("(min-width: 1501px)").addEventListener("change", closeHeaderMenu);

const getHeaderSubMenu = () => {
  if (window.innerWidth <= 1000) {
    const baseHeightItem = 24;
    document.querySelectorAll(".header__menu .open_submenu").forEach((link) => {
      link.addEventListener("click", function () {
        const menuItem = link.closest(".menu__item");
        const subMenu = menuItem.querySelector(".header__submenu");
        const arrow = link.querySelector("img");

        const isActive = subMenu.classList.contains("submenu-active");
        const submenuHeight = subMenu.scrollHeight;
        const baseHeight = menuItem.offsetHeight;
        document.querySelectorAll(".header__submenu").forEach((el) => {
          el.classList.remove("submenu-active");
          menuItem.querySelector(".menu__item_link").classList.remove("active");
          el.closest(".menu__item").classList.remove("active");
          el.closest(".menu__item").style.height = `${baseHeightItem}px`;
          const img = el
            .closest(".menu__item")
            .querySelector(".open_submenu img");
          if (img) img.style.transform = "rotate(0deg)";
        });

        if (!isActive) {
          subMenu.classList.add("submenu-active");
          menuItem.querySelector(".menu__item_link").classList.add("active");

          menuItem.style.height = `${baseHeight + submenuHeight + 17}px`;

          arrow.style.transform = "rotate(180deg)";
        }
      });
    });
  }
};


// Инициализация при загрузке

// Обработка при изменении размера окна

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector("header");
  const whiteBackgroundBlocks = document.querySelectorAll(".white-bg-block");
  const observerHeader = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Если блок с белым фоном пересекается
          header.style.backgroundColor = "#161D2D";
        } else {
          header.style.backgroundColor = "";
        }
      });
    },
    {
      threshold: 0.01,
    },
  );
  whiteBackgroundBlocks.forEach((block) => observerHeader.observe(block));
});

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".header__nav .menu__item");
  const sections = document.querySelectorAll("section");

  if (!sections.length || !navLinks.length) {
    console.error("Секции или ссылки не найдены!");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const link = document.querySelector(`a[href="#${entry.target.id}"]`);

        if (link) {
          if (entry.isIntersecting) {
            link.classList.add("active-link");
          } else {
            link.classList.remove("active-link");
          }
        }
      });
    },
    {
      threshold: 0.5,
    },
  );

  sections.forEach((section) => observer.observe(section));

  document.querySelectorAll(".menu__item_link").forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();

      const targetId = this.dataset.target;
      if (!targetId) return;

      const currentPath = window.location.pathname;

      if (currentPath === siteRootUrl.pathname || currentPath === `${siteRootUrl.pathname}index.html`) {
        const targetElement = document.getElementById(targetId);

        if (targetElement) {
          lenis.scrollTo(targetElement, {
            offset: -100,
            immediate: false,
          });
        }
      } else {
        const existingParams = new URLSearchParams(window.location.search);
        existingParams.set("section", targetId);
        window.location.href = `${siteRootUrl.href}?${existingParams.toString()}`;
      }
    });
  });

  const logo = document.querySelector(".header__logo");
  if (logo) {
    logo.addEventListener("click", function (event) {
      if (window.location.pathname.includes("search-by-parameters")) {
        // Со страницы фильтров — сохраняем параметры при переходе на главную
        event.preventDefault();
        const existingParams = new URLSearchParams(window.location.search);
        window.location.href = existingParams.toString()
          ? `${siteRootUrl.href}?${existingParams.toString()}`
          : siteRootUrl.href;
      } else {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        document
          .querySelectorAll(".menu__item_link")
          .forEach((link) => link.classList.remove("active-link"));
      }
    });
  }

  handleButtonScroll();
});
function handleButtonScroll() {
  const buttonScrollForm = document.querySelector(".js-scroll-form");
  if (buttonScrollForm) {
    buttonScrollForm.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href").substring(1); // Получаем ID цели
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const offset = -100; // Сдвиг на -100px
        const targetPosition =
          targetElement.getBoundingClientRect().top + window.scrollY + offset;
        headerMenu.classList.remove("active");
        window.scrollTo({
          top: targetPosition,
          behavior: "smooth",
        });
        document
          .querySelectorAll(".menu__item_link")
          .forEach((link) => link.classList.remove("active-link"));
      }
    });
  }
}
let startX;
let isScrolling = false;

const getScrollablePanels = () => {
  const checkWidth = updateCheckWidth();
  if (checkWidth) {
    const scrollable = document.querySelector("#panels-container");
    if (!scrollable) {
      return;
    }
    scrollable.addEventListener("touchstart", (event) => {
      startX = event.touches[0].clientX;
    });

    scrollable.addEventListener(
      "touchmove",
      (event) => {
        event.preventDefault();
        const touchX = event.touches[0].clientX;
        const deltaX = startX - touchX;

        if (!isScrolling) {
          isScrolling = true;
          requestAnimationFrame(() => {
            scrollable.scrollBy({
              left: deltaX,
              behavior: "smooth",
            });
            isScrolling = false;
          });
        }

        startX = touchX;
      },
      { passive: false },
    );
  }
};
if (window.innerWidth <= 768) {
  document.querySelectorAll(".card-text-content").forEach((card) => {
    card.addEventListener("click", function (event) {
      const wrapper = document.querySelector(".wrapper");
      event.preventDefault();
      let existingClone = document.querySelector(".clone-container");
      let existingOverlay = document.querySelector(".clone-container-overlay");

      if (existingClone) existingClone.remove();
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement("div");
      overlay.classList.add("clone-container-overlay");
      document.body.appendChild(overlay);

      // Создаём клон
      const cloneContainer = document.createElement("div");
      cloneContainer.classList.add("clone-container");
      cloneContainer.classList.add("flex-style-column");
      cloneContainer.innerHTML = `
				  ${this.innerHTML}
			 `;
      wrapper.appendChild(cloneContainer);

      // Запускаем анимацию (выезжание)
      setTimeout(() => {
        cloneContainer.classList.add("active");
        overlay.classList.add("active");
      }, 100);

      // Логика закрытия клона
      const closeButton = cloneContainer.querySelector(
        ".clone-container .text-card__block",
      );
      closeButton.addEventListener("click", () => {
        cloneContainer.classList.remove("active");
        overlay.classList.remove("active");
        setTimeout(() => {
          cloneContainer.remove();
          overlay.remove();
        }, 400);
      });
    });
  });
}

const priceRequestDialog = document.getElementById("priceRequest");
const openDialogButtons = document.querySelectorAll(
  ".button__price-request.open-dialog",
);
const popupFormQuarter = document.querySelector(
  ".popup.popup_type_form_quarter",
);
openDialogButtons.forEach((openDialogButton) => {
  openDialogButton.addEventListener("click", () => {
    openModal(popupFormQuarter);
  });
});

/* 
<div class="cssload-container">
	<div class="cssload-ex"></div>
	<div class="cssload-ex"></div>
	<div class="cssload-ex"></div>
	<div class="cssload-ex"></div>
</div> */
$('[data-fancybox="apartment"]').fancybox({
  buttons: [
    "download",
    "slideShow",
    "print",
    "thumbs",
    "zoom",
    "fullScreen",
    "share",
    "close",
  ],
  loop: false,
  protect: true,
  afterClose: function (instance, slide) {
    $(slide.$content).css("display", "block"); // Снимаем `display: none`
  },
});

$('[data-fancybox="gallery"]').fancybox({
  buttons: ["thumbs", "zoom", "fullScreen", "share", "close"],
  loop: false,
  slideShow: false,
  protect: true,
});
$(document).ready(function () {
  $.fancybox.defaults.btnTpl.print =
    '<button data-fancybox-print class="fancybox-button fancybox-button--print" title="Print">' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 159 159"><path d="m10.5,105h22.9v13.5c0,2.3 1.8,4.1 4.1,4.1h54c2.3,0 4.1-1.8 4.1-4.1v-13.5h22.9c2.3,0 4.1-1.8 4.1-4.1v-72.8c0-2.3-1.8-4.1-4.1-4.1h-22.9v-13.5c0-2.3-1.8-4.1-4.1-4.1h-54c-2.3,0-4.1,1.8-4.1,4.1v13.5h-22.9c-2.3,0-4.1,1.8-4.1,4.1v72.8c0,2.2 1.9,4.1 4.1,4.1zm76.9,9.4h-45.8v-33.8h45.8v33.8zm-45.8-99.8h45.8v9.4h-45.8v-9.4zm-27,17.6h22.9 54 22.9v64.6h-18.8v-16.2h7.3c2.3,0 4.1-1.8 4.1-4.1s-1.8-4.1-4.1-4.1h-11.4-54-11.3c-2.3,0-4.1,1.8-4.1,4.1s1.8,4.1 4.1,4.1h7.3v16.2h-18.9v-64.6z"/<path d="m86.2,53.3h10.6c2.3,0 4.1-1.8 4.1-4.1s-1.8-4.1-4.1-4.1h-10.6c-2.3,0-4.1,1.8-4.1,4.1s1.8,4.1 4.1,4.1z"/></svg>' +
    "</button>";

  $("body").on("click", "[data-fancybox-print]", function () {
    // Получаем текущее изображение с классом fancybox-image
    const $img = $.fancybox
      .getInstance()
      .current.$content.find(".fancybox-image");

    if ($img.length > 0) {
      // Создаем iframe
      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";

      // Добавляем iframe на страницу
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentWindow || iframe.contentDocument;
      const doc = iframeDoc.document || iframeDoc;

      // Генерируем HTML для iframe
      doc.open();
      doc.write(`
					  <html>
							<head>
								 <title>Print Image</title>
								 <style>
									  body {
											margin: 0;
											display: flex;
											justify-content: center;
											align-items: center;
											height: 693px;
									  }
									  img {
											width: auto;
											height: 693px;
									  }
								 </style>
							</head>
							<body>
								 <img src="${$img.attr("src")}" alt="Printable Image">
							</body>
					  </html>
				 `);
      doc.close();

      // Ожидаем загрузки содержимого и запускаем печать
      iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        document.body.removeChild(iframe); // Удаляем iframe после печати
      };
    } else {
      console.error("Изображение с классом 'fancybox-image' не найдено.");
    }
  });
});

$("input").change(function () {
  if ($(this).val().length > 0) {
    $(this).next().css("display", "none");
  } else {
    $(this).next().removeAttr("style");
  }
});

function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
  const matches = document.cookie.match(
    new RegExp(
      "(?:^|; )" +
        name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, "\\$1") +
        "=([^;]*)",
    ),
  );
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

function setLanguage(lang) {
  setCookie("language", lang, 7);
  updateLanguage(lang);
}

function updateLanguage(lang) {
  const switcher = document.querySelector("#language-switcher");
  if (switcher) switcher.dataset.active = lang;
  document.querySelectorAll(".lang__item").forEach((item) => {
    const isActive = item.dataset.lang === lang;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", String(isActive));
  });
  for (let key in langArr[lang]) {
    const elements = document.querySelectorAll(`[data-key="${key}"]`);
    elements.forEach((element) => {
      if (element) {
        element.textContent = langArr[lang][key];
      }
    });
  }
}

export function splitText() {
  const splitTexts = document.querySelectorAll(".split-text");
  splitTexts.forEach((textElement) => {
    const animtextLine = Splitting({ target: ".split-text", by: "lines" });
    animtextLine.forEach((splitResult) => {
      const wrappedLines = splitResult.lines
        .map((wordsArr, i) => {
          const wordsHTML = wordsArr
            .map((word) => {
              if (
                document.querySelector(".main-title") &&
                word.style.getPropertyValue("--word-index") === "1"
              ) {
                return `${word.outerHTML.replace('<span class="word"', '<span class="word title-span"')}<span class="whitespace"></span>`;
              }
              return `${word.outerHTML}<span class="whitespace"></span>`;
            })
            .join("");
          return `<div class="line" style="--line-index: ${i};">${wordsHTML}</div>`;
        })
        .join("");
      splitResult.el.innerHTML = wrappedLines;
    });
    ScrollTrigger.create({
      trigger: textElement,
      start: "120% 120%",
      onEnter: () => {
        const mainTitle = document.querySelector(".main-title");
        if (mainTitle) {
          document.querySelector(".main-title").style.display = "flex";
        }
        const aboutButton = document.querySelector(".about-button");
        if (aboutButton) {
          aboutButton.style.display = "flex";
        }
        textElement.classList.add("line-up");
      },
      onLeaveBack: () => {
        textElement.classList.remove("line-up");
      },
    });
  });
}

document
  .querySelector("#language-switcher")
  .addEventListener("click", (event) => {
    const lang = event.target.dataset.lang;
    if (lang) {
      setLanguage(lang);
    }
  });

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = getCookie("language") || "srb";
  updateLanguage(savedLang);
});

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const scrollTo = params.get("section");

  if (scrollTo) {
    setTimeout(() => {
      const targetElement = document.getElementById(scrollTo);
      if (targetElement) {
        lenis.scrollTo(targetElement, {
          offset: -100,
          immediate: false,
        });
      }
    }, 500);

    window.history.replaceState({}, "", `/?section=${scrollTo}`);
    const url = new URL(window.location);
    url.searchParams.delete("section");
    history.replaceState(null, "", url);
  }
});

function setDynamicHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

const blockChoiceButtons = document.querySelector(".buttons__choice_view");
const apartmentsChoiceButtons = document.querySelectorAll(".button__choice");
apartmentsChoiceButtons.forEach((choiceButton) => {
  choiceButton.addEventListener("click", (evt) => {
    const activeChoiceButton =
      blockChoiceButtons.querySelector(".choice-active");
    activeChoiceButton.classList.remove("choice-active");
    evt.target.classList.add("choice-active");
  });
});

const closeButtons = document.querySelectorAll(".popup__close");
closeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const popup = button.closest(".popup");
    closeModal(popup);
  });
});

window.addEventListener("resize", () => {
  setDynamicHeight();
  getScrollablePanels();
  getHeaderSubMenu();
});
document.addEventListener("DOMContentLoaded", () => {
  getHeaderSubMenu();
});
window.addEventListener("DOMContentLoaded", () => {
  getScrollablePanels();

  popups.forEach((popup) => setModalEventListeners(popup));
});
