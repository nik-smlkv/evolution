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


$('.slick-gallery').slick({
	centerMode: true,
	centerPadding: '20px',
	slidesToShow: 3,
	responsive: [
		{
			breakpoint: 768,
			settings: {
				arrows: false,
				centerMode: true,
				centerPadding: '40px',
				slidesToShow: 3
			}
		},
		{
			breakpoint: 480,
			settings: {
				arrows: false,
				centerMode: true,
				centerPadding: '40px',
				slidesToShow: 1
			}
		}
	]
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