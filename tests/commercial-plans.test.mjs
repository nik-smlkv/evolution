import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import commercialImages from "../js/apartments/tchaikovsky-commercial-images.js";
import { tchaikovskyOtherProperties } from "../js/apartments/tchaikovsky-properties.js";

const root = new URL("../", import.meta.url);
const expectedUnits = [
  "A01", "A02", "A03", "A04", "A05", "A06", "A07",
  "B08", "B09", "B10", "B11", "B12", "B19", "B20", "B21", "B22", "B23", "B24", "B25", "B26", "B27", "B28",
  "C13", "C14", "C15", "C16", "C17", "C18",
];

const webpSize = (file) => {
  const bytes = readFileSync(new URL(file, root));
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4);
    if (bytes.toString("ascii", offset, offset + 4) === "VP8L") {
      assert.equal(bytes[offset + 8], 0x2f);
      const dimensions = bytes.readUInt32LE(offset + 9);
      return { width: (dimensions & 0x3fff) + 1, height: ((dimensions >>> 14) & 0x3fff) + 1 };
    }
    offset += 8 + size + (size % 2);
  }
  assert.fail(`${file}: expected lossless WebP`);
};

test("all 28 commercial units use their own supplied 2D sheet and a distinct lightweight card preview", () => {
  const units = tchaikovskyOtherProperties.filter((property) => property.propertyType === "commercial");
  assert.deepEqual(units.map(({ unit }) => unit).sort(), expectedUnits);
  assert.deepEqual(Object.keys(commercialImages).sort(), expectedUnits);
  const paths = new Set();
  for (const property of units) {
    const { unit, planImg, previewImg } = property;
    assert.equal(property.image, planImg, `${unit}: details use the full plan`);
    assert.equal(property.apartmentImg, null, `${unit}: a 2D sheet is not a 3D apartment render`);
    assert.match(planImg, new RegExp(`/commercial/plans/${unit[0].toLowerCase()}/${unit.toLowerCase()}\\.webp$`));
    assert.match(previewImg, new RegExp(`/commercial/previews/${unit[0].toLowerCase()}/${unit.toLowerCase()}-640\\.webp$`));
    const full = webpSize(planImg);
    const preview = webpSize(previewImg);
    assert.equal(Math.max(preview.width, preview.height), 640, `${unit}: bounded preview size`);
    assert.ok(Math.abs(full.width * preview.height / full.height - preview.width) <= 1, `${unit}: uncropped plan ratio within pixel rounding`);
    assert.ok(readFileSync(new URL(previewImg, root)).length < readFileSync(new URL(planImg, root)).length, `${unit}: card payload is smaller`);
    assert.ok(!paths.has(planImg) && !paths.has(previewImg), `${unit}: no image reused for another unit`);
    paths.add(planImg);
    paths.add(previewImg);
  }
  assert.equal(paths.size, 56);
  for (const unit of ["A05", "A06", "A07"]) {
    assert.deepEqual(units.find((property) => property.unit === unit).planLevels, ["2000", "2100"]);
  }
});

test("parking units retain their own image fallback", () => {
  for (const property of tchaikovskyOtherProperties.filter((property) => property.propertyType === "parking")) {
    assert.equal(property.image, null);
    assert.equal(property.planImg, null);
    assert.equal(property.previewImg, null);
  }
});
