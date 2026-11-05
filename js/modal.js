let scrollLock = null;
const bodyLockProperties = ["overflow", "position", "top", "left", "width"];

function lockScroll(modal) {
	if (scrollLock) return;
	const body = document.body;
	const root = document.documentElement;
	const fullViewport = body.dataset.catalogHouse === "tchaikovsky" && modal.classList.contains("popup_type_house");
	const bodyWidth = body.getBoundingClientRect().width;
	const header = fullViewport ? document.querySelector("header") : null;
	const headerWidth = header?.getBoundingClientRect().width;
	scrollLock = {
		x: window.scrollX,
		y: window.scrollY,
		rootOverflow: root.style.overflow,
		rootScrollbarWidth: root.style.scrollbarWidth,
		rootScrollbarGutter: root.style.scrollbarGutter,
		header,
		headerWidthStyle: header?.style.width,
		bodyStyles: Object.fromEntries(bodyLockProperties.map((property) => [property, body.style[property]])),
	};
	root.style.overflow = "hidden";
	if (fullViewport) {
		root.style.scrollbarWidth = "none";
		root.style.scrollbarGutter = "auto";
		if (header) header.style.width = `${headerWidth}px`;
	}
	Object.assign(body.style, {
		overflow: "hidden",
		position: "fixed",
		top: `${-scrollLock.y}px`,
		left: `${-scrollLock.x}px`,
		width: fullViewport ? `${bodyWidth}px` : "100%",
	});
}

function unlockScroll() {
	if (!scrollLock) return;
	const { x, y, rootOverflow, rootScrollbarWidth, rootScrollbarGutter, header, headerWidthStyle, bodyStyles } = scrollLock;
	Object.assign(document.body.style, bodyStyles);
	document.documentElement.style.overflow = rootOverflow;
	document.documentElement.style.scrollbarWidth = rootScrollbarWidth;
	document.documentElement.style.scrollbarGutter = rootScrollbarGutter;
	if (header) header.style.width = headerWidthStyle;
	scrollLock = null;
	window.scrollTo(x, y);
	requestAnimationFrame(() => {
		if (!scrollLock) window.scrollTo(x, y);
	});
}

export function openModal(modal) {
	if (!modal) return;
	lockScroll(modal);
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
