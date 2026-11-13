import { openModal } from "./modal.js?v=1.0.6";

export function openPriceRequest(context = null) {
  const popup = document.querySelector(".popup_type_form_quarter");
  const form = popup?.querySelector(".quarter__form");
  if (!popup || !form) return;

  if (context) form.dataset.priceRequestContext = JSON.stringify(context);
  else delete form.dataset.priceRequestContext;

  openModal(popup);
}
