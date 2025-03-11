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

const swiperQuality = new Swiper('.swiper-quality', {
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


пше 
const swiperGallery = new Swiper('.swiper-gallery', {
	slidesPerView: 1,
	spaceBetween: 55,
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
/* 	on: {
		slideChange: function () {
			updateSlides(this);
		},
	}, */
});

/* 
function updateSlides(swiper) {
	const slides = document.querySelectorAll('.swiper-gallery .swiper-slide');
	const nextSlide = document.querySelector('.swiper-gallery .swiper-slide-next');

	if (nextSlide) {
		nextSlide.style.transform = 'scale(2)'; // Увеличиваем следующий слайд
	}

	slides.forEach(slide => {
		if (slide !== nextSlide) {
			slide.style.transform = 'scale(1)'; // Уменьшаем остальные слайды
		}
	});
} */