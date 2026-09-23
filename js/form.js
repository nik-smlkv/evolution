const formFeedback = document.forms["form-feedback"];
const formFlatFeedback = document.forms["form-feedback-flat"];

formFeedback.addEventListener("submit", (evt) => {
	const inputPlaceholders = formFeedback.querySelectorAll('.input-placeholder');
	evt.preventDefault();
	const submitButton = evt.submitter;
	console.log(formFeedback.elements["phone"].value.trim());
	const formData = {
		fields: {
			TITLE: "Complete CRM form 'Prijava za konsultacije sa sajta (evolutionresidence.rs)'",
			NAME: formFeedback.elements["name"].value.trim(),
			PHONE: [
				{ VALUE: formFeedback.elements["phone"].value.trim(), VALUE_TYPE: "WORK" }
			],
			EMAIL: [
				{ VALUE: formFeedback.elements["mail"].value.trim(), VALUE_TYPE: "WORK" }
			],
		},
		params: { REGISTER_SONET_EVENT: "Y" }
	};

	submitButton.disabled = true;
	const originalText = submitButton.textContent;
	submitButton.textContent = "Send...";

	sendDataToBitrix("https://crm.bktesla.rs/rest/1/gt107jhf1wp8901m/crm.lead.add.json", formData)
		.then(() => {
			submitButton.textContent = "Successfully!";
			setTimeout(() => submitButton.textContent = originalText, 3000);
			inputPlaceholders.forEach((inputPlaceholder) => {
				inputPlaceholder.removeAttribute("style");
			})
			formFeedback.reset();
		})
		.catch(() => {
			submitButton.textContent = "Ошибка!";
			submitButton.disabled = false;
		});
});
formFlatFeedback.addEventListener("submit", (evt) => {
	const inputPlaceholders = formFeedback.querySelectorAll('.input-placeholder');
	const houseInformation = document.querySelector('.popup_type_house.popup_is-opened') || document.querySelector('.apartments__info-block');
	const apartmentArea = houseInformation.querySelector('.js-apartment-area').textContent;
	const apartmentWing = houseInformation.querySelector('.js-apartment-wing').textContent;
	const apartmentFloor = houseInformation.querySelector('.js-apartment-floor').textContent;
	const apartmentNumber = houseInformation.querySelector('.js-apartment-number').textContent;
	const apartmentImg = houseInformation.querySelector('.apartment__img').src;
	evt.preventDefault();
	const submitButton = evt.submitter;
	console.log(formFeedback.elements["phone"].value.trim());
	const formData = {
		fields: {
			TITLE: "Complete CRM form 'Prijava za konsultacije sa sajta (evolutionresidence.rs)'",
			NAME: formFlatFeedback.elements["name"].value.trim(),
			PHONE: [
				{ VALUE: formFlatFeedback.elements["phone"].value.trim(), VALUE_TYPE: "WORK" }
			],
			EMAIL: [
				{ VALUE: formFlatFeedback.elements["mail"].value.trim(), VALUE_TYPE: "WORK" }
			],
			COMMENTS: `Saznati cenu stana 'Površina:${apartmentArea}, Krilo zgrade:${apartmentWing}, Sprat: ${apartmentFloor}, Broj stana: ${apartmentNumber}. Tlocrt stana na sajtu ${apartmentImg}`
		},
		params: { REGISTER_SONET_EVENT: "Y" }
	};

	submitButton.disabled = true;
	const originalText = submitButton.textContent;
	submitButton.textContent = "Send...";

	sendDataToBitrix("https://crm.bktesla.rs/rest/1/gt107jhf1wp8901m/crm.lead.add.json", formData)
		.then(() => {
			submitButton.textContent = "Successfully!";
			setTimeout(() => submitButton.textContent = originalText, 3000);
			inputPlaceholders.forEach((inputPlaceholder) => {
				inputPlaceholder.removeAttribute("style");
			})
			formFeedback.reset();
		})
		.catch(() => {
			submitButton.textContent = "Ошибка!";
			submitButton.disabled = false;
		});
});



function sendDataToBitrix(webhookUrl, formData) {
	return fetch(webhookUrl, {
		method: "POST",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(formData)
	})
		.then(response => {
			if (!response.ok) throw new Error(`Ошибка HTTP: ${response.status}`);
			return response.json();
		})
		.catch(error => {
			console.error("Ошибка при отправке:", error);
		});
}