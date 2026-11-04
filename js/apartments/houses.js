export const houses = {
  vivaldi: {
    id: "vivaldi",
    name: "Vivaldi",
    dataModule: "./data_vivaldi.js?v=1.0.0",
    hasAreaFilter: true,
    hasFloorPlans: true,
  },
  tchaikovsky: {
    id: "tchaikovsky",
    name: "Tchaikovsky",
    dataModule: "./data_tchaikovsky.js?v=1.0.12",
    hasAreaFilter: true,
    hasFloorPlans: true,
  },
};

export const getHouse = (houseId) => houses[houseId] ?? houses.vivaldi;

export const loadHouse = async (houseId) => {
  const house = getHouse(houseId);
  const { default: apartments } = await import(house.dataModule);

  return { ...house, apartments };
};
