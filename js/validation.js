const messages = {
  en: {
    name: "Enter a valid name.",
    phone: "Enter a valid phone number.",
    mail: "Enter a valid email address.",
  },
  sr: {
    name: "Unesite ispravno ime.",
    phone: "Unesite ispravan broj telefona.",
    mail: "Unesite ispravnu e-mail adresu.",
  },
};

const fields = {
  name: {
    error: ".place-name-error",
    valid: (value) => value.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u.test(value),
  },
  phone: {
    error: ".place-phone-error",
    valid: (value) => {
      const digits = value.replace(/\D/g, "").length;
      return value.length <= 32 && /^\+?[\d ().-]+$/.test(value) && digits >= 8 && digits <= 15;
    },
  },
  mail: {
    error: ".place-email-error",
    valid: (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  },
};

export function initializeLeadValidation(form) {
  const language = document.documentElement.lang === "en" ? "en" : "sr";
  const controls = Object.entries(fields).map(([name, config]) => ({
    name,
    input: form.elements.namedItem(name),
    error: form.querySelector(config.error),
    valid: config.valid,
  }));
  const button = form.querySelector('button[type="submit"]');
  let busy = false;

  function isValid(control) {
    return control.input.validity.valid && control.valid(control.input.value.trim());
  }

  function showError(control, invalid) {
    control.input.setAttribute("aria-invalid", String(invalid));
    control.input.classList.toggle("popup__input_type_error", invalid);
    control.error.classList.toggle("popup__error_visible", invalid);
    control.error.textContent = invalid ? messages[language][control.name] : "";
  }

  function syncButton() {
    const valid = controls.every(isValid);
    button.disabled = busy || !valid;
    button.classList.toggle("popup__button_disabled", !valid);
    return valid;
  }

  for (const control of controls) {
    const update = () => {
      showError(control, !isValid(control));
      syncButton();
    };
    control.input.addEventListener("input", update);
    control.input.addEventListener("change", update);
    control.input.addEventListener("blur", update);
  }
  syncButton();

  return {
    check() {
      for (const control of controls) showError(control, !isValid(control));
      return syncButton();
    },
    setBusy(value) {
      busy = value;
      form.setAttribute("aria-busy", String(value));
      for (const control of controls) control.input.readOnly = value;
      syncButton();
    },
    clear() {
      for (const control of controls) showError(control, false);
      syncButton();
    },
  };
}
