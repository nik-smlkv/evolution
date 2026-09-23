const pad = (number) => String(number).padStart(2, "0");

const makeLevelPlans = (level, numbers) =>
  Object.fromEntries(
    numbers.map((number) => [
      `A${pad(number)}`,
      `./А3/Lamela A/Lamela_A_2D/Level_${level}/A${number}.png`,
    ]),
  );

const makeLamelaPlans = (wing, folder, numbers) =>
  Object.fromEntries(
    numbers.map((number) => [
      `${wing}${pad(number)}`,
      `./А3/Lamela ${wing}/${folder}/${wing}${number}.png`,
    ]),
  );

/*
 * Only files that actually exist in the nested 2D folders are listed here.
 * New plans should be added to this manifest as they are received, so a card
 * never falls back to an unrelated root JPG.
 */
const tchaikovskyCardPlans = {
  ...makeLevelPlans(1, Array.from({ length: 14 }, (_, index) => index + 1)),
  A22: "./А3/Lamela A/Lamela_A_2D/Level_1/А22_plan.png",
  A23: "./А3/Lamela A/Lamela_A_2D/Level_1/А23_plan.png",
  ...makeLevelPlans(2, [15, 16, 17, 18, 19, 20, 21, 26, 27, 28, 29, 30, 31]),
  ...makeLevelPlans(3, [32, 33, 34, 35, 36, 37, 38, 44, 45, 46, 47, 48]),
  ...makeLamelaPlans("B", "Lamela_B 2D", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21]),
  ...makeLamelaPlans("C", "Lamela_C 2D", [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 22, 23, 24, 25, 26, 27, 28, 29, 31, 34, 41, 51, 52, 67, 68]),
};

/*
 * Add apartment facts here as they become available. `apartmentImg` can be
 * omitted: it is taken from tchaikovskyCardPlans above. `planImg` is the
 * large composite sheet shown in the right-hand apartment panel.
 *
 * "A01": {
 *   floor: "1",
 *   area: 53.14,
 *   status: "Available",
 *   planImg: "./А3/Lamela A/A01.jpg",
 * },
 */
const tchaikovskyMetadata = {};

const apartments = Object.entries(tchaikovskyCardPlans).map(
  ([unit, apartmentImg]) => {
    const metadata = tchaikovskyMetadata[unit] ?? {};
    const wing = unit.slice(0, 1);
    const detailSheet = `./А3/Lamela ${wing}/${unit}.jpg`;

    return {
      id: metadata.id ?? `tchaikovsky-${unit.toLowerCase()}`,
      apartmentNumber: metadata.apartmentNumber ?? unit,
      buldingWing: metadata.buldingWing ?? `Lamela ${wing}`,
      floor: metadata.floor ?? "—",
      area: Number.isFinite(metadata.area) ? metadata.area : null,
      status: metadata.status ?? "Available on request",
      planImg: metadata.planImg ?? detailSheet,
      apartmentImg: metadata.apartmentImg ?? apartmentImg,
      object: "Tchaikovsky",
    };
  },
);

export default JSON.stringify(apartments);
