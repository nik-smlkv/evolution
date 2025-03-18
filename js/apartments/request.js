import apartments from "../apartments/data.js";
let data = JSON.parse(apartments);
console.log(data);


/* const getApartmentCards = (imgs, meters) => {
	const apartmentCards = document.querySelector(".available-apartments__list");
	apartmentCards.insertAdjacentHTML("beforeend", 
		`<strong>inserted text</strong>`,
	);
} */

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

const getObject = (objects) => {

}

const apartmentsMeters = data.map((num) => num.area);
const apartmentsImages = data.map((img) => img.apartmentImg);
getApartmentCards(apartmentsImages, apartmentsMeters);
//https://codepen.io/GreenSock/pen/LEYzdgw