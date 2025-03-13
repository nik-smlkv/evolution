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

document.addEventListener("DOMContentLoaded", () => {
	gsap.registerPlugin(ScrollTrigger);

	const pageContainer = document.querySelector(".container");

	/* SMOOTH SCROLL */
	const scroller = new LocomotiveScroll({
		el: pageContainer,
		smooth: true
	});

	scroller.on("scroll", ScrollTrigger.update);

	ScrollTrigger.scrollerProxy(pageContainer, {
		scrollTop(value) {
			return arguments.length
				? scroller.scrollTo(value, 0, 0)
				: scroller.scroll.instance.scroll.y;
		},
		getBoundingClientRect() {
			return {
				left: 0,
				top: 0,
				width: window.innerWidth,
				height: window.innerHeight
			};
		},
		pinType: pageContainer.style.transform ? "transform" : "fixed"
	});

	////////////////////////////////////
	////////////////////////////////////
	window.addEventListener("load", function () {
		let pinBoxes = document.querySelectorAll(".pin-wrap > *");
		let pinWrap = document.querySelector(".pin-wrap");
		let pinWrapWidth = pinWrap.offsetWidth;
		let horizontalScrollLength = pinWrapWidth - window.innerWidth;

		// Pinning and horizontal scrolling

		gsap.to(".pin-wrap", {
			scrollTrigger: {
				scroller: pageContainer, //locomotive-scroll
				scrub: true,
				trigger: "#sectionPin",
				pin: true,
				// anticipatePin: 1,
				start: "top top",
				end: pinWrapWidth
			},
			x: -horizontalScrollLength,
			ease: "none"
		});

		ScrollTrigger.addEventListener("refresh", () => scroller.update()); //locomotive-scroll

		ScrollTrigger.refresh();
	});

});