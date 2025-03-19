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

const burger = document.querySelector('.header__burger');
const headerMenu = document.querySelector('.header__menu');
var headerBody = document.querySelector('.header__body');

window.addEventListener('resize', () => {
	let windowsArray = ["1520", "1380", "1280", "1220", "1120", "1000"];
	const headerNav = document.querySelector('.header__nav');
	const temporalHeaderNav = headerNav.cloneNode(true);
	if (temporalHeaderNav) {
		const listItems = headerNav.querySelectorAll('li');
		const itemsArray = Array.from(listItems);
		const screenWidth = window.innerWidth;
		let indexToRemove = windowsArray.findIndex(width => screenWidth < parseInt(width));
		while (indexToRemove !== -1 && itemsArray.length > 0) {
			const itemToRemove = itemsArray.pop();
			headerNav.removeChild(itemToRemove);
			temporalHeaderNav.querySelector('ul').appendChild(itemToRemove);
			indexToRemove = windowsArray.findIndex(width => screenWidth < parseInt(width));
		}
	}
})
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

const navElement = document.querySelector('.header__nav');
const headerLogo = document.querySelector('.header__logo');
var clonedHeaderLogo = headerLogo.cloneNode(true);
window.addEventListener('DOMContentLoaded', () => {
	if (window.innerWidth < 1519.99) {
		clonedHeaderLogo = headerLogo.cloneNode(true);
		headerBody.appendChild(clonedHeaderLogo)
		
	} else {
		if (clonedHeaderLogo) {
			clonedHeaderLogo.remove();
			clonedHeaderLogo = null;
		}
	}

});