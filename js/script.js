import { langArr } from "./languages/languages.js?v=1.0.8";
import { openModal, closeModal, setModalEventListeners } from "./modal.js?v=1.0.5";
import { openPriceRequest } from "./price-request.js?v=1.0.3";
import { initializeHeaderNavigation } from "./header-navigation.js?v=1.0.1";
import { initializeHomeNavigation, isPlainNavigation, normalizeHomeUrl } from "./home-navigation.js?v=1.0.3";
import { getSelectedHouse } from "./house-context.js?v=1.0.1";
import "./input-capabilities.js?v=1.0.0";
const assetsRootUrl = new URL("../", import.meta.url);
const language = document.documentElement.lang === "en" ? "en" : "srb";
const siteRootUrl = new URL(language === "en" ? "en/" : "./", assetsRootUrl);
// Keep relative assets and catalog links rooted here after history changes the path.
const documentBase = document.querySelector("base") || document.createElement("base");
documentBase.href = assetsRootUrl.href;
document.head.prepend(documentBase);
// Remember the selected house before home navigation removes catalog parameters.
getSelectedHouse();
const homeAddress = normalizeHomeUrl(window.location.href, siteRootUrl);
if (homeAddress.href !== window.location.href) {
  history.replaceState(history.state, "", homeAddress.href);
}
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

const closeHeaderMenu = initializeHeaderNavigation();
const popups = document.querySelectorAll(".popup");

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
        const section = entry.target.closest("section");
        const link = document.querySelector(`.menu__item_link[data-target="${section.id}"]`);

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

  sections.forEach((section) => {
    const observed = section.querySelector(".render-gallery__stage") ?? section;
    observer.observe(observed);
  });

  initializeHomeNavigation({
    root: siteRootUrl,
    closeMenu: closeHeaderMenu,
    scrollTo: (target, immediate) => {
      if (target.id === "features") {
        target.querySelector(".features-viewport")?.scrollTo({ left: 0, behavior: "instant" });
      }
      const offset = target === 0 || target.id === "render-gallery" ? 0 : -100;
      const jump = immediate || target.id === "render-gallery";
      if (typeof lenis !== "undefined") {
        if (jump) lenis.resize();
        lenis.scrollTo(target, { offset, immediate: jump });
      } else {
        const top = target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY + offset;
        window.scrollTo({ top, behavior: jump ? "instant" : "smooth" });
      }
    },
  });
});
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

const openDialogButtons = document.querySelectorAll(
  ".button__price-request.open-dialog",
);
openDialogButtons.forEach((openDialogButton) => {
  openDialogButton.addEventListener("click", () => {
    openPriceRequest();
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

function updateLanguage(lang) {
  for (let key in langArr[lang]) {
    const elements = document.querySelectorAll(`[data-key="${key}"]`);
    elements.forEach((element) => {
      if (element) {
        if (key === "p_callback") {
          const [firstLine, ...lastLine] = langArr[lang][key].trim().split(/\s+/);
          const lines = [firstLine, lastLine.join(" ")].map((text) => {
            const line = document.createElement("span");
            line.className = "callback-title__line";
            line.textContent = text;
            return line;
          });
          // Keep the requested phrase groups intact when text animations run.
          element.classList.remove("split-text");
          element.replaceChildren(lines[0], document.createTextNode(" "), lines[1]);
        } else {
          element.textContent = langArr[lang][key];
        }
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

document.querySelectorAll("#language-switcher a[data-lang]").forEach((link) => {
  const localeRoot = new URL(link.dataset.lang === "en" ? "en/" : "./", assetsRootUrl);
  const refreshLink = () => {
    const current = new URL(window.location.href);
    const page = current.pathname.slice(siteRootUrl.pathname.length);
    const localized = new URL(localeRoot);
    localized.pathname += page;
    localized.search = current.search;
    localized.hash = current.hash;
    link.href = localized.href;
  };
  refreshLink();
  link.addEventListener("pointerdown", refreshLink);
  link.addEventListener("focus", refreshLink);
  link.addEventListener("click", (event) => {
    refreshLink();
    if (isPlainNavigation(event, link) && link.dataset.lang === language) event.preventDefault();
  });
});

document.addEventListener("DOMContentLoaded", () => updateLanguage(language));

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
  getHeaderSubMenu();
});
document.addEventListener("DOMContentLoaded", () => {
  getHeaderSubMenu();
});
window.addEventListener("DOMContentLoaded", () => {
  popups.forEach((popup) => setModalEventListeners(popup));
});
