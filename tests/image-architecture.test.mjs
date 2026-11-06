import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import tchaikovsky from "../js/apartments/data_tchaikovsky.js";
import tchaikovskyImagePaths from "../js/apartments/tchaikovsky-image-paths.js";
import vivaldi from "../js/apartments/data_vivaldi.js";
import imageMap from "../js/optimized-image-map.js";
import { isTchaikovskyApartmentAvailable } from "../js/apartments/tchaikovsky-availability.js";

const root = new URL("../", import.meta.url);
const tchaikovskyUnits = JSON.parse(tchaikovsky);
const vivaldiUnits = JSON.parse(vivaldi);
const noImagePath = "./assets/images/shared/placeholders/no-image.svg";

test("both complete catalogs reference reachable production images", () => {
  assert.equal(tchaikovskyUnits.length, 403);
  assert.equal(vivaldiUnits.length, 60);
  for (const units of [tchaikovskyUnits, vivaldiUnits]) {
    for (const unit of units) {
      for (const field of ["planImg", "apartmentImg"]) {
        const url = new URL(unit[field], root);
        assert.ok(url.pathname.startsWith(new URL("assets/images/", root).pathname), `${unit.apartmentNumber}: ${field}`);
        assert.ok(existsSync(url), `${unit.apartmentNumber}: ${url.pathname}`);
      }
    }
  }
});

test("unavailable apartment metadata remains public without publishing its archived artwork", () => {
  const available = tchaikovskyUnits.filter(isTchaikovskyApartmentAvailable);
  const unavailable = tchaikovskyUnits.filter((unit) => !isTchaikovskyApartmentAvailable(unit));
  assert.equal(available.length, 308);
  assert.equal(unavailable.length, 95);
  assert.deepEqual(Object.keys(tchaikovskyImagePaths).sort(), available.map((unit) => unit.apartmentNumber.replace(/^STAN\s+/, "")).sort());
  for (const unit of unavailable) {
    assert.equal(unit.planImg, noImagePath, unit.apartmentNumber);
    assert.equal(unit.apartmentImg, noImagePath, unit.apartmentNumber);
    assert.ok(unit.floorLevel && unit.floor, `${unit.apartmentNumber}: floor metadata`);
    assert.ok(Number.isFinite(unit.area) && unit.area > 0, `${unit.apartmentNumber}: area`);
  }
  for (const unit of available) {
    assert.notEqual(unit.planImg, noImagePath, unit.apartmentNumber);
    assert.notEqual(unit.apartmentImg, noImagePath, unit.apartmentNumber);
  }
});

test("the production manifest matches every published image file and its content", () => {
  const { files } = JSON.parse(readFileSync(new URL("assets/manifests/production-images.json", root), "utf8"));
  assert.ok(files.length > 0);
  const actual = [];
  const walk = (path) => {
    for (const entry of readdirSync(new URL(path, root), { withFileTypes: true })) {
      if ([".DS_Store", "Thumbs.db", "desktop.ini"].includes(entry.name)) continue;
      const target = `${path}/${entry.name}`;
      if (entry.isDirectory()) walk(target);
      else actual.push(target);
    }
  };
  walk("assets/images");
  assert.deepEqual(actual.sort(), files.map((file) => file.path).sort());
  for (const file of files) {
    assert.ok(file.path.startsWith("assets/images/"), file.path);
    assert.match(file.path, /^[\x20-\x7e]+$/);
    assert.equal(file.path, file.path.toLowerCase());
    const url = new URL(file.path, root);
    assert.equal(statSync(url).size, file.bytes, file.path);
    assert.equal(createHash("sha256").update(readFileSync(url)).digest("hex"), file.sha256, file.path);
    assert.ok(file.roles.length > 0, `${file.path}: usage role`);
  }
});

test("image aliases resolve only to published files without needing archived originals", () => {
  const { files } = JSON.parse(readFileSync(new URL("assets/manifests/production-images.json", root), "utf8"));
  const published = new Set(files.map((file) => file.path));
  for (const [source, target] of Object.entries(imageMap)) {
    assert.ok(source.startsWith("assets/images/"), source);
    assert.ok(published.has(target), target);
    assert.ok(existsSync(new URL(target, root)), target);
  }
});

test("smaller substituted formats retain verified exact pixels and metadata", () => {
  const { files } = JSON.parse(readFileSync(new URL("assets/manifests/production-images.json", root), "utf8"));
  let substitutions = 0;
  for (const file of files) {
    for (const selection of file.selections) {
      if (selection.requested === selection.chosen) continue;
      substitutions += 1;
      assert.equal(selection.chosen, file.path);
      assert.equal(selection.selected_sha256, file.sha256);
      assert.ok(selection.selected_bytes < selection.source_bytes, file.path);
      const proof = selection.pixel_exact_proof;
      assert.ok(proof && proof.width > 0 && proof.height > 0, file.path);
      assert.match(proof.rgba_sha256 || proof.rgb_sha256, /^[a-f0-9]{64}$/);
      assert.ok(proof.metadata, `${file.path}: color and orientation metadata`);
    }
  }
  assert.ok(substitutions > 0);
});
