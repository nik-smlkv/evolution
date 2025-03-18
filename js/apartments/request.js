import apartments from "../apartments/data.js";
let data = JSON.parse(apartments);
console.log(data);
const [firstApartment, ...lastApartment] = data;
document.querySelector('.apartment__img').src = firstApartment.planImg;
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
			 <div class="apartment__item flex-style-column ${firstApartment.id === item.id ? "active" : ""}">
				  <div class="apartment__img">
						<img src="${img}" alt="apartment" />
				  </div>
				  <span class="apartment__meter text-dark">${meter}</span>
			 </div>
		`);
	});
}

const getApartmentPlan = (apartmentPlan) => {

}

const getApartmentDescription = (infos) => {

}

const getRoomsCount = (roomsCount) => {

}

const getBuildingWing = (buildingWing) => {

}

const getFloor = (floors) => {

}

const getObjectCount = () => {
	const objectsCount = data.length;
	document.querySelector('.js-get-apartments').textContent = objectsCount;
}
const getActiveApartment = () => {

}
getObjectCount();
getApartmentCards(firstApartment);
window.addEventListener("DOMContentLoaded", getFirstApartment);