for (const gallery of document.querySelectorAll("[data-render-gallery]")) {
  const stage = gallery.querySelector(".render-gallery__stage");
  const firstFrame = stage?.querySelector(".render-gallery__image");
  const controls = stage?.querySelector(".render-gallery__controls");
  const skip = controls?.querySelector("[data-render-skip]");
  const previous = controls?.querySelector('[data-render-step="-1"]');
  const next = controls?.querySelector('[data-render-step="1"]');
  const count = controls?.querySelector(".render-gallery__count");
  const form = document.getElementById("form");
  const sources = Array.from(gallery.querySelectorAll("template[data-render-frame]"),
    (template) => template.content.querySelector("img"));
  if (!firstFrame || !skip || !form || !sources.length || sources.some((source) => !source)) continue;

  const frames = [firstFrame];
  const pending = new Map();
  const frameCount = sources.length + 1;
  const header = document.querySelector("header");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 767px), (pointer: coarse)");
  let activeIndex = 0;
  let transition;
  let requestedIndex = 0;
  let scheduledFrame = 0;

  function loadFrame(index) {
    if (frames[index]) return Promise.resolve(frames[index]);
    if (!pending.has(index)) {
      const frame = document.importNode(sources[index - 1], true);
      frame.loading = "eager";
      frame.fetchPriority = "low";
      pending.set(index, frame.decode().then(() => {
        stage.insertBefore(frame, controls);
        frames[index] = frame;
        return frame;
      }).catch(() => null).finally(() => pending.delete(index)));
    }
    return pending.get(index);
  }

  function showRequestedFrame() {
    const incoming = frames[requestedIndex];
    if (transition || !incoming?.naturalWidth || requestedIndex === activeIndex) return;
    const outgoing = frames[activeIndex];
    const start = requestedIndex > activeIndex ? "100%" : "-100%";
    activeIndex = requestedIndex;
    outgoing.classList.remove("is-active");
    incoming.classList.add("is-active");
    updateCount();
    if (reducedMotion.matches || !outgoing.complete || !outgoing.naturalWidth) return;

    // Keep the previous image in place until the moving image covers it.
    outgoing.classList.add("is-outgoing");
    transition = incoming.animate([{ transform: `translateY(${start})` }, { transform: "translateY(0)" }], {
      duration: compact.matches ? 340 : 620,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    });
    transition.onfinish = () => {
      outgoing.classList.remove("is-outgoing");
      transition = undefined;
      showRequestedFrame();
    };
  }

  function updateCount() {
    if (count) count.textContent = `${activeIndex + 1} / ${frameCount}`;
  }

  function updateSteps() {
    previous?.setAttribute("aria-disabled", String(requestedIndex === 0));
    next?.setAttribute("aria-disabled", String(requestedIndex === frameCount - 1));
  }

  function update() {
    scheduledFrame = 0;
    const { top, bottom, height } = gallery.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight) return;

    const travel = height - stage.getBoundingClientRect().height;
    if (travel <= 0) return;
    const progress = Math.max(0, Math.min(1, -top / travel));
    const position = progress * frameCount;
    const index = Math.min(frameCount - 1, Math.round(position));
    gallery.style.setProperty("--render-progress", progress);

    if (index !== requestedIndex) {
      requestedIndex = index;
      updateSteps();
      loadFrame(index).then((frame) => {
        if (!frame || requestedIndex !== index) return;
        if (transition && activeIndex !== index) transition.finish();
        showRequestedFrame();
      });
    }

    if (index > 0 && !frames[index - 1]) loadFrame(index - 1);
    if (index < frameCount - 1 && !frames[index + 1]) loadFrame(index + 1);
  }

  function scheduleUpdate() {
    if (!scheduledFrame) scheduledFrame = requestAnimationFrame(update);
  }

  function updateSize() {
    gallery.style.setProperty("--render-header-height", `${header?.offsetHeight ?? 0}px`);
    scheduleUpdate();
  }

  function step(direction) {
    const target = requestedIndex + direction;
    if (target < 0 || target >= frameCount) return;

    const { top, height } = gallery.getBoundingClientRect();
    const travel = height - stage.getBoundingClientRect().height;
    const scrollTop = window.scrollY + top + target * travel / frameCount;
    if (typeof lenis !== "undefined") {
      lenis.resize();
      lenis.scrollTo(scrollTop, { immediate: true });
    } else {
      window.scrollTo({ top: scrollTop, behavior: "instant" });
    }
    scheduleUpdate();
  }

  previous?.addEventListener("click", () => step(-1));
  next?.addEventListener("click", () => step(1));
  skip.addEventListener("click", () => {
    if (!form.hasAttribute("tabindex")) form.tabIndex = -1;
    form.focus({ preventScroll: true });
    const offset = -(header?.offsetHeight ?? 0);
    if (typeof lenis !== "undefined") {
      lenis.resize();
      lenis.scrollTo(form, { offset, immediate: true });
    } else {
      const top = window.scrollY + form.getBoundingClientRect().top + offset;
      window.scrollTo({ top, behavior: "instant" });
    }
  });

  gallery.style.setProperty("--render-steps", frameCount - 1);
  gallery.classList.add("is-enhanced");
  updateCount();
  updateSteps();
  firstFrame.addEventListener("load", showRequestedFrame);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", updateSize);
  window.addEventListener("pageshow", updateSize);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) transition?.finish();
  });
  updateSize();
}
