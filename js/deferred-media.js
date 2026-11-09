// Keep the below-fold video out of the initial image/network queue.
export function initializeDeferredVideos() {
  const videos = [...document.querySelectorAll("video[data-deferred-video]")];
  if (!videos.length) return;
  const visible = new Set();
  const loaded = new Set();
  const load = (video) => {
    if (loaded.has(video)) return;
    loaded.add(video);
    video.querySelectorAll("source[data-src]").forEach((source) => {
      source.src = source.dataset.src;
      source.removeAttribute("data-src");
    });
    video.preload = "metadata";
    video.load();
  };
  const updatePlayback = (video) => {
    if (visible.has(video) && document.visibilityState !== "hidden") {
      load(video);
      if (video.paused) video.play()?.catch(() => {});
    } else video.pause();
  };
  const setVisible = (video, isVisible) => {
    if (isVisible) visible.add(video);
    else visible.delete(video);
    updatePlayback(video);
  };

  if ("IntersectionObserver" in window) {
    const playback = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => setVisible(target, isIntersecting));
    });
    videos.forEach((video) => playback.observe(video));
  } else {
    let frame;
    const check = () => {
      frame = null;
      videos.forEach((video) => {
        const { top, bottom } = video.getBoundingClientRect();
        setVisible(video, top < window.innerHeight && bottom > 0);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    check();
  }
  document.addEventListener("visibilitychange", () => videos.forEach(updatePlayback));
  window.addEventListener("pagehide", () => videos.forEach((video) => video.pause()));
  window.addEventListener("pageshow", () => videos.forEach(updatePlayback));
}

initializeDeferredVideos();
