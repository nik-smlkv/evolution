for (const gallery of document.querySelectorAll("[data-render-gallery]")) {
  const stage = gallery.querySelector(".render-gallery__stage");
  const firstFrame = stage?.querySelector(".render-gallery__image");
  const controls = stage?.querySelector(".render-gallery__controls");
  const skip = controls?.querySelector("[data-render-skip]");
  const previous = controls?.querySelector('[data-render-step="-1"]');
  const next = controls?.querySelector('[data-render-step="1"]');
  const count = controls?.querySelector(".render-gallery__count");
  const skipTarget = document.getElementById(skip?.getAttribute("aria-controls") || "form");
  const sources = Array.from(gallery.querySelectorAll("template[data-render-frame]"),
    (template) => template.content.querySelector("img"));
  if (!firstFrame || !skip || !skipTarget || !sources.length || sources.some((source) => !source)) continue;

  const frames = [firstFrame];
  const pending = new Map();
  const frameCount = sources.length + 1;
  const lastIndex = frameCount - 1;
  const wheelIdle = 100;
  const wheelThreshold = 16;
  const swipeDistance = 36;
  const header = document.querySelector("header");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compact = window.matchMedia("(max-width: 767px), (pointer: coarse)");
  let activeIndex = 0;
  let transition;
  let requestedIndex = 0;
  let scheduledFrame = 0;
  let skipping = false;
  let wheelGesture;
  let swipe;

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
    if (skipping || transition || !incoming?.naturalWidth || requestedIndex === activeIndex) return;
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
      duration: compact.matches ? 340 : 440,
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
    next?.setAttribute("aria-disabled", String(requestedIndex === lastIndex));
  }

  function scrollPosition() {
    const { top, bottom, height } = gallery.getBoundingClientRect();
    const travel = height - stage.getBoundingClientRect().height;
    const progress = travel > 0 ? Math.max(0, Math.min(1, -top / travel)) : 0;
    return { top, bottom, travel, progress, index: Math.round(progress * lastIndex) };
  }

  function isPinned({ top, travel }) {
    return travel > 0 && top <= 2 && top + travel >= -2;
  }

  function update() {
    scheduledFrame = 0;
    const { top, bottom, travel, progress, index } = scrollPosition();
    if (bottom <= 0 || top >= window.innerHeight || travel <= 0) return;
    gallery.style.setProperty("--render-progress", progress);
    if (skipping) return;

    if (index !== requestedIndex) {
      requestedIndex = index;
      updateSteps();
      loadFrame(index).then((frame) => {
        if (!frame || requestedIndex !== index) return;
        showRequestedFrame();
      });
    }

    if (index > 0 && !frames[index - 1]) loadFrame(index - 1);
    if (index < lastIndex && !frames[index + 1]) loadFrame(index + 1);
  }

  function scheduleUpdate() {
    if (!scheduledFrame) scheduledFrame = requestAnimationFrame(update);
  }

  function updateSize() {
    gallery.style.setProperty("--render-header-height", `${header?.offsetHeight ?? 0}px`);
    scheduleUpdate();
  }

  function goToFrame(index, { top, travel } = scrollPosition()) {
    if (skipping || index < 0 || index > lastIndex) return;
    const scrollTop = window.scrollY + top + index * travel / lastIndex;
    if (typeof lenis !== "undefined") {
      lenis.resize();
      lenis.scrollTo(scrollTop, { immediate: true });
    } else {
      window.scrollTo({ top: scrollTop, behavior: "instant" });
    }
    scheduleUpdate();
  }

  function stepOnWheel(event) {
    const { deltaMode, deltaX, deltaY } = event;
    if (skipping || event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey || event.shiftKey ||
        Math.abs(deltaY) <= Math.abs(deltaX) ||
        event.target.closest?.("[data-lenis-prevent], [data-lenis-prevent-wheel], [aria-modal='true']") ||
        document.querySelector(".popup_is-opened, body.header-menu-open")) return;
    const scroller = typeof lenis === "undefined" ? null : lenis;
    if (scroller?.isStopped || scroller?.isLocked) return;

    const position = scrollPosition();
    if (position.top >= window.innerHeight || position.bottom <= 0 || position.travel <= 0) {
      wheelGesture = undefined;
      return;
    }

    const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? window.innerHeight : 1);
    const direction = Math.sign(delta);
    const distance = Math.abs(delta);
    const pinned = isPinned(position);
    let target = position.index + direction;
    if (!pinned) {
      const distanceToEnd = position.top + position.travel;
      const movement = delta + (scroller ? scroller.targetScroll - window.scrollY : 0);
      if (direction > 0 && position.top > 0 && movement >= position.top) target = 0;
      else if (direction < 0 && distanceToEnd < 0 && movement <= distanceToEnd) target = lastIndex;
      else {
        wheelGesture = undefined;
        return;
      }
    }

    const now = performance.now();
    const recent = wheelGesture && now - wheelGesture.lastEvent < wheelIdle;
    const sameDirection = recent && wheelGesture.direction === direction;
    const reversing = recent && !sameDirection && wheelGesture.committedAt !== null;
    if (reversing) wheelGesture.reverseDistance += distance;
    // A renewed swipe can arrive before the previous swipe's momentum stops.
    const renewed = sameDirection && wheelGesture.settling && distance >= wheelThreshold * 0.75;
    const reversed = reversing && wheelGesture.reverseDistance >= wheelThreshold;
    const continuing = recent && wheelGesture.committedAt !== null && !renewed && !reversed;
    if (!continuing && (target < 0 || target > lastIndex)) {
      wheelGesture = undefined;
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (continuing) {
      wheelGesture.lastEvent = now;
      if (sameDirection) {
        wheelGesture.reverseDistance = 0;
        if (distance <= wheelThreshold / 4 && now - wheelGesture.committedAt >= wheelIdle) {
          wheelGesture.settling = true;
        }
      }
      return;
    }

    if (!sameDirection || renewed) {
      wheelGesture = { direction, lastEvent: now, distance: 0, reverseDistance: 0, committedAt: null, settling: false };
    }
    wheelGesture.lastEvent = now;
    wheelGesture.distance += distance;
    if (pinned && !renewed && !reversed && wheelGesture.distance < wheelThreshold) return;
    wheelGesture.committedAt = now;
    goToFrame(target, position);
  }

  stage.addEventListener("touchstart", (event) => {
    swipe = undefined;
    if (skipping || event.touches.length !== 1 || event.target.closest?.("button") || !isPinned(scrollPosition())) return;
    const touch = event.touches[0];
    swipe = { x: touch.clientX, y: touch.clientY, direction: 0, committed: false };
  }, { passive: true });

  stage.addEventListener("touchmove", (event) => {
    if (!swipe || event.touches.length !== 1 || !event.cancelable) {
      swipe = undefined;
      return;
    }
    const touch = event.touches[0];
    const x = touch.clientX - swipe.x;
    const y = swipe.y - touch.clientY;
    if (!swipe.direction) {
      if (Math.max(Math.abs(x), Math.abs(y)) < 5) return;
      const direction = Math.sign(y);
      const { index } = scrollPosition();
      if (Math.abs(y) <= Math.abs(x) || index + direction < 0 || index + direction > lastIndex) {
        swipe = undefined;
        return;
      }
      swipe.direction = direction;
    }
    event.preventDefault();
    if (!swipe.committed && y * swipe.direction >= swipeDistance) {
      swipe.committed = true;
      goToFrame(scrollPosition().index + swipe.direction);
    }
  }, { passive: false });

  const endSwipe = () => { swipe = undefined; };
  stage.addEventListener("touchend", endSwipe, { passive: true });
  stage.addEventListener("touchcancel", endSwipe, { passive: true });
  window.addEventListener("wheel", stepOnWheel, { capture: true, passive: false });

  previous?.addEventListener("click", () => goToFrame(requestedIndex - 1));
  next?.addEventListener("click", () => goToFrame(requestedIndex + 1));
  skip.addEventListener("click", () => {
    if (skipping) return;
    wheelGesture = undefined;
    if (!skipTarget.hasAttribute("tabindex")) skipTarget.tabIndex = -1;
    skipTarget.focus({ preventScroll: true });
    const offset = -(header?.offsetHeight ?? 0);
    const immediate = reducedMotion.matches;
    const finishSkip = () => {
      skipping = false;
      scheduleUpdate();
    };
    if (typeof lenis !== "undefined") {
      if (lenis.isStopped || lenis.isLocked) return;
      skipping = !immediate;
      lenis.resize();
      lenis.scrollTo(skipTarget, {
        offset,
        immediate,
        lock: true,
        duration: 0.85,
        easing: (progress) => progress * progress * (3 - 2 * progress),
        onComplete: finishSkip,
      });
    } else if (!immediate && window.gsap?.plugins.scrollTo) {
      skipping = true;
      window.gsap.to(window, {
        duration: 0.85,
        ease: "power1.inOut",
        scrollTo: { y: skipTarget, offsetY: -offset, autoKill: true, onAutoKill: finishSkip },
        onComplete: finishSkip,
        onInterrupt: finishSkip,
      });
    } else {
      const top = window.scrollY + skipTarget.getBoundingClientRect().top + offset;
      window.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
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
