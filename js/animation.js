document.addEventListener("DOMContentLoaded", () => {
	// Register GSAP Plugins
	gsap.registerPlugin(ScrollTrigger);

	// Parallax Layers
	document.querySelectorAll('[data-parallax-layers]').forEach((triggerElement) => {
		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: triggerElement,
				start: "center bottom",  // Начинаем анимацию, когда верх триггера достигает низа окна
				end: "bottom top",    // Заканчиваем, когда низ триггера достигает верха окна
				scrub: 0
			}
		});
		const layers = [
			{ layer: "1", yPercent: 70 },
			{ layer: "2", yPercent: 55 },
			{ layer: "3", yPercent: 40 },
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