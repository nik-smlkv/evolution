// Temporarily unavailable for sale. Keep these units out of the catalog and plan.
const unavailableApartments = new Set([
  ...Array.from({ length: 29 }, (_, index) => `A${String(index + 1).padStart(2, "0")}`),
  "A03", "A04", "A17", "A18", "A22", "A23", "A34", "A35", "A39", "A40",
  "A51", "A52", "A56", "A57", "A68", "A69", "A73", "A74", "A85", "A86",
  "A90", "A91", "A102", "A103", "A107", "A108", "A119", "A123", "A124",
  "B02", "B15", "B21", "B22", "B35", "B41", "B42", "B55", "B61", "B62",
  "B75", "B81", "B82", "B95", "B101", "B102", "B115", "B121", "B122",
  "B135", "B136", "B138", "B139",
  "C03", "C04", "C08", "C17", "C18", "C22", "C34", "C35", "C39", "C56",
  "C67", "C71", "C82", "C86", "C97", "C101", "C112", "C113", "C116", "C117",
]);

export const isTchaikovskyApartmentAvailable = (apartment) => {
  const unit = String(apartment.apartmentNumber ?? "").trim().replace(/^STAN\s*/i, "").trim().toUpperCase();
  return !unavailableApartments.has(unit);
};
