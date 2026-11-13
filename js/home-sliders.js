function initializeSlider(container, options) {
  return new window.Swiper(container.querySelector(".swiper"), {
    loop: true,
    navigation: {
      prevEl: container.querySelector(".swiper-button-prev"),
      nextEl: container.querySelector(".swiper-button-next"),
    },
    pagination: {
      el: container.querySelector(".swiper-pagination"),
      type: "fraction",
    },
    ...options,
  });
}

const infrastructure = document.querySelector("#infrastructure .swiper-statistic");
if (infrastructure) {
  initializeSlider(infrastructure, {
    slidesPerView: 2,
    spaceBetween: 16,
    slideToClickedSlide: true,
    breakpoints: {
      540: { slidesPerView: 4 },
    },
  });
}

function initializeMaterials(stage) {
  const deck = stage.querySelector(".materials-deck");
  const slides = stage.querySelectorAll(".materials-slide");
  const count = stage.querySelector(".materials-controls__count");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wheelDuration = 0.78;
  const wheelDurationMs = wheelDuration * 1000;
  let activeIndex = 0;

  function showProgress(progress) {
    stage.style.setProperty("--materials-progress", progress);
    const index = progress < 0.5 ? 0 : 1;
    if (activeIndex === index) return;
    activeIndex = index;
    slides[0].setAttribute("aria-hidden", String(index !== 0));
    slides[1].setAttribute("aria-hidden", String(index !== 1));
    count.textContent = `${index + 1} / ${slides.length}`;
  }

  for (const button of stage.querySelectorAll("[data-materials-step]")) {
    button.addEventListener("click", () => showProgress(1 - activeIndex));
  }
  stage.setAttribute("data-materials-ready", "");

  if (!window.ScrollTrigger) return;

  const section = stage.closest("section");
  const financing = section.parentElement.querySelector("#financing");
  const header = document.querySelector("header");
  let trigger;
  let layout;
  let frame;
  let pinTop = 0;
  let slideDistance = 0;
  let refreshFrame;
  let wheelStep;

  function stepOnWheel(event) {
    if (!trigger || reducedMotion.matches || event.defaultPrevented || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.shiftKey ||
        Math.abs(event.deltaY) <= Math.abs(event.deltaX) ||
        event.target.closest?.("[data-lenis-prevent], [data-lenis-prevent-wheel], [aria-modal='true']") ||
        document.querySelector(".popup_is-opened, body.header-menu-open")) return;

    const smoothScroll = typeof lenis === "undefined" ? null : lenis;
    if (smoothScroll?.isStopped) return;
    const now = performance.now();
    const direction = Math.sign(event.deltaY);
    const consume = () => {
      event.preventDefault();
      // Lenis also handles this wheel event, on the bubbling path.
      event.stopImmediatePropagation();
    };

    if (wheelStep?.animating || (wheelStep?.direction === direction &&
        now - wheelStep.lastWheel < 140 && now - wheelStep.started < wheelDurationMs + 400)) {
      wheelStep.lastWheel = now;
      consume();
      return;
    }
    if (smoothScroll?.isLocked) return;

    const firstStop = Math.ceil(trigger.start);
    const secondStop = Math.round(trigger.start + slideDistance);
    const y = window.scrollY;
    if (y < firstStop - 2 || y > secondStop + 2) return;
    const target = direction > 0 ? secondStop : firstStop;
    if (direction * (target - y) <= 2) return;

    consume();
    const step = { direction, started: now, lastWheel: now, animating: true };
    wheelStep = step;
    const finish = () => { step.animating = false; };
    if (smoothScroll) {
      // Start from the browser's actual position after native or programmatic scrolling.
      smoothScroll.resize();
      smoothScroll.scrollTo(target, {
        duration: wheelDuration,
        easing: (progress) => (1 - Math.cos(Math.PI * progress)) / 2,
        onComplete: finish,
      });
    } else {
      window.scrollTo({ top: target, behavior: "smooth" });
    }
    // Release input even if a resize, keyboard scroll or navigation interrupts the animation.
    setTimeout(finish, wheelDurationMs + 120);
  }

  function refreshLayout() {
    frame = undefined;
    // Keep the top edge just behind the header when scroll coordinates round.
    pinTop = Math.max(0, Math.floor(header?.getBoundingClientRect().bottom ?? 0) - 2);
    stage.style.setProperty("--materials-header-height", `${pinTop}px`);
    const height = deck.offsetHeight;
    const viewport = window.innerHeight;
    slideDistance = Math.round(Math.min(560, Math.max(300, viewport * 0.7)));
    const gap = Number.parseFloat(getComputedStyle(section.parentElement).rowGap) || 0;
    const shouldPin = !reducedMotion.matches && height > 0 && height <= viewport - pinTop + 1;
    const nextLayout = `${pinTop}/${height}/${deck.offsetWidth}/${viewport}/${gap}/${shouldPin}`;
    if (nextLayout === layout) return;
    layout = nextLayout;

    if (!shouldPin) {
      if (!trigger) return;
      trigger.kill();
      trigger = undefined;
      wheelStep = undefined;
      window.removeEventListener("wheel", stepOnWheel, true);
      stage.removeAttribute("data-materials-pinned");
      showProgress(activeIndex);
      if (financing) {
        financing.removeAttribute("data-materials-reveal");
        financing.style.removeProperty("--materials-financing-margin");
        financing.style.removeProperty("--materials-financing-gap");
      }
      window.ScrollTrigger.refresh();
      return;
    }

    stage.setAttribute("data-materials-pinned", "");
    if (financing) {
      financing.setAttribute("data-materials-reveal", "");
      // Financing reaches the bottom of the deck as the second slide settles.
      financing.style.setProperty("--materials-financing-margin", `${slideDistance - gap}px`);
      financing.style.setProperty("--materials-financing-gap", `${gap}px`);
    }
    if (!trigger) {
      const followScroll = ({ progress, start, end }) => {
        showProgress(Math.min(1, progress * (end - start) / (slideDistance - 2)));
      };
      trigger = window.ScrollTrigger.create({
        id: "materials-scroll",
        refreshPriority: -1,
        trigger: stage,
        pin: true,
        pinSpacing: !financing,
        start: () => `top ${pinTop}px`,
        end: () => `+=${slideDistance + (financing ? deck.offsetHeight : 0)}`,
        onUpdate: followScroll,
        onRefresh: followScroll,
      });
      window.addEventListener("wheel", stepOnWheel, { capture: true, passive: false });
    }
    window.ScrollTrigger.sort();
    window.ScrollTrigger.refresh();
  }

  const scheduleLayout = () => {
    if (frame === undefined) frame = requestAnimationFrame(refreshLayout);
  };
  const refreshScrollPosition = () => {
    if (refreshFrame !== undefined) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = undefined;
      refreshLayout();
      if (trigger) window.ScrollTrigger.refresh();
    });
  };
  reducedMotion.addEventListener("change", scheduleLayout);
  window.addEventListener("resize", scheduleLayout);
  window.addEventListener("load", refreshScrollPosition, { once: true });
  document.fonts?.ready.then(refreshScrollPosition);
  const observer = new ResizeObserver(scheduleLayout);
  observer.observe(deck);
  if (header) observer.observe(header);
  const flow = new ResizeObserver(refreshScrollPosition);
  for (const sibling of section.parentElement.children) {
    if (sibling === section) break;
    flow.observe(sibling);
  }
  flow.observe(stage.previousElementSibling);
  refreshLayout();
}

const materials = document.querySelector("[data-materials]");
if (materials) {
  // The features pin adds its scroll distance above Materials on DOMContentLoaded.
  if (document.readyState === "complete") initializeMaterials(materials);
  else document.addEventListener("DOMContentLoaded", () => initializeMaterials(materials), { once: true });
}
