document.addEventListener("DOMContentLoaded", () => {
	// Register GSAP Plugins
	gsap.registerPlugin(ScrollTrigger);

	// Parallax Layers
	document.querySelectorAll('[data-parallax-layers]').forEach((triggerElement) => {
		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: triggerElement,
				start: "-20% 0%",  // Начинаем анимацию, когда верх триггера достигает низа окна
				end: "bottom top",    // Заканчиваем, когда низ триггера достигает верха окна
				scrub: 0
			}
		});
		const layers = [
			{ layer: "1", yPercent: 20 },
			{ layer: "2", yPercent: 35 },
			{ layer: "3", yPercent: 20 },
			{ layer: "4", yPercent: 10 }
		];

		layers.forEach((layerObj, idx) => {
			tl.to(
				triggerElement.querySelectorAll(`[data-parallax-layer="${layerObj.layer}"]`),
				{
					yPercent: layerObj.yPercent,
					ease: "none"
				},
				idx === 0 ? undefined : "<"
			);
		});
	});
	/* Lenis */
	const lenis = new Lenis();

	lenis.on('scroll', ScrollTrigger.update);

	gsap.ticker.add((time) => { lenis.raf(time * 1000); });

	gsap.ticker.lagSmoothing(0);


});

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);

/* Main navigation */
let panelsSection = document.querySelector("#panels"),
	panelsContainer = document.querySelector("#panels-container"),
	tween;
document.querySelectorAll(".anchor").forEach((anchor) => {
	anchor.addEventListener("click", function (e) {
		console.log("click");
		e.preventDefault();
		let targetElem = document.querySelector(e.target.getAttribute("href")),
			y = targetElem;
		if (targetElem && panelsContainer.isSameNode(targetElem.parentElement)) {
			let totalScroll = tween.scrollTrigger.end - tween.scrollTrigger.start,
				totalMovement = cont.scrollWidth - innerWidth;
			y = Math.round(
				tween.scrollTrigger.start +
				(targetElem.offsetLeft / totalMovement) * totalScroll
			);
		}
		gsap.to(window, {
			scrollTo: {
				y: y,
				autoKill: false
			},
			duration: 1
		});
	});
});

/* Panels */
const cont = document.querySelector("#panels-container");
const panels = gsap.utils.toArray("#panels-container .panel");

tween = gsap.to(panels, {
	x: () => -1 * (cont.scrollWidth - innerWidth),
	ease: "none",
	scrollTrigger: {
		trigger: "#panels-container",
		pin: true,
		start: "-50%",
		scrub: 1,
		end: () => "+=" + (cont.scrollWidth - innerWidth),
	}
});
