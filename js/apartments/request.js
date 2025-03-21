import apartments from "../apartments/data.js";
let data = JSON.parse(apartments);
const [firstApartment, ...lastApartment] = data;
let apartmentFancyBox = document.querySelector('.apartment__fancybox');
document.querySelector('.apartment__img').src = firstApartment.planImg;
apartmentFancyBox.setAttribute("href", firstApartment.planImg);
console.log(firstApartment)
const getFirstApartment = () => {
	document.querySelector('.js-apartment-wing').textContent = firstApartment.buldingWing;
	document.querySelector('.js-apartment-floor').textContent = firstApartment.floor;
	document.querySelector('.js-apartment-area').textContent = firstApartment.area + "m²";
	document.querySelector('.js-apartment-number').textContent = firstApartment.apartmentNumber;
};




const getApartmentCards = (firstApartment) => {
	const apartmentCards = document.querySelector(".available-apartments__list");
	data.map((item) => {
		const img = item.apartmentImg;
		const meter = item.area;
		apartmentCards.insertAdjacentHTML("beforeend", `
			 <div class="apartment__item flex-style-column ${firstApartment.id === item.id ? "active" : ""}" data-id="${item.id}">
				  <div class="apartment__img-card">
						<img src="${img}" alt="apartment" />
				  </div>
				  <span class="apartment__meter text-dark">${meter}</span>
			 </div>
		`);
	});
}
window.addEventListener("DOMContentLoaded", () => {
	var apartmentCards = document.querySelectorAll(".apartment__item");
	apartmentCards.forEach(item => {
		item.addEventListener('click', () => {
			const apartmentCardsList = document.querySelectorAll(".apartment__item");
			apartmentCardsList.forEach(item => {
				item.classList.remove('active');
			})
			item.classList.add('active');
			const apartmentId = item.getAttribute('data-id');
			let currentItem = data.find(apartment => apartment.id === Number(apartmentId));
			if (currentItem) {
				// Обновляем данные в секции с информацией
				const imgElement = document.querySelector('.apartment-card__content .apartment__img');
				let apartmentFancyBox = document.querySelector('.apartment__fancybox');
				if (imgElement) {
					apartmentFancyBox.setAttribute("href", currentItem.planImg);
					imgElement.src = currentItem.planImg;
				}
				document.querySelector('.js-apartment-wing').textContent = currentItem.buldingWing;
				document.querySelector('.js-apartment-floor').textContent = currentItem.floor;
				document.querySelector('.js-apartment-area').textContent = currentItem.area + "m²";
				document.querySelector('.js-apartment-number').textContent = currentItem.apartmentNumber;
			}
		});
	});



});

const getObjectCount = () => {
	const objectsCount = data.length;
	document.querySelector('.js-get-apartments').textContent = objectsCount;
}
const getActiveApartment = () => {

}
getObjectCount();
getApartmentCards(firstApartment);
window.addEventListener("DOMContentLoaded", getFirstApartment);

