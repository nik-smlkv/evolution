const container = document.getElementById("carousel");
const fullSlides = document.querySelector('.full-slides');
let slides = gsap.utils.toArray(".showcase__item");
const totalSlides = slides.length;
fullSlides.textContent = totalSlides;
const slideEase = "back.out(1.3)";
const slideWidth = 33.33;
const gapContainer = 2;
const gapX = (gapContainer / slideWidth) * 100;
const moveAmountX = 90 + gapX;
const baseOffset = (33.33 / slideWidth) * 100;
const minX = baseOffset - moveAmountX;
const maxX = baseOffset + (totalSlides - 1) * moveAmountX;
let dragStartX = 0;
let dragging = false;
const dragThreshold = 50

slides = [slides.pop(), ...slides];
slides.forEach((slide, i) => {
	gsap.set(slide, { xPercent: baseOffset + (i - 1) * moveAmountX });
});

let isAnimating = false;

function updateSlideScales() {
	slides.forEach((slide) => {
		const isActive = slide._gsap.xPercent === 100;
		gsap.to(slide, {
			scale: isActive ? 1 : 0.8,
			duration: 0.2,
			ease: "power2.out"
		});
		slide = isActive ? slide.classList.add('slide-active') : slide.classList.remove('slide-active');
	});
	const activeSlide = slides.find(slide => slide.classList.contains('slide-active'));
	const currentSlide = document.querySelector('.current-slide');
	currentSlide.textContent = activeSlide.getAttribute('data-slide');
}

function go(dir) {
	if (isAnimating) return;
	isAnimating = true;

	if (dir === 1) {
		// NEXT BUTTON behavior:
		slides.forEach((slide) => {
			const current = slide._gsap.xPercent;
			let adjusted = current;
			if (current >= maxX) {
				adjusted -= totalSlides * moveAmountX;
			}
			gsap.set(slide, { xPercent: Math.round(adjusted) });

		});
		gsap.to(slides, {
			xPercent: `-=${Math.round(moveAmountX)}`,
			duration: 0.75,
			ease: "power2.inOut",
			onComplete: () => {

				slides.forEach((slide) => {
					const current = slide._gsap.xPercent;
					let wrapped = current;
					if (current >= maxX) {
						wrapped -= totalSlides * moveAmountX;
					} else if (current < minX) {
						wrapped += totalSlides * moveAmountX;
					}
					gsap.set(slide, { xPercent: Math.round(wrapped) });

				});
				updateSlideScales();
				isAnimating = false;

			}
		});
	} else if (dir === -1) {
		// PREV BUTTON behavior:
		let wrappingSlide = slides.reduce((prev, curr) => {
			return curr._gsap.xPercent > prev._gsap.xPercent ? curr : prev;
		}, slides[0]);

		const entranceOffset = 40; // increased from 10 to 25 percentage points
		gsap.set(wrappingSlide, { xPercent: minX - entranceOffset });

		const tl = gsap.timeline({
			onComplete: () => {
				slides.forEach((slide) => {

					const current = slide._gsap.xPercent;
					let wrapped = current;
					if (current >= maxX) {
						wrapped -= totalSlides * moveAmountX;
					} else if (current < minX) {
						wrapped += totalSlides * moveAmountX;
					}
					gsap.set(slide, { xPercent: wrapped });
				});
				updateSlideScales();
				isAnimating = false;
			}
		});

		tl
			.to(
				slides.filter((s) => s !== wrappingSlide),
				{
					xPercent: `+=${moveAmountX}`,
					duration: 0.85,
					ease: "power2.inOut"
				},
				0
			)
			.to(
				wrappingSlide,
				{
					xPercent: minX,
					duration: 0.65,
					ease: "power2.inOut"
				},
				0.2
			);

	}
}


updateSlideScales();

document.getElementById("nextBtn").addEventListener("click", () => go(1));

document.getElementById("prevBtn").addEventListener("click", () => go(-1));

container.addEventListener("mousedown", (e) => {
	if (isAnimating) return; // prevent dragging during an ongoing animation
	dragging = true;
	dragStartX = e.clientX;
});

container.addEventListener("mousemove", (e) => {
	if (!dragging) return;
	// Optionally, add code here for real-time dragging feedback.
});

container.addEventListener("mouseup", (e) => {
	if (!dragging) return;
	dragging = false;
	const dragDelta = e.clientX - dragStartX;
	if (dragDelta > dragThreshold) {
		// Dragged to the right → show previous slide.
		go(-1);
	} else if (dragDelta < -dragThreshold) {
		// Dragged to the left → show next slide.
		go(1);
	}
});

container.addEventListener("mouseleave", (e) => {
	// If the mouse leaves the container while dragging, treat it as an end of drag.
	if (!dragging) return;
	dragging = false;
	const dragDelta = e.clientX - dragStartX;
	if (dragDelta > dragThreshold) {
		go(-1);
	} else if (dragDelta < -dragThreshold) {
		go(1);
	}
});

const swiperStatistic = new Swiper('.swiper-statistic', {
	loop: true,
	cssMode: true,
	direction: 'horizontal',
	pagination: {
		el: '.swiper-pagination',
		type: 'fraction',
	},
	clickable: true,
	navigation: {
		nextEl: '.swiper-button-next',
		prevEl: '.swiper-button-prev',
	},
});



const titles = document.querySelectorAll('.title-slide');
const texts = document.querySelectorAll('.text-slide');
function updateTitle(index) {
	titles.forEach((title, i) => {
		if (i === index) {
			title.classList.remove('hide');
			title.classList.add('show');
		} else {
			title.classList.remove('show');
			title.classList.add('hide');
		}
	});
	texts.forEach((text, i) => {
		if (i === index) {
			text.classList.remove('hide');
			text.classList.add('show');
		} else {
			text.classList.remove('show');
			text.classList.add('hide');
		}
	});
}


const swiperQuality = new Swiper('.swiper-quality', {
	slidesPerView: 1,
	loop: true,
	cssMode: true,
	direction: 'horizontal',
	pagination: {
		el: '.swiper-pagination',
		type: 'fraction',
	},
	clickable: true,
	navigation: {
		nextEl: '.swiper-button-next',
		prevEl: '.swiper-button-prev',
	},

});

swiperQuality.on('slideChange', function () {
	const currentIndex = swiperQuality.realIndex;
	const previousIndex = (currentIndex === 0) ? titles.length - 1 : currentIndex - 1;
	titles[previousIndex].classList.remove('show');
	titles[previousIndex].classList.add('hide');
	texts[previousIndex].classList.remove('show');
	texts[previousIndex].classList.add('hide');
	updateTitle(currentIndex);
});

updateTitle(swiperQuality.activeIndex);
