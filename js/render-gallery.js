for (const gallery of document.querySelectorAll("[data-render-gallery]")) {
  const stage = gallery.querySelector(".render-gallery__stage");
  const firstFrame = stage?.querySelector(".render-gallery__image");
  const controls = stage?.querySelector(".render-gallery__controls");
  const skip = controls?.querySelector("[data-render-skip]");
  const form = document.getElementById("form");
  const sources = Array.from(gallery.querySelectorAll("template[data-render-frame]"),
    (template) => template.content.querySelector("img"));
  if (!firstFrame || !skip || !form || !sources.length || sources.some((source) => !source)) continue;

  const frames = [firstFrame];
  const pending = new Map();
  const frameCount = sources.length + 1;
  const header = document.querySelector("header");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeFrame = firstFrame;
  let requestedFrame = firstFrame;
  let fade;
  let requestedIndex = 0;
  let preloadedIndex = 0;
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
    if (fade || !requestedFrame || requestedFrame === activeFrame) return;
    const outgoing = activeFrame;
    activeFrame = requestedFrame;
    outgoing.classList.remove("is-active");
    activeFrame.classList.add("is-active");
    if (reducedMotion.matches) return;

    // The incoming image may have been inserted this frame. Animate explicitly
    // so it always starts transparent, with the previous image still beneath it.
    outgoing.classList.add("is-outgoing");
    fade = activeFrame.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 620,
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    });
    fade.onfinish = () => {
      outgoing.classList.remove("is-outgoing");
      fade = undefined;
      showRequestedFrame();
    };
  }

  function update() {
    scheduledFrame = 0;
    const { top, bottom, height } = gallery.getBoundingClientRect();
    if (bottom <= 0 || top >= window.innerHeight) return;

    const travel = height - stage.offsetHeight;
    if (travel <= 0) return;
    const progress = Math.max(0, Math.min(1, -top / travel));
    const position = progress * frameCount;
    const index = Math.min(frameCount - 1, Math.floor(position));
    gallery.style.setProperty("--render-progress", progress);

    if (index !== requestedIndex) {
      requestedIndex = index;
      requestedFrame = undefined;
      loadFrame(index).then((frame) => {
        if (!frame || requestedIndex !== index) return;
        requestedFrame = frame;
        showRequestedFrame();
      });
    }

    const next = index + 1;
    if (next < frameCount && next !== preloadedIndex && position - index >= 0.65) {
      preloadedIndex = next;
      loadFrame(next);
    }
  }

  function scheduleUpdate() {
    if (!scheduledFrame) scheduledFrame = requestAnimationFrame(update);
  }

  function updateSize() {
    gallery.style.setProperty("--render-header-height", `${header?.offsetHeight ?? 0}px`);
    scheduleUpdate();
  }

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
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", updateSize);
  window.addEventListener("pageshow", updateSize);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) fade?.finish();
  });
  updateSize();
}
