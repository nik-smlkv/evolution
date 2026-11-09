// Nothing starts until the first caller needs the plan. Concurrent callers
// share initialization; a failed attempt can be retried without reloading.
export function createDeferredPlan(initialize) {
  let pending;
  return () => {
    if (!pending) {
      pending = Promise.resolve().then(initialize).catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

const xlinkNamespace = "http://www.w3.org/1999/xlink";

export function deferPlanImages(root, resolve = (path) => path) {
  root.querySelectorAll("image").forEach((image) => {
    const path = image.getAttribute("href") || image.getAttributeNS(xlinkNamespace, "href");
    if (path) image.dataset.planImage = resolve(path);
    image.removeAttribute("href");
    image.removeAttributeNS(xlinkNamespace, "href");
  });
}

export function activatePlanImages(plan) {
  plan.querySelectorAll("image").forEach((image) => {
    const path = image.dataset.planImage;
    if (!path || image.getAttribute("href") === path) return;
    image.setAttribute("href", path);
    image.setAttributeNS(xlinkNamespace, "xlink:href", path);
  });
}

export function createPlanImageLoader(ImageType = Image) {
  const cache = new Map();
  return (path) => {
    if (!cache.has(path)) {
      const image = new ImageType();
      const loaded = new Promise((resolve, reject) => {
        image.onload = () => Promise.resolve().then(() => image.decode?.()).then(resolve, reject);
        image.onerror = () => reject(new Error(`Unable to load ${path}`));
      }).catch((error) => {
        cache.delete(path);
        throw error;
      });
      cache.set(path, loaded);
      image.decoding = "async";
      image.src = path;
    }
    return cache.get(path);
  };
}
