import homeRoutes from "./home-routes.js?v=1.0.2";

const catalogParameters = ["house", "type", "floor", "property", "view", "kvadrati-od", "stanovi-do"];
const sectionRoutes = new Map(Object.entries(homeRoutes).map(([route, section]) => [section, route]));

export function isHomeUrl(value, root) {
  const url = new URL(value, root);
  const base = new URL(root);
  if (url.origin !== base.origin) return false;
  const pages = [base.pathname, `${base.pathname}index.html`];
  if (base.pathname !== "/") pages.push(base.pathname.slice(0, -1));
  for (const route of Object.keys(homeRoutes)) {
    const path = new URL(`${route}/`, base).pathname;
    pages.push(path, path.slice(0, -1), `${path}index.html`);
  }
  return pages.includes(url.pathname);
}

export function homeSectionUrl(section, root, current = root) {
  if (section !== "main" && !sectionRoutes.has(section)) throw new RangeError(`Unknown home section: ${section}`);
  const url = new URL(section === "main" ? "./" : `${sectionRoutes.get(section)}/`, root);
  const source = new URL(current, root);
  if (source.origin === url.origin) url.search = source.search;
  for (const key of [...catalogParameters, "section"]) url.searchParams.delete(key);
  return url;
}

export function normalizeHomeUrl(value, root) {
  const url = new URL(value, root);
  if (!isHomeUrl(url, root)) return url;
  for (const key of catalogParameters) url.searchParams.delete(key);
  let fragment;
  try { fragment = decodeURIComponent(url.hash.slice(1)); } catch { fragment = ""; }
  const legacy = url.searchParams.get("section") || fragment;
  if (legacy === "main" || sectionRoutes.has(legacy)) {
    return homeSectionUrl(legacy, root, url);
  }
  url.searchParams.delete("section");
  return url;
}

export function getHomeSection(value, root) {
  const url = new URL(value, root);
  if (!isHomeUrl(url, root)) return null;
  for (const [route, section] of Object.entries(homeRoutes)) {
    const path = new URL(`${route}/`, root).pathname;
    if ([path, path.slice(0, -1), `${path}index.html`].includes(url.pathname)) return section;
  }
  return "main";
}

export function isPlainNavigation(event, link) {
  return !event.defaultPrevented && (event.button === undefined || event.button === 0)
    && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
    && !link.hasAttribute("download") && (!link.target || link.target === "_self");
}

export function initializeHomeNavigation({ root, closeMenu, scrollTo }) {
  const cleanAddress = () => {
    const url = normalizeHomeUrl(location.href, root);
    if (url.href !== location.href) history.replaceState(history.state, "", url.href);
  };
  cleanAddress();

  const bindings = [
    ...Array.from(document.querySelectorAll(".menu__item_link[data-target]"), (link) => [link, link.dataset.target]),
    [document.querySelector(".header__logo"), "main"],
    [document.querySelector(".js-scroll-form"), "form"],
  ].filter(([link, section]) => link && (section === "main" || sectionRoutes.has(section)));

  const refreshLinks = () => bindings.forEach(([link, section]) => {
    link.href = homeSectionUrl(section, root, location.href).href;
  });
  const markSection = (section) => document.querySelectorAll(".menu__item_link[data-target]").forEach((link) => {
    link.classList.toggle("active-link", link.dataset.target === section);
  });
  const showSection = (section, immediate) => {
    const target = section === "main" ? 0 : document.getElementById(section);
    if (target === null) return;
    markSection(section);
    scrollTo(target, immediate);
  };
  refreshLinks();
  bindings.forEach(([link, section]) => link.addEventListener("click", (event) => {
    if (!isPlainNavigation(event, link) || !isHomeUrl(location.href, root)) return;
    event.preventDefault();
    const url = homeSectionUrl(section, root, location.href);
    if (url.href !== location.href) history.pushState(history.state, "", url.href);
    refreshLinks();
    closeMenu();
    showSection(section, false);
  }));

  const restoreRoute = () => {
    cleanAddress();
    refreshLinks();
    const section = getHomeSection(location.href, root);
    if (section) showSection(section, true);
  };
  window.addEventListener("popstate", restoreRoute);
  window.addEventListener("pageshow", (event) => {
    cleanAddress();
    refreshLinks();
    if (event.persisted) restoreRoute();
  });

  // Aliases are full static home pages. Wait for their images/fonts before the
  // initial section scroll, so opening or refreshing a shared path stays aligned.
  const initialSection = getHomeSection(location.href, root);
  if (initialSection && initialSection !== "main") {
    showSection(initialSection, true);
    if (initialSection === "render-gallery") {
      const initialUrl = location.href;
      const interactionEvents = ["wheel", "touchstart", "pointerdown", "keydown"];
      let frame;
      let settled;
      const align = () => {
        if (settled || frame !== undefined) return;
        frame = requestAnimationFrame(() => {
          frame = undefined;
          if (location.href === initialUrl) showSection(initialSection, true);
        });
      };
      const observer = new ResizeObserver(align);
      observer.observe(document.querySelector("#main"));
      const stop = () => {
        settled = true;
        observer.disconnect();
        if (frame !== undefined) cancelAnimationFrame(frame);
        for (const event of interactionEvents) window.removeEventListener(event, stop);
      };
      for (const event of interactionEvents) window.addEventListener(event, stop, { passive: true });
      const finish = () => {
        Promise.resolve(document.fonts?.ready).then(align);
        setTimeout(stop, 1000);
      };
      if (document.readyState === "complete") finish();
      else window.addEventListener("load", finish, { once: true });
      return;
    }
    const finish = () => {
      const section = getHomeSection(location.href, root);
      if (section && section !== "main") showSection(section, true);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
  }
}
