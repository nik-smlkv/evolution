
const video = document.querySelector('.video');

gsap.registerPlugin(ScrollTrigger);
const lenis = new Lenis({
	smooth: true,
	direction: 'vertical',
});

function raf(time) {
	lenis.raf(time);
	requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.scrollerProxy(document.body, {
	getBoundingClientRect() {
		return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
	},
	getBoundingClientRect() {
		return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
	},
	pinType: document.body.style.transform ? "transform" : "fixed",
});


var blockImage = document.querySelector('.block-image');
var sectionBody = document.querySelector('.section__body-main');
var scrollToVideo = document.querySelector('.scroll-to-video');
const title = document.querySelector(".main-title");
var scrollPosition = scrollToVideo.offsetTop;
const movingImg = document.querySelector('.moving-img');
const aboutButton = document.querySelector(".about-button");
document.addEventListener("DOMContentLoaded", () => {
	if (window.innerWidth <= 767) {
		const scrollPanel = () => {
			const cont = document.querySelector("#panels-container");
			const panels = gsap.utils.toArray("#panels-container .panel");
			let tween = gsap.to(panels, {
				x: () => -1.5 * (cont.scrollWidth - innerWidth),
				ease: "none",
				scrollTrigger: {
					trigger: "#panels-container",
					pin: true,
					start: "-50%",
					scrub: 2,
					end: () => "+=" + (cont.scrollWidth - innerWidth),
				},
			});
		}
		scrollPanel();
		/*  PARALLAX  */
		document.querySelectorAll('[data-parallax-layers]').forEach((triggerElement) => {
			let tl = gsap.timeline({
				scrollTrigger: {
					trigger: triggerElement,
					start: "-20% 0%",
					end: "bottom center",
					scrub: true,
					onEnter: () => {
						console.log("Trigger activated for:", triggerElement);
					}
				}
			});
			const layers = [
				{ layer: "1", yPercent: 10 },
				{ layer: "2", yPercent: 10 },
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

	}
});
/* GSAP COUNTER */
document.addEventListener("DOMContentLoaded", () => {
	// Получаем все элементы счетчиков
	const counters = document.querySelectorAll(".counter");
	const countersFloat = document.querySelectorAll(".counter-float");
	counters.forEach(counter => {
		const endValue = counter.getAttribute("data-end-value"); // Получаем конечное значение из атрибута
		const triggerCounter = document.querySelector('.trig-counter');
		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: triggerCounter,
				start: "120% 120%",  // START ANIMATION TRIGGER
			}
		});
		// Анимация счетчика
		tl.to({ value: 0 }, {
			value: endValue,
			duration: 3, // Длительность анимации в секундах
			onUpdate: function () {
				counter.innerText = Math.ceil(this.targets()[0].value);
			},
			ease: "power1.out" // Эффект easing
		});
	});
	countersFloat.forEach(countersFloat => {
		const endValue = countersFloat.getAttribute("data-end-value"); // Получаем конечное значение из атрибута
		const triggerCounter = document.querySelector('.trig-counter');
		// Анимация счетчика
		let tl = gsap.timeline({
			scrollTrigger: {
				trigger: triggerCounter,
				start: "120% 120%",  // START ANIMATION TRIGGER
			}
		});
		tl.to({ value: 0 }, {
			value: endValue,
			duration: 3, // Длительность анимации в секундах
			onUpdate: function () {
				countersFloat.innerText = this.targets()[0].value.toFixed(3);
			},
			ease: "power1.out" // Эффект easing
		});
	});
});
document.addEventListener('DOMContentLoaded', () => {
	const splitTexts = document.querySelectorAll('.split-text');

	splitTexts.forEach((textElement) => {
		const animtextLine = Splitting({
			target: '.split-text',
			by: 'lines'
		});

		animtextLine.forEach((splitResult) => {
			const wrappedLines = splitResult.lines.map((wordsArr, i) => {
				const wordsHTML = wordsArr.map((word) => {
					if (document.querySelector('.main-title') && word.style.getPropertyValue('--word-index') === '1') {
						return `${word.outerHTML.replace('<span class="word"', '<span class="word title-span"')}<span class="whitespace"></span>`;
					}
					return `${word.outerHTML}<span class="whitespace"></span>`;
				}).join('');

				return `<div class="line" style="--line-index: ${i};">${wordsHTML}</div>`;
			}).join('');
			splitResult.el.innerHTML = wrappedLines;
		});
		ScrollTrigger.create({
			trigger: textElement,
			start: "120% 120%",
			onEnter: () => {
				document.querySelector('.main-title').style.display = "flex";
				document.querySelector('.about-button').style.display = "flex";
				textElement.classList.add('line-up');
			},
			onLeaveBack: () => {
				textElement.classList.remove('line-up');
			}
		});
	});
});

/* document.addEventListener('DOMContentLoaded', () => {
	var scrollToVideo = document.querySelector(".scroll-to-video");
	function preventScroll(event) {
		event.preventDefault();
		event.stopPropagation();
	}
	window.addEventListener('DOMContentLoaded', () => {
		const video = document.querySelector('.video');
		const scrollToVideo = document.querySelector('.scroll-to-video');
		if (window.innerWidth >= 768) {
			video.pause();
			if (isInSectionBodyMain()) {
				scrollToVideo.classList.add('js-scrolling');
			} else {
				video.style.visibility = "visible"; // Исправлено на visibility
				video.play();
			}
		}
	});
	function isInSectionBodyMain() {
		const sectionBodyMain = document.querySelector('.section__body-main');
		const scrollPosition = window.scrollY;
		const sectionTop = sectionBodyMain.offsetTop - 220;
		const sectionBottom = sectionTop + sectionBodyMain.offsetHeight;
		return scrollPosition >= sectionTop && scrollPosition <= sectionBottom;
	}
	if (window.innerWidth >= 768) {
		var title = document.querySelector(".main-title");
		var aboutButton = document.querySelector(".about-button");
		const sectionBodyMain = document.querySelector('.section__body-main');
		var scrollPosition = window.scrollY;
		var videoPosition = scrollToVideo.offsetTop;
		var maxScroll = videoPosition - title.offsetHeight;
		if (!scrollToVideo.classList.contains('js-scrolling')) {
			gsap.to(title, {
				scrollTrigger: {
					trigger: sectionBodyMain,
					start: "top top",
					scrub: true,
					ease: "linear"
				},
				y: -50,
				opacity: 0,
				duration: 5
			});
			gsap.to(aboutButton, {
				scrollTrigger: {
					trigger: sectionBodyMain,
					start: "top top",
					end: "bottom top",
					scrub: true,
					ease: "linear"
				},
				y: -50,
				opacity: 0,
				duration: 5
			});
		}
		function disableScroll() {
			window.addEventListener("wheel", preventDefault, { passive: false });
			window.addEventListener("touchmove", preventDefault, { passive: false });
			window.addEventListener("keydown", preventArrowKeys, { passive: false });
		}

		function enableScroll() {
			window.removeEventListener("wheel", preventDefault);
			window.removeEventListener("touchmove", preventDefault);
			window.removeEventListener("keydown", preventArrowKeys);
		}

		function preventDefault(e) {
			e.preventDefault();
		}

		function preventArrowKeys(e) {
			if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) {
				e.preventDefault();
			}
		}
		function handleWheelEvent(e) {
			if (!scrollToVideo.classList.contains("js-scrolling")) {
				blockImage.style.display = "block";
				blockImage.style.position = "absolute";
				gsap.to(blockImage, {
					maxWidth: "1100px",
					maxHeight: "860px",
					right: "auto",
					duration: 0,
					ease: "power3",
					onComplete: () => {
						disableScroll();
					}
				});
			}

			if (scrollToVideo.classList.contains("js-scrolling") && e.deltaY > 0) {

				blockImage.style.position = "fixed";
				blockImage.style.width = "100%";
				gsap.to(blockImage, {
					maxWidth: "100%",
					maxHeight: "100%",
					right: 0,
					duration: 1.5,
					ease: "linear",
				});
				lenis.scrollTo(scrollToVideo.offsetTop - 90, {
					immediate: false,
					duration: 2,
					onComplete: () => {
						scrollToVideo.classList.remove("js-scrolling");
						enableScroll();
						video.play();
					},
				});
			}
		}
		window.addEventListener("wheel", handleWheelEvent);

	}
});
 */