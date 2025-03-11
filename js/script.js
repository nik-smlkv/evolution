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