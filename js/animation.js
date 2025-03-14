document.addEventListener("DOMContentLoaded", () => {
	// Register GSAP Plugins
	gsap.registerPlugin(ScrollTrigger, ScrollTrigger);

	/* LENIS VERTICAL SCROLL SMOOTH ANIMATION */
	const lenis = new Lenis();
	lenis.on('scroll', ScrollTrigger.update);
	gsap.ticker.add((time) => { lenis.raf(time * 1000); });
	gsap.ticker.lagSmoothing(0);


	/*  PARALLAX  */
	document.querySelectorAll('[data-parallax-layers]').forEach((triggerElement) => {
		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: triggerElement,
				start: "-20% 0%",  // START ANIMATION TRIGGER
				end: "bottom top",    // END ANIMATION TRIGGER
				scrub: 0
			}
		});
		const layers = [
			{ layer: "1", yPercent: 20 },
			{ layer: "2", yPercent: 15 },
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


	/*  HORIZONTAL SCROLL PANEL  */
	const cont = document.querySelector("#panels-container");
	const panels = gsap.utils.toArray("#panels-container .panel");
	let tween = gsap.to(panels, {
		x: () => -1 * (cont.scrollWidth - innerWidth),
		ease: "none",
		scrollTrigger: {
			trigger: "#panels-container",
			pin: true,
			start: "-50%",
			scrub: 2,
			end: () => "+=" + (cont.scrollWidth - innerWidth),
		}
	});

});

const video = document.querySelector('.video');
video.pause();