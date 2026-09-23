const validationConfig = {
	formSelector: ".quarter__form",
	inputSelector: ".input-event",
	submitButtonSelector: ".form__button",
	inactiveButtonClass: "popup__button_disabled",
	inputErrorClass: "popup__input_type_error",
	errorClass: "popup__error_visible",
};

const configPattern = {
	name: /^[a-zA-Z\s]+$/,
	mail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	tel: /[0-9]{3}[0-9]{2}[0-9]{3}[0-9]{2}/,
}


enableValidation(validationConfig);

function showInputError(formElement, inputElement, errorMessage, settings) {
	const errorElement = formElement.querySelector(`.place-${inputElement.name}-error`);
	if (errorElement) {
		inputElement.classList.add(settings.inputErrorClass);
		errorElement.classList.add(settings.errorClass);
		errorElement.textContent = errorMessage;
	}
}

function hideInputError(formElement, inputElement, settings) {
	const errorElement = formElement.querySelector(`.place-${inputElement.name}-error`);
	if (errorElement) {
		inputElement.classList.remove(settings.inputErrorClass);
		errorElement.classList.remove(settings.errorClass);
		errorElement.textContent = '';
	}
}

function checkInputValidity(formElement, inputElement, settings) {
	const inputType = inputElement.getAttribute('type');
	const inputValue = inputElement.value;
	const pattern = configPattern[inputType];
	if (!inputElement.validity.valid || pattern && !pattern.test(inputValue)) {
		const errorMessage = inputElement.dataset.errorMessage || inputElement.validationMessage;
		showInputError(formElement, inputElement, errorMessage, settings);
	} else {
		hideInputError(formElement, inputElement, settings);
	}
}

function toggleButtonState(inputList, buttonElement, settings) {
	const isValid = inputList.every(inputElement => {
		const inputType = inputElement.getAttribute('type');
		const inputValue = inputElement.value;
		const pattern = configPattern[inputType];
		return inputElement.validity.valid && pattern && pattern.test(inputValue)
	});
	buttonElement.disabled = !isValid;
	buttonElement.classList.toggle(settings.inactiveButtonClass, !isValid);
}

function setEventListeners(formElement, settings) {
	const inputList = Array.from(formElement.querySelectorAll(settings.inputSelector));
	const buttonElement = formElement.querySelector(settings.submitButtonSelector);

	toggleButtonState(inputList, buttonElement, settings);

	inputList.forEach(inputElement => {
		inputElement.addEventListener('input', () => {
			checkInputValidity(formElement, inputElement, settings);
			toggleButtonState(inputList, buttonElement, settings);
		});
	});
}

function enableValidation(settings) {
	const formList = Array.from(document.querySelectorAll(settings.formSelector));
	formList.forEach(formElement => {
		formElement.addEventListener('submit', (evt) => {
			evt.preventDefault();
		});
		setEventListeners(formElement, settings);
	});
}

function clearValidation(formElement, settings) {
	const inputList = Array.from(formElement.querySelectorAll(settings.inputSelector));
	const buttonElement = formElement.querySelector(settings.submitButtonSelector);

	inputList.forEach(inputElement => {
		hideInputError(formElement, inputElement, settings);
	});

	toggleButtonState(inputList, buttonElement, settings);
}

export { enableValidation, clearValidation };
