
document.addEventListener("DOMContentLoaded", () => {
	// Register GSAP Plugins
	gsap.registerPlugin(ScrollTrigger);

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
				textElement.classList.add('line-up');
			},
			onLeaveBack: () => {
				textElement.classList.remove('line-up');
			}
		});
	});
});
/* document.addEventListener('DOMContentLoaded', () => {
	const mainBlock = document.querySelector(".section__body-main");
	const blockImage = document.querySelector(".block-image");
	const mainBlockWidth = mainBlock.offsetWidth;
	const centerY = (window.innerHeight - blockImage.offsetHeight) / 2;
	console.log(centerY)
	const positionX = mainBlockWidth - blockImage.offsetWidth;
	gsap.set(blockImage, {
		x: positionX + 75,
		y: centerY
	});
}); */


window.addEventListener("DOMContentLoaded", () => {
	const blockImage = document.querySelector(".block-image");
	const mainBlock = document.querySelector(".section__body-main");
	const mainBlockWidth = mainBlock.offsetWidth;
	const centerY = (mainBlock.offsetHeight - 783) / 2;
	const positionX = mainBlockWidth - blockImage.offsetWidth;
	/* 	gsap.set(blockImage, {
			x: positionX + 70,
			y: centerY
		}); */
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
});
const blockImage = document.querySelector('.block-image');
const sectionBody = document.querySelector('.section__body-main');
const scrollToVideo = document.querySelector('.scroll-to-video');
const movingImg = document.querySelector('.moving-img');
let isAnimatingScroll = false;
const title = document.querySelector(".main-title");
const aboutButton = document.querySelector(".about-button");
window.addEventListener('wheel', (event) => {
	if (event.deltaY > 0 && !isAnimatingScroll) { // Прокрутка вниз
		isAnimatingScroll = true;
		gsap.to(title, {
			y: -500,
			opacity: 0,
			duration: 0.1,
			ease: "power2.out"

		});
		gsap.to(aboutButton, {
			y: -500,
			opacity: 0,
			duration: 0.1,
			ease: "power2.out"
		});
		// Анимация увеличения блока
		gsap.to([blockImage, movingImg, sectionBody], {
			width: '100%',
			right: "0px",
			duration: 0.6,
			ease: "linear",
			scrub: true,
			onStart: () => {
				sectionBody.style.maxInlineSize = "100%";
				blockImage.style.right = "0px";
			},
			onEnter: () => {
				// Прокрутка к блоку scroll-to-video
				window.scrollTo({
					top: scrollToVideo.offsetTop,
					behavior: 'smooth'
				});
				isAnimatingScroll = false;
			}
		});


	}
});
window.addEventListener("scroll", () => {

	const scrollToVideo = document.querySelector(".scroll-to-video");
	const videoWidth = scrollToVideo.offsetWidth;
	const videoHeight = scrollToVideo.offsetHeight;
	const scrollPosition = window.scrollY;
	const videoPosition = scrollToVideo.offsetTop;
	const maxScroll = videoPosition - title.offsetHeight;
	const scrollPercent = Math.min(scrollPosition / maxScroll, 1);




});
/* 	//variable
	const pages = document.querySelectorAll(".scroll-to-video");
	const containers = document.querySelectorAll(".content-container");
	/* 	const scrollDots = document.querySelectorAll(".scroll > li"); */
//const numOfPages = pages.length;
//let pageIndex = 0;
//////first slideIn
//$('.scroll-to-video.active').find('div').css("transform", "translateX(0)");
//////wheel function
//window.addEventListener("wheel", function (e) {
//	// Scroll Up
//	if (0 < pageIndex && e.deltaY < 0) { pageIndex--; }
//	//// Scroll Down
//	else if (pageIndex < numOfPages - 1 && e.deltaY > 0) { pageIndex++; }
//	//// Move container up/down.
//	var position = "-" + pageIndex * 100;
//	containers.forEach((container, index) => {
//		container.style.transform = "translateY(" + position + "vh)";
//	})
//	$('.scroll-to-video').eq(pageIndex).children('div').css("transform", "translateX(0)");
//	//add click nav to change page
//	/* 		$('.scroll>li').click(function () {
//	ition that you click
//				pageIndex = $(this).index();
//				var position = "-" + pageIndex * 100;
//				container.style.transform = "translateY(" + position + "vh)";
//				$('li').removeClass('active');
//				$(this).addClass('active');
//			}) */
//});/*wheel*/

/*wheel for cellfone*/
//if($(window).width()<768){}
//} */

/* 
window.addEventListener("scroll", () => {
	const title = document.querySelector(".main-title");
	const aboutButton = document.querySelector(".about-button");
	const scrollToVideo = document.querySelector(".scroll-to-video");
	const videoWidth = scrollToVideo.offsetWidth;
	const videoHeight = scrollToVideo.offsetHeight;
	const scrollPosition = window.scrollY;
	const videoPosition = scrollToVideo.offsetTop;
	const maxScroll = videoPosition - title.offsetHeight;
	const scrollPercent = Math.min(scrollPosition / maxScroll, 1);


	gsap.to(title, {
		y: -scrollPosition,
		opacity: 1 - scrollPercent,
		duration: 0.5
	});
	gsap.to(aboutButton, {
		y: -scrollPosition,
		opacity: 1 - scrollPercent * 5,
		duration: 0.5,
		ease: "power2.out"
	});
	gsap.to(".scale-image img", {
		y: () => +window.scrollY + 100,
		scrollTrigger: {
			trigger: ".section__body-main",
			start: "bottom bottom",
			scrub: true,
		},
	});
	gsap.to(".scale-image img", {
		y: () => +window.scrollY + 100,
		opacity: 1 - scrollPercent * 5,
		scrollTrigger: {
			trigger: ".scroll-to-video",
			start: "top center",
			scrub: true,
		},
	});
	gsap.to(".video", {
		clipPath: "polygon(0 0%, 100% 0%, 100% 100%, 0 100%)",
		scrollTrigger: {
			trigger: ".scroll-to-video",
			start: "top center ",
			scrub: true,
		},
	});
});
 */