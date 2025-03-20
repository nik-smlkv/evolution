/* 

$.ajax({
	url: 'https://e670162bcfb0bedfe52c8339e40921ce.profitbase.ru/api/v4/json/authentication',
	type: 'GET',
	dataType: 'json',
	success: function (response) {
		console.log('Данные получены:', response);
	},
	error: function (jqXHR, textStatus, errorThrown) {
		console.error('Ошибка запроса:', textStatus, errorThrown);
	}
}); *//* 
async function authenticate(apiKey) {
	const response = await fetch('https://pb17539.profitbase.ru/api/v4/json/authentication', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			type: "api-app",
			credentials: {
				pb_api_key: apiKey
			}
		})
	});

	if (response.ok) {
		const data = await response.json();
		return data.access_token; // Возвращаем access_token
	} else {
		throw new Error('Ошибка авторизации');
	}
}

async function getHouses(accessToken) {
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

// Пример использования
(async () => {
	const apiKey = 'e670162bcfb0bedfe52c8339e40921ce'; // Укажите ваш API ключ
	try {
		const token = await authenticate(apiKey);
		await getHouses(token);
	} catch (error) {
		console.error(error);
	}
})(); */
/* 
async function authenticate(apiKey) {
	const response = await fetch('https://pb17539.profitbase.ru/api/v4/json/authentication', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			type: "api-app",
			credentials: {
				pb_api_key: apiKey
			}
		})
	});

	if (response.ok) {
		const data = await response.json();
		console.log('Access Token:', data.access_token);
	} else {
		const errorData = await response.json();
		console.error('Ошибка авторизации:', errorData.error);
	}
}
const apiKey = 'e670162bcfb0bedfe52c8339e40921ce';
authenticate(apiKey); */
let windowsArray = ["1520", "1470", "1280", "1220", "1120", "1000"];
let originalWindowsArray = [...windowsArray]; // Оригинальная копия массива
const burger = document.querySelector('.header__burger');
const headerMenu = document.querySelector('.header__menu');
const headerBody = document.querySelector('.header__body');
let headerNav = document.querySelector('.header__nav');
let headerNavList = document.querySelector('.header__nav ul');
let temporalHeaderNav = headerNav.cloneNode(true);
temporalHeaderNav.classList.add('nav-clone');
let headerLogo = document.querySelector('.header__logo');
let clonedHeaderBlock = null;

const updateCheckWidth = () => {
	return window.innerWidth <= 1520 && window.innerWidth >= 768;
};

// Переключение меню при клике на бургер
burger.addEventListener('click', (event) => {
	event.stopPropagation(); // Предотвращаем всплытие
	headerMenu.classList.toggle('active');

	if (headerMenu.classList.contains('active')) {
		const headerBlock = document.querySelector('.header-block');
		clonedHeaderBlock = headerBlock.cloneNode(true);

		const childToRemove = clonedHeaderBlock.querySelector('.header__burger');
		if (childToRemove) {
			clonedHeaderBlock.removeChild(childToRemove);
		}

		headerMenu.appendChild(clonedHeaderBlock);
	} else {
		if (clonedHeaderBlock) {
			clonedHeaderBlock.remove();
			clonedHeaderBlock = null;
		}
	}
});

// Закрытие меню при клике вне его области
document.addEventListener('click', (event) => {
	const target = event.target;
	if (!headerMenu.contains(target) && !burger.contains(target)) {
		headerMenu.classList.remove('active');
		if (clonedHeaderBlock) {
			clonedHeaderBlock.remove();
			clonedHeaderBlock = null;
		}
	}
});

// Обновление клона меню
const getHeaderClone = () => {
	const checkWidth = updateCheckWidth();
	if (checkWidth) {
		if (!headerMenu.querySelector('.nav-clone')) {
			temporalHeaderNav.querySelectorAll('li').forEach(item => item.remove());
			headerBody.insertAdjacentElement("afterbegin", headerNav);
			headerMenu.insertAdjacentElement("afterbegin", temporalHeaderNav);
		}
	} else {
		const existingClone = headerMenu.querySelector('.nav-clone');
		if (existingClone) existingClone.remove();
	}
};
let itemToRemoveArray = [];
let isResized = false;
// Обработка адаптивности ссылок
const handleHeaderLinks = () => {
	const checkWidth = updateCheckWidth();
	if (checkWidth && temporalHeaderNav) {
		let listItems = Array.from(headerNav.querySelectorAll('li'));
		let screenWidth = window.innerWidth;
		windowsArray.map(width => {
			windowsArray = windowsArray.filter(width => screenWidth >= parseInt(width));
			if (screenWidth < parseInt(width) && listItems.length > 0) {
				let itemToRemove = listItems.pop();
				if (headerNavList.contains(itemToRemove)) {
					headerNavList.removeChild(itemToRemove);
				}
				temporalHeaderNav.querySelector('ul').appendChild(itemToRemove);
				itemToRemoveArray.push(itemToRemove);
			}
		});
		isResized = true;
	} else if (isResized) {
		headerMenu.insertAdjacentElement("afterend", headerNav);
		temporalHeaderNav.querySelectorAll('li').forEach(item => {
			headerNavList.appendChild(item);
		});
		itemToRemoveArray.forEach(item => {
			headerNavList.appendChild(item);
		});
		windowsArray = originalWindowsArray;
	}
};
// Обновление логотипа
const getHeaderLogo = () => {
	const checkWidth = updateCheckWidth();
	const existingLogo = headerBody.querySelector('.header__logo.clone');

	if (checkWidth) {
		if (!existingLogo) {
			const clonedHeaderLogo = headerLogo.cloneNode(true);
			clonedHeaderLogo.classList.add('clone');
			headerBody.appendChild(clonedHeaderLogo);
		}
	} else {
		if (existingLogo) {
			existingLogo.remove();
		}
	}
};

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', () => {
	getHeaderClone();
	getHeaderLogo();
	getScrollablePanels();
	handleHeaderLinks();
});

// Обработка при изменении размера окна
window.addEventListener('resize', () => {
	getHeaderClone();
	handleHeaderLinks();
	getHeaderLogo();
	getScrollablePanels();
});

document.addEventListener("DOMContentLoaded", () => {
	const header = document.querySelector("header");
	const whiteBackgroundBlocks = document.querySelectorAll(".white-bg-block");
	const observerHeader = new IntersectionObserver((entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				// Если блок с белым фоном пересекается
				header.style.backgroundColor = "#161D2D";
			} else {
				header.style.backgroundColor = "";
			}
		});
	}, {
		threshold: 0.01
	});
	whiteBackgroundBlocks.forEach((block) => observerHeader.observe(block));


});
document.addEventListener("DOMContentLoaded", () => {
	if (window.innerWidth > 768) {
		const navLinks = document.querySelectorAll(".header__nav li a");
		const sections = document.querySelectorAll("section");

		// Проверка: секции и ссылки существуют
		if (!sections.length || !navLinks.length) {
			console.error("Секции или ссылки не найдены!");
			return;
		}

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const link = document.querySelector(`a[href="#${entry.target.id}"]`);

				// Проверка: ссылка существует
				if (link) {
					if (entry.isIntersecting) {
						link.classList.add("active-link");
					} else {
						link.classList.remove("active-link");
					}
				}
			});
		}, {
			threshold: 0.5 // Срабатывание при пересечении 50% секции
		});

		sections.forEach((section) => observer.observe(section));
	}
});

let startX;
let isScrolling = false;

const getScrollablePanels = () => {
	const checkWidth = updateCheckWidth();
	if (checkWidth) {
		const scrollable = document.querySelector('#panels-container');
		if (!scrollable) {
			console.error('Элемент #panels-container не найден!');
			return;
		}

		scrollable.addEventListener('touchstart', (event) => {
			startX = event.touches[0].clientX;
		});

		scrollable.addEventListener('touchmove', (event) => {
			event.preventDefault();
			const touchX = event.touches[0].clientX;
			const deltaX = startX - touchX;

			if (!isScrolling) {
				isScrolling = true;
				requestAnimationFrame(() => {
					scrollable.scrollBy({
						left: deltaX,
						behavior: 'smooth'
					});
					isScrolling = false;
				});
			}

			startX = touchX;
		}, { passive: false });
	}
};