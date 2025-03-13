gsap.registerPlugin(ScrollTrigger);

const tl = gsap.timeline({
	scrollTrigger: {
		trigger: "#dream-img",
		start: "center center",
		end: "bottom top",
		scrub: true
	}
});

// Параллакс-слои
const layers = document.querySelectorAll(".parallax-container");

layers.forEach(layer => {
	const depth = layer.dataset.depth;
	const movement = -(layer.offsetHeight * depth)
	tl.to(layer, { y: movement, ease: "none" }, 0)
});