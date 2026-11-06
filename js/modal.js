let scrollLock = null;
const closingModals = new Map();
const returnFocusTargets = new WeakMap();
const bodyLockProperties = ["overflow", "position", "top", "left", "width"];

function lockScroll(modal) {
	if (scrollLock) return;
	const body = document.body;
	const root = document.documentElement;
	const fullViewport = modal.matches(".popup_type_house, .popup_type_form_quarter, .popup_type_property");
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
	closingModals.get(modal)?.();
	closingModals.delete(modal);
	modal.classList.remove("popup_is-closing");
	if (modal.matches(".popup_type_form_quarter, .popup_type_property") && !modal.contains(document.activeElement)) {
		returnFocusTargets.set(modal, document.activeElement);
	}
	lockScroll(modal);
	modal.classList.add("popup_is-opened");
	if (modal.matches(".popup_type_form_quarter, .popup_type_property")) modal.focus({ preventScroll: true });
	document.addEventListener("keydown", closeModalEsc);
}

function unlockWhenIdle() {
	if (document.querySelector('.popup_is-opened') || closingModals.size) return;
	document.removeEventListener("keydown", closeModalEsc);
	unlockScroll();
}

export function closeModal(modal) {
	if (!modal?.classList.contains("popup_is-opened")) return;
	if (!modal.matches(".popup_type_form_quarter, .popup_type_property")) {
		modal.classList.remove("popup_is-opened");
		unlockWhenIdle();
		return;
	}

	modal.classList.add("popup_is-closing");
	modal.classList.remove("popup_is-opened");
	modal.focus({ preventScroll: true });
	const panel = modal.querySelector('.popup__content');
	let timeout;
	const cancel = () => {
		clearTimeout(timeout);
		panel.removeEventListener('transitionend', onTransitionEnd);
	};
	const finish = () => {
		if (closingModals.get(modal) !== cancel) return;
		cancel();
		closingModals.delete(modal);
		const restoreFocus = modal.contains(document.activeElement) || document.activeElement === document.body;
		modal.classList.remove("popup_is-closing");
		const trigger = returnFocusTargets.get(modal);
		if (trigger?.isConnected && restoreFocus) trigger.focus({ preventScroll: true });
		returnFocusTargets.delete(modal);
		unlockWhenIdle();
	};
	const onTransitionEnd = (event) => {
		if (event.target === panel && event.propertyName === 'transform') finish();
	};
	closingModals.set(modal, cancel);
	panel.addEventListener('transitionend', onTransitionEnd);
	const duration = Math.max(...getComputedStyle(panel).transitionDuration.split(',').map((value) => parseFloat(value) * (value.trim().endsWith('ms') ? 1 : 1000)));
	timeout = setTimeout(finish, duration + 80);
}

function closeModalEsc(evt) {
	if (evt.key === "Tab") {
		if (closingModals.size) { evt.preventDefault(); return; }
		const form = document.querySelector('.popup_type_form_quarter.popup_is-opened') || document.querySelector('.popup_type_property.popup_is-opened');
		if (!form) return;
		const controls = Array.from(form.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')).filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
		const first = controls[0];
		const last = controls[controls.length - 1];
		if (evt.shiftKey && (document.activeElement === first || document.activeElement === form)) {
			evt.preventDefault();
			last?.focus({ preventScroll: true });
		} else if (!evt.shiftKey && document.activeElement === last) {
			evt.preventDefault();
			first?.focus({ preventScroll: true });
		}
		return;
	}
	if (evt.key === "Escape") {
		if (closingModals.size) return;
		const openedModal = document.querySelector(".popup_type_form_quarter.popup_is-opened") || document.querySelector(".popup_type_property.popup_is-opened") || document.querySelector(".popup_is-opened");
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
