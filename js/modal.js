let scrollLock = null;
const closingModals = new Map();
const returnFocusTargets = new WeakMap();
const bodyLockProperties = ["overflow", "position", "top", "left", "width"];
let pendingImageOpen = null;
let imageErrorTimer;

function clearImageError() {
	clearTimeout(imageErrorTimer);
	document.querySelector(".modal-image-error")?.remove();
}

function cancelImageOpen() {
	const pending = pendingImageOpen;
	if (!pending) return;
	pendingImageOpen = null;
	pending.controller.abort();
	document.documentElement.classList.remove("modal-image-loading");
	document.removeEventListener("keydown", cancelImageOpenEsc);
	if (pending.trigger) {
		pending.trigger.removeAttribute("data-modal-image-loading");
		if (pending.previousBusy === null) pending.trigger.removeAttribute("aria-busy");
		else pending.trigger.setAttribute("aria-busy", pending.previousBusy);
	}
}

function cancelImageOpenEsc(event) {
	if (event.key === "Escape") cancelImageOpen();
}

function reportImageError() {
	clearImageError();
	const language = document.documentElement.lang;
	const message = document.createElement("div");
	message.className = "modal-image-error";
	message.setAttribute("role", "status");
	message.textContent = language === "en"
		? "Unable to load the image. Select the property again to retry."
		: "Slika nije učitana. Izaberite prostor ponovo da pokušate ponovo.";
	document.body.append(message);
	imageErrorTimer = setTimeout(clearImageError, 8000);
}

function decodeObjectImage(image, signal) {
	return new Promise((resolve, reject) => {
		const source = image.src;
		const finish = (error) => {
			signal.removeEventListener("abort", abort);
			image.removeEventListener("load", loaded);
			image.removeEventListener("error", failed);
			if (error) reject(error);
			else resolve();
		};
		const abort = () => finish(new DOMException("Image opening cancelled", "AbortError"));
		const failed = () => finish(new Error("Object image could not be loaded"));
		const loaded = () => {
			if (signal.aborted) return abort();
			if (!image.complete || !image.naturalWidth || image.src !== source) return failed();
			finish();
		};
		if (signal.aborted) return abort();
		if (!image.getAttribute("src")) return failed();
		signal.addEventListener("abort", abort, { once: true });
		image.loading = "eager";
		image.setAttribute("fetchpriority", "high");
		if (image.decode) image.decode().then(loaded, failed);
		else if (image.complete) loaded();
		else {
			image.addEventListener("load", loaded, { once: true });
			image.addEventListener("error", failed, { once: true });
		}
	});
}

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

export async function openModal(modal) {
	if (!modal) return;
	cancelImageOpen();
	clearImageError();
	const image = modal.matches(".popup_type_house")
		? modal.querySelector(".apartment__img")
		: modal.matches('.popup_type_property[data-has-image="true"]')
			? modal.querySelector(".property-dialog__image") : null;
	if (image) {
		const trigger = document.activeElement?.closest('button, a, [role="button"], [data-unit]');
		const pending = { modal, trigger, previousBusy: trigger?.getAttribute("aria-busy"), controller: new AbortController() };
		pendingImageOpen = pending;
		document.documentElement.classList.add("modal-image-loading");
		trigger?.setAttribute("aria-busy", "true");
		trigger?.setAttribute("data-modal-image-loading", "");
		document.addEventListener("keydown", cancelImageOpenEsc);
		try {
			await decodeObjectImage(image, pending.controller.signal);
		} catch (error) {
			if (pendingImageOpen === pending) {
				cancelImageOpen();
				if (error.name !== "AbortError") reportImageError();
			}
			return false;
		}
		if (pendingImageOpen !== pending) return false;
		cancelImageOpen();
	}
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
	return true;
}

function unlockWhenIdle() {
	if (document.querySelector('.popup_is-opened') || closingModals.size) return;
	document.removeEventListener("keydown", closeModalEsc);
	unlockScroll();
}

export function closeModal(modal) {
	if (pendingImageOpen?.modal === modal) cancelImageOpen();
	if (!modal?.classList.contains("popup_is-opened")) return;
	if (!modal.matches(".popup_type_form_quarter, .popup_type_property")) {
		modal.classList.remove("popup_is-opened");
		unlockWhenIdle();
		modal.dispatchEvent(new Event("modal:close", { bubbles: true }));
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
	modal.dispatchEvent(new Event("modal:close", { bubbles: true }));
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
