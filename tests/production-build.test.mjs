import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/build-production.py", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), "evolution-production-test-"));
  const root = join(base, "project");
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const write = (path, bytes) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
  };
  const sources = {
    "index.html": '<link rel="stylesheet" href="./style/site.css?v=3"><script type="module" src="./js/main.js"></script><video><source src="./videos/site.mp4"></video><a href="./search-by-parameters/vivaldi/">Vivaldi</a>',
    "search-by-parameters.html": '<img src="./assets/images/plan.svg"><link rel="manifest" href="./assets/images/site.webmanifest"><a href="https://other.test/">External</a>',
    "search-by-parameters/tchaikovsky/index.html": '<meta http-equiv="refresh" content="0; url=../../search-by-parameters.html?house=tchaikovsky">',
    "search-by-parameters/vivaldi/index.html": '<meta http-equiv="refresh" content="0; url=../../search-by-parameters.html?house=vivaldi">',
    "style/site.css": '@font-face{src:url("../fonts/site.woff2")}body{background:url("data:image/svg+xml;base64,PHN2Zz4=")}',
    "fonts/site.woff2": "font bytes",
    "videos/site.mp4": "video bytes",
    "js/main.js": 'import "./details.js?v=7"; const house = {dataModule: "./data.js"}; import(house.dataModule);',
    "js/details.js": 'export const image = "./assets/images/tile.webp?v=2";',
    "js/data.js": 'export {default} from "./generated.js";',
    "js/generated.js": 'export default [{planImg:"./assets/images/plan.svg"}];',
    "assets/images/plan.svg": '<svg xmlns="http://www.w3.org/2000/svg" data-source-ai="assets/sources/original.ai"><image href="./tile.webp"/></svg>',
    "assets/images/tile.webp": "small image bytes",
    "assets/images/site.webmanifest": JSON.stringify({ icons: [{ src: "./icon.png", sizes: "192x192" }] }),
    "assets/images/icon.png": "icon bytes",
  };
  for (const [path, bytes] of Object.entries(sources)) write(path, bytes);
  const images = Object.entries(sources)
    .filter(([path]) => path.startsWith("assets/images/"))
    .map(([path, bytes]) => ({ path, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) }));
  write("assets/manifests/production-images.json", JSON.stringify({ files: images }));
  for (const path of ["assets/sources/original.png", "archive/unavailable.png", "tests/dev.test.mjs", "scripts/tool.py", "design-qa.md", "js/unused.js", "style/unused.css", ".git/config"]) write(path, "local only");
  return { root, base, write, images, sources };
}

function run(root, args = []) {
  return spawnSync("python3", ["-B", script, "--root", root, ...args], { encoding: "utf8" });
}

function generateHomeRoutes(root) {
  const result = spawnSync("python3", ["-B", "-c", "import sys; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from home_routes import generate_home_routes; generate_home_routes(Path(sys.argv[2]))", dirname(script), root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function files(directory, base = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path, base) : relative(base, path).split("\\").join("/");
  }).sort();
}

test("production build follows imports, fonts, video, SVG and manifest icons while excluding local files", (t) => {
  const { root, base, sources } = fixture(t);
  const output = join(base, "deploy");
  const result = run(root, ["--output", output]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(files(output), Object.keys(sources).sort());
  for (const [path, bytes] of Object.entries(sources)) assert.equal(hash(readFileSync(join(output, path))), hash(bytes), path);
  assert.equal(JSON.parse(result.stdout).files, Object.keys(sources).length);
});

test("configured home routes deploy with document-base dependencies and without development route config", (t) => {
  const { root, base, write, sources } = fixture(t);
  const additions = {
    "preview/index.html": `<link rel="stylesheet" href="./style/route.css">
      <base href="../"><base href="./ignored/">
      <a href="./contact/?utm_source=menu">Contact</a>
      <img src="./assets/images/tile.webp" srcset="./assets/images/tile.webp 1x, ./assets/images/tile.webp 2x">
      <video poster="./assets/images/tile.webp" src="./videos/route.mp4"></video>
      <video data-deferred-video preload="none"><source data-src="./videos/deferred.mp4?v=2"><source data-src="https://external.test/video.mp4"></video>
      <video data-src="./videos/deferred-direct.mp4" preload="none"></video>
      <div data-src="./assets/sources/original.png"></div>
      <meta property="og:image" content="./assets/images/tile.webp">
      <div style="background:url('./assets/images/tile.webp')"></div>
      <style>@import './style/inline.css'; @font-face{src:url('./fonts/inline.woff2')}</style>
      <script type="module" src="./js/route.js"></script>
      <script type="module">import './js/inline.js'; import('./js/dynamic.js');</script>`,
    "style/route.css": '@import "./nested/route.css";',
    "style/nested/route.css": '@font-face{src:url("../../fonts/route.woff2")}',
    "style/inline.css": "body{color:navy}",
    "fonts/route.woff2": "route font",
    "fonts/inline.woff2": "inline font",
    "videos/route.mp4": "route video",
    "videos/deferred.mp4": "deferred route video",
    "videos/deferred-direct.mp4": "direct deferred route video",
    "js/route.js": 'import "./nested/route.js";',
    "js/nested/route.js": 'export {default} from "../leaf.js";',
    "js/leaf.js": "export default 1;",
    "js/inline.js": "export default 2;",
    "js/dynamic.js": "export default 3;",
  };
  for (const [path, bytes] of Object.entries(additions)) write(path, bytes);
  sources["index.html"] = `<!doctype html><html><head><script type="module" src="./js/home-routes.js"></script></head><body>${sources["index.html"]}
    <main id="about-project">About project</main><section id="contact">Contact</section><section id="form">Callback</section>
    <a href="./about-project/">About project</a><a href="./preview/">Preview</a></body></html>`;
  write("index.html", sources["index.html"]);
  write("config/site-routes.json", JSON.stringify({ homeRoutes: {
    "about-project": "about-project", contact: "contact", "request-callback": "form",
  } }));
  generateHomeRoutes(root);
  for (const path of ["about-project/index.html", "contact/index.html", "request-callback/index.html", "js/home-routes.js"]) {
    additions[path] = readFileSync(join(root, path), "utf8");
  }
  const output = join(base, "deploy");
  const result = run(root, ["--output", output]);
  assert.equal(result.status, 0, result.stderr);
  const expected = { ...sources, ...additions };
  assert.deepEqual(files(output), Object.keys(expected).sort());
  for (const [path, bytes] of Object.entries(expected)) assert.equal(hash(readFileSync(join(output, path))), hash(bytes), path);
  assert.equal(existsSync(join(output, "config/site-routes.json")), false);
});

test("production builds reject missing or stale generated home routes", (t) => {
  const { root, write } = fixture(t);
  write("index.html", '<!doctype html><html><head></head><body><main id="contact">Contact</main></body></html>');
  write("config/site-routes.json", JSON.stringify({ homeRoutes: { contact: "contact" } }));
  generateHomeRoutes(root);
  rmSync(join(root, "contact/index.html"));
  const missing = run(root, ["--check"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /contact\/index\.html/);
  assert.match(missing.stderr, /generate-home-routes\.py/);
  generateHomeRoutes(root);
  write("index.html", '<!doctype html><html><head></head><body><main id="contact">Updated contact</main></body></html>');
  const stale = run(root, ["--check"]);
  assert.notEqual(stale.status, 0);
  assert.match(stale.stderr, /stale/i);
  assert.match(stale.stderr, /generate-home-routes\.py/);
});

test("production check is read-only and rejects missing or changed approved images", (t) => {
  const { root, base, write } = fixture(t);
  const output = join(base, "deploy");
  const good = run(root, ["--check", "--output", output]);
  assert.equal(good.status, 0, good.stderr);
  assert.equal(existsSync(output), false);
  write("assets/images/tile.webp", "changed bytes");
  const changed = run(root, ["--check"]);
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /integrity check failed/);
  rmSync(join(root, "assets/images/tile.webp"));
  const missing = run(root, ["--check"]);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /Missing production image/);
});

test("runtime images outside the allowlist and dependencies on archived sources block a build", (t) => {
  const { root, write } = fixture(t);
  write("assets/images/unreviewed.png", "unused image");
  write("js/details.js", 'export const image = "./assets/images/unreviewed.png";');
  const unreviewed = run(root, ["--check"]);
  assert.notEqual(unreviewed.status, 0);
  assert.match(unreviewed.stderr, /absent from the production allowlist/);
  write("js/details.js", "export default 1;");
  write("search-by-parameters.html", '<svg><image xlink:href="./assets/images/unreviewed.png"/></svg>');
  const inline = run(root, ["--check"]);
  assert.notEqual(inline.status, 0);
  assert.match(inline.stderr, /absent from the production allowlist/);
  write("search-by-parameters.html", "<main>Catalog</main>");
  write("js/details.js", 'import "../assets/sources/local.js";');
  write("assets/sources/local.js", "export default 1;");
  const archived = run(root, ["--check"]);
  assert.notEqual(archived.status, 0);
  assert.match(archived.stderr, /Non-production dependency/);
  write("js/details.js", "export default 1;");
  write("assets/sources/private.mp4", "source video");
  write("search-by-parameters.html", '<video data-deferred-video><source data-src="./assets/sources/private.mp4"></video>');
  const deferredArchived = run(root, ["--check"]);
  assert.notEqual(deferredArchived.status, 0);
  assert.match(deferredArchived.stderr, /Non-production dependency/);
});

test("production build never overwrites an existing nonempty output", (t) => {
  const { root, base } = fixture(t);
  const output = join(base, "deploy");
  mkdirSync(output);
  writeFileSync(join(output, "keep.txt"), "keep me");
  const result = run(root, ["--output", output]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Output must be absent or empty/);
  assert.deepEqual(files(output), ["keep.txt"]);
  assert.equal(readFileSync(join(output, "keep.txt"), "utf8"), "keep me");
});

test("production ZIP contains only exact runtime files and never copies Finder sidecars or overwrites an archive", (t) => {
  const { root, base, sources, write } = fixture(t);
  for (const path of [".DS_Store", "assets/images/.DS_Store", "js/.DS_Store", "archive/.DS_Store"]) write(path, "Finder metadata");
  const archive = join(base, "production.zip");
  const result = run(root, ["--archive", archive]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.mode, "archive");
  assert.equal(summary.archive, realpathSync(archive));
  assert.equal(existsSync(join(root, "dist")), false);
  const inspection = spawnSync("python3", ["-B", "-c", "import zipfile,hashlib,json,sys; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n:hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist()}))", archive], { encoding: "utf8" });
  assert.equal(inspection.status, 0, inspection.stderr);
  const archived = JSON.parse(inspection.stdout);
  assert.deepEqual(Object.keys(archived).sort(), Object.keys(sources).sort());
  for (const [path, bytes] of Object.entries(sources)) assert.equal(archived[path], hash(bytes), path);
  const before = hash(readFileSync(archive));
  assert.equal(summary.archive_sha256, before);
  const repeated = run(root, ["--archive", archive]);
  assert.notEqual(repeated.status, 0);
  assert.match(repeated.stderr, /Archive already exists/);
  assert.equal(hash(readFileSync(archive)), before);
  const incompatible = run(root, ["--check", "--archive", join(base, "other.zip")]);
  assert.notEqual(incompatible.status, 0);
  assert.equal(existsSync(join(base, "other.zip")), false);
});
