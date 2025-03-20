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
let windowsArray = ["1520", "1380", "1280", "1220", "1120", "1000"];
const burger = document.querySelector('.header__burger');
var headerMenu = document.querySelector('.header__menu');
var headerBody = document.querySelector('.header__body');
let headerNav = document.querySelector('.header__nav');
let headerNavList = document.querySelector('.header__nav ul');
let temporalHeaderNav = headerNav.cloneNode(true);
temporalHeaderNav.classList.add('nav-clone')
let checkWidth = window.innerWidth <= 1520 && window.innerWidth >= 768;
const listItems = temporalHeaderNav.querySelectorAll('li');
let headerLogo = document.querySelector('.header__logo');
const getHeaderClone = () => {
	if (checkWidth) {
		if (!headerMenu.querySelector('.nav-clone')) {
			headerMenu.removeChild(headerNav);
			listItems.forEach(item => {
				item.remove();
			});
			headerBody.insertAdjacentElement("afterbegin", headerNav);
			headerMenu.insertAdjacentElement("afterbegin", temporalHeaderNav);
		}
	}
}
const handleHeaderLinks = () => {
	if (checkWidth && temporalHeaderNav) {
		let listItems = headerNav.querySelectorAll('li');
		let screenWidth = window.innerWidth;
		let itemsArray = Array.from(listItems);
		console.log(itemsArray.length)
		windowsArray.map(width => {
			if (screenWidth < parseInt(width) && itemsArray.length > 0) {
				let itemToRemove = itemsArray.pop();
				windowsArray.shift();
				if (headerNavList.contains(itemToRemove)) {
					headerNavList.removeChild(itemToRemove);
				} else {
					headerNavList.appendChild(itemToRemove);
				}
				temporalHeaderNav.querySelector('ul').appendChild(itemToRemove);
			}
		});
	}
}

burger.addEventListener('click', () => {
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
const getHeaderLogo = () => {
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

window.addEventListener('DOMContentLoaded', () => {
	handleHeaderLinks();
	getHeaderLogo();
	getHeaderClone();
});

window.addEventListener('resize', () => {
	getHeaderLogo();
	handleHeaderLinks();
	getHeaderClone();
});