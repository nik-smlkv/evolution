
const video = document.querySelector('.video');

window.addEventListener('resize', () => {
	if (window.innerWidth >= 768) {
		video.pause();
	}
})

window.addEventListener('DOMContentLoaded', () => {
	if (window.innerWidth >= 768) {
		video.pause();
	}
})

var blockImage = document.querySelector('.block-image');
var sectionBody = document.querySelector('.section__body-main');
var scrollToVideo = document.querySelector('.scroll-to-video');
const title = document.querySelector(".main-title");
var scrollPosition = scrollToVideo.offsetTop;
const movingImg = document.querySelector('.moving-img');
const aboutButton = document.querySelector(".about-button");
document.addEventListener("DOMContentLoaded", () => {
	// Register GSAP Plugins
	gsap.registerPlugin(ScrollTrigger);
	const scrollPanel = () => {
		if (window.innerWidth > 768) {
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
				},
			});
		}
	}
	scrollPanel();
	/*  PARALLAX  */
	if (window.innerWidth >= 768) {
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
				{ layer: "1", yPercent: 20 },
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
gsap.to(".scale-image img", {
	scrollTrigger: {
		trigger: ".section__body-main",
		start: "top center",
		end: "top center",
		scrub: true,
		onEnter: () => {
			gsap.to(".scale-image img", {
				clipPath: "polygon(0 0%, 100% 0%, 100% 100%, 0 100%)",
				scale: "1",
			});
		},
	},
});
document.addEventListener('DOMContentLoaded', () => {
	function preventScroll(event) {
		event.preventDefault();
		event.stopPropagation();
	}
	if (window.innerWidth >= 768) {
		scrollToVideo.classList.add('js-scrolling');
		window.addEventListener("wheel", () => {
			const title = document.querySelector(".main-title");
			const aboutButton = document.querySelector(".about-button");
			const scrollToVideo = document.querySelector(".scroll-to-video");
			const videoWidth = scrollToVideo.offsetWidth;
			const videoHeight = scrollToVideo.offsetHeight;
			const scrollPosition = window.scrollY;
			const videoPosition = scrollToVideo.offsetTop;
			const maxScroll = videoPosition - title.offsetHeight;
			const scrollPercent = Math.min(scrollPosition / maxScroll, 1);
			let isScrolling = false;
			gsap.to(title, {
				y: -scrollPosition,
				opacity: 1 - scrollPercent * 10,
				duration: 0.1
			});
			gsap.to(aboutButton, {
				y: -scrollPosition,
				opacity: 1 - scrollPercent * 10,
				duration: 0.1,
				ease: "power2.out"
			});
			let isAnimatingScroll = false;
			if (!scrollToVideo.classList.contains('js-scrolling')) {
				blockImage.style.display = "block";
				gsap.to(blockImage, {
					width: 'auto',
					height: 'auto',
					duration: 1,
					ease: "power1.inOut"
				});
			}
			if (scrollToVideo.classList.contains('js-scrolling')) {
				gsap.to(blockImage, {
					width: '100%',
					height: '100vh',
					top: "0px",
					right: "0px",
					duration: 1,
					ease: "power1.out",
					scrollTrigger: {
						trigger: sectionBody,
						start: "top top",
						scrub: false,
						onEnter: (self) => {
							if (self.direction === 1) {
								if (!isAnimatingScroll && scrollToVideo.classList.contains('js-scrolling')) {
									blockImage.style.position = "fixed";
									blockImage.style.zIndex = "5";
									aboutButton.style.zIndex = "2";
									sectionBody.style.position = "static";
									sectionBody.style.maxInlineSize = "100%";
									isAnimatingScroll = true;
									scrollToVideo.classList.add('js-scrolling');
									// Блокируем прокрутку
									window.addEventListener("wheel", preventScroll, { passive: false });
									gsap.to(window, {
										scrollTo: { y: scrollToVideo, autoKill: false },
										duration: 1,
										ease: "power1.out",
										onEnter: (self) => {
											if (self.direction === 1) {
												document.body.style.overflow = "hidden";
											}
										},
										onComplete: () => {
											scrollToVideo.classList.remove('js-scrolling');
											video.play();
											window.removeEventListener("wheel", preventScroll);
											document.body.style.overflow = "";
											isAnimatingScroll = false;
											blockImage.style.display = "none";
											blockImage.style.position = "absolute";
											blockImage.style.zIndex = "1";
											aboutButton.style.zIndex = "5";
											blockImage.style.height = "auto";
											sectionBody.style.position = "relative";
											sectionBody.style.maxInlineSize = "1920px";
											scrollToVideo.style.position = "relative";
											scrollToVideo.style.zIndex = "6";
										},
										toggleActions: "play none none none"
									});
								}
							}
						},
						onLeave: () => {
							// Возвращаем прокрутку при выходе из триггера
							isAnimatingScroll = false;
							window.removeEventListener("wheel", preventScroll);
							document.body.style.overflow = "";
							video.play();
							blockImage.style.position = "absolute";
							blockImage.style.zIndex = "1";
							aboutButton.style.zIndex = "5";
							blockImage.style.height = "auto";
							sectionBody.style.position = "relative";
							sectionBody.style.maxInlineSize = "1920px";
							gsap.to(blockImage, {
								width: 'auto',
								height: 'auto',
								duration: 0.1,
								ease: "power3.out",
								onLeave: () => {
									blockImage.style.display = "block";
								}
							});

						},
						toggleActions: "play none none none"
					}
				});
			}
		});

	}

});
