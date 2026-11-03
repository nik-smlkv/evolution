let scrollLock = null;
const bodyLockProperties = ["overflow", "position", "top", "left", "width"];

function lockScroll() {
	if (scrollLock) return;
	const body = document.body;
	const root = document.documentElement;
	scrollLock = {
		x: window.scrollX,
		y: window.scrollY,
		rootOverflow: root.style.overflow,
		bodyStyles: Object.fromEntries(bodyLockProperties.map((property) => [property, body.style[property]])),
	};
	root.style.overflow = "hidden";
	Object.assign(body.style, {
		overflow: "hidden",
		position: "fixed",
		top: `${-scrollLock.y}px`,
		left: `${-scrollLock.x}px`,
		width: "100%",
	});
}

function unlockScroll() {
	if (!scrollLock) return;
	const { x, y, rootOverflow, bodyStyles } = scrollLock;
	Object.assign(document.body.style, bodyStyles);
	document.documentElement.style.overflow = rootOverflow;
	scrollLock = null;
	window.scrollTo(x, y);
	requestAnimationFrame(() => {
		if (!scrollLock) window.scrollTo(x, y);
	});
}

export function openModal(modal) {
	if (!modal) return;
	lockScroll();
	modal.classList.add("popup_is-opened");
	document.addEventListener("keydown", closeModalEsc);
}

export function closeModal(modal) {
	if (!modal) return;
	modal.classList.remove("popup_is-opened");
	if (!document.querySelector('.popup_is-opened')) {
		document.removeEventListener("keydown", closeModalEsc);
		unlockScroll();
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
