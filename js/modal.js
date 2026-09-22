export function openModal(modal) {
	modal.classList.add("popup_is-opened");
	document.addEventListener("keydown", closeModalEsc);
	$("body").css({ "overflow": "hidden", "position": "fixed", "width": "100%" });
}

export function closeModal(modal) {
	modal.classList.remove("popup_is-opened");
	document.removeEventListener("keydown", closeModalEsc);
	if (document.querySelector('.popup_is-opened')) {
		$("body").css({ "overflow": "hidden", "position": "fixed", "width": "100%" });
	} else {
		document.body.style.removeProperty("overflow");
		document.body.style.removeProperty("position");
		document.body.style.removeProperty("width");

	}
}

function closeModalEsc(evt) {
	if (evt.key === "Escape") {
		const openedModal = document.querySelector(".popup_is-opened");
		closeModal(openedModal);
	}
}

export function setModalEventListeners(modal) {
	modal.addEventListener("click", (evt) => {
		if (evt.target.classList.contains("popup_is-opened")) {
			closeModal(modal);
		}
	});
}
