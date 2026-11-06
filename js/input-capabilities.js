// Hover feedback belongs to larger screens with a precise, hover-capable pointer.
export const hoverMedia = matchMedia("(min-width: 701px) and (hover: hover) and (pointer: fine)");
export const canHover = () => hoverMedia.matches;

const syncHoverCapability = () => {
  document.documentElement.dataset.hoverEnabled = String(canHover());
};

syncHoverCapability();
hoverMedia.addEventListener("change", syncHoverCapability);
