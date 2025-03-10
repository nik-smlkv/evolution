const swiper = new Swiper('.swiper-statistic', {
	loop: true,
	cssMode: true,
	direction: 'horizontal',
	pagination: {
		el: '.swiper-pagination',
	},
	navigation: {
		nextEl: '.swiper-button-next',
		prevEl: '.swiper-button-prev',
	},
	scrollbar: {
		el: '.swiper-scrollbar',
	},
});