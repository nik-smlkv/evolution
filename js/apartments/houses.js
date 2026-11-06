import { optimizedImageUrl } from "../optimized-images.js?v=1.0.6";

export const houses = {
  vivaldi: {
    id: "vivaldi",
    name: "Vivaldi",
    dataModule: "./data_vivaldi.js?v=1.0.1",
    hasAreaFilter: true,
    hasFloorPlans: true,
  },
  tchaikovsky: {
    id: "tchaikovsky",
    name: "Tchaikovsky",
    dataModule: "./data_tchaikovsky.js?v=1.0.16",
    hasAreaFilter: true,
    hasFloorPlans: true,
  },
};

export const getHouse = (houseId) => houses[houseId] ?? houses.vivaldi;

export const loadHouse = async (houseId) => {
  const house = getHouse(houseId);
  const { default: apartments } = await import(house.dataModule);
  const optimized = JSON.parse(apartments).map((apartment) => ({
    ...apartment,
    planImg: optimizedImageUrl(apartment.planImg),
    apartmentImg: optimizedImageUrl(apartment.apartmentImg),
  }));
  return { ...house, apartments: JSON.stringify(optimized) };
};
