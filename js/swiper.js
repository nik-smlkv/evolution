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

const swiper = new Swiper('.swiper-gallery', {
	slidesPerView: 3, // Показывать 3 слайда
	spaceBetween: 30, // Расстояние между слайдами
	centeredSlides: true, // Центрировать активный слайд
	loop: true, // Зацикливание слайдов
	on: {
		slideChange: function () {
			updateSlides(); // Обновляем стили при смене слайда
		},
	},
});

// Функция для обновления стилей слайдов
function updateSlides() {
	const slides = document.querySelectorAll('.swiper-slide');
	slides.forEach((slide, index) => {
		if (index === swiper.activeIndex) {
			slide.style.transform = 'scale(1.2)'; // Увеличиваем активный слайд
		} else {
			slide.style.transform = 'scale(0.8)'; // Уменьшаем неактивные слайды
		}
	});
}

// Инициализация стилей при загрузке
updateSlides();