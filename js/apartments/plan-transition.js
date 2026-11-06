// Animate a child layer so the parent surface remains available for pinch zoom.
export function animatePlanFloorChange({ layer, outgoing, viewport, direction, reducedMotion = false }) {
  if (!outgoing || !direction || reducedMotion || typeof layer.animate !== "function") return () => {};
  const sign = direction > 0 ? 1 : -1;
  const options = { duration: 400, easing: "cubic-bezier(0.22, 0.78, 0.24, 1)", fill: "both" };
  const animations = [];
  let running = true;
  const finish = () => {
    if (!running) return;
    running = false;
    animations.forEach((animation) => animation.cancel());
    outgoing.remove();
    layer.inert = false;
    viewport.classList.remove("is-plan-transitioning");
  };
  viewport.append(outgoing);
  viewport.classList.add("is-plan-transitioning");
  layer.inert = true;
  try {
    animations.push(layer.animate([
      { transform: `translateY(${sign * 100}%)` },
      { transform: "translateY(0)" },
    ], options));
    animations.push(outgoing.animate([
      { transform: "translateY(0)" },
      { transform: `translateY(${-sign * 100}%)` },
    ], options));
    Promise.all(animations.map((animation) => animation.finished)).then(finish, finish);
  } catch {
    animations.forEach((animation) => animation.finished.catch(() => {}));
    finish();
  }
  return finish;
}

// The inert outgoing visual must not duplicate live SVG IDs or references.
export function clonePlanLayer(layer, prefix) {
  const clone = layer.cloneNode(true);
  clone.classList.add("plan-layer--outgoing");
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  const elements = [clone, ...clone.querySelectorAll("*")];
  const ids = new Map(elements.filter((element) => element.id)
    .map((element) => [element.id, `${prefix}-${element.id}`]));
  const rewrite = (value) => value.replace(/url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g,
    (match, quote, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
  elements.forEach((element) => {
    if (element.id) element.id = ids.get(element.id);
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name === "id") return;
      let value = rewrite(attribute.value);
      if (value.startsWith("#") && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
      if (attribute.name === "aria-labelledby" || attribute.name === "aria-describedby") {
        value = value.split(/\s+/).map((id) => ids.get(id) || id).join(" ");
      }
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    });
  });
  return clone;
}
