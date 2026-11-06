"""Extract every hidden Illustrator layer without re-exporting JPG backgrounds.

Run with the bundled Python (pypdf) and Node 24+ (Zstandard). Source AI files
are read only. Art names and contour coordinates come from AI private data,
since the PDF preview contains only the layers visible at the last save.
The default command prints a preflight plan. --apply generates only into ignored
assets/sources/generated; runtime code and public images remain untouched.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import shutil
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE_AI = ROOT / "assets/sources/projects/tchaikovsky/illustrator/imported"
SOURCE_BACKGROUNDS = ROOT / "assets/sources/originals/projects/tchaikovsky/floors/backgrounds"
SOURCE_CATALOG = ROOT / "assets/sources/catalogs/before-production.json"
GENERATED = ROOT / "assets/sources/generated"
FLOORS = GENERATED / "images/projects/tchaikovsky/floors"
BACKGROUNDS = FLOORS / "backgrounds"
OVERLAYS = FLOORS / "overlays"
OUTPUT = FLOORS / "schemes"
METADATA = GENERATED / "data/projects/tchaikovsky/floors"
JS_OUTPUT = GENERATED / "js/apartments/tchaikovsky-floors.js"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
NODE = os.environ.get("TCHAIKOVSKY_NODE", "node")

SOURCES = {
    "apartments": ("apartments.ai", "apartments.svg"),
    "commercial": ("commercial.ai", "commercial.svg"),
    "parking": ("parking.ai", "parking.svg"),
}

# A/C and B use different floor names for the same physical level.
LEVELS = [
    {"id": "2100", "label": "P/NPᴮ", "floors": {"A": "P", "C": "P"}},
    {"id": "3100", "label": "1/VPᴮ", "floors": {"A": "1", "B": "VP", "C": "1"}},
    {"id": "3200", "label": "2/1ᴮ", "floors": {"A": "2", "B": "1", "C": "2"}},
    {"id": "3300", "label": "3/2ᴮ", "floors": {"A": "3", "B": "2", "C": "3"}},
    {"id": "3400", "label": "4/3ᴮ", "floors": {"A": "4", "B": "3", "C": "4"}},
    {"id": "3500", "label": "5/4ᴮ", "floors": {"A": "5", "B": "4", "C": "5"}},
    {"id": "3600", "label": "6/5ᴮ", "floors": {"A": "6", "B": "5", "C": "6"}},
    {"id": "3700", "label": "Ps/6ᴮ", "floors": {"A": "PS", "B": "6", "C": "PS"}},
    {"id": "3800", "label": "PSᴮ", "floors": {"B": "PS"}},
]


def svg_element(tag, attributes=None):
    return ET.Element(f"{{{SVG_NS}}}{tag}", attributes or {})


def illustrator_shapes(path):
    from pypdf import PdfReader

    reader = PdfReader(path)
    private = reader.pages[0]["/PieceInfo"]["/Illustrator"]["/Private"]
    blocks = sorted(
        (int(key.removeprefix("/AIPrivateData")), value.get_object().get_data())
        for key, value in private.items()
        if re.fullmatch(r"/AIPrivateData\d+", key)
    )
    encoded = b"".join(block for _, block in blocks)
    magic = encoded.find(b"\x28\xb5\x2f\xfd")
    if magic < 0:
        raise ValueError(f"Missing Illustrator Zstandard stream: {path}")
    decoded = subprocess.run(
        [NODE, "-e", "const z=require('node:zlib'),f=require('node:fs');"
         "process.stdout.write(z.zstdDecompressSync(f.readFileSync(0),"
         "{maxOutputLength:536870912}));"],
        input=encoded[magic:], capture_output=True, check=True,
    ).stdout
    box = re.search(rb"%%HiResBoundingBox: ([^\r\n]+)", decoded)
    left, bottom, right, top = map(float, box[1].split())
    # Raster payloads can contain newlines and arbitrary byte sequences.
    vectors = re.sub(rb"%AI5_BeginRaster.*?%AI5_EndRaster", b"", decoded, flags=re.S)
    del decoded
    layers, commands, pending, shapes = [], [], None, []
    for line in vectors.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if line == "%AI5_BeginLayer":
            layers.append("")
            pending, commands = None, []
        elif line == "%AI5_EndLayer--":
            layers.pop()
            pending, commands = None, []
        elif match := re.fullmatch(r"\((.*)\) Ln", line):
            layers[-1] = match[1]
        elif match := re.fullmatch(r"%_/XMLUID : \((.*?)\) ; \(AI10_ArtUID\) ,", line):
            if pending:
                pending["uid"] = match[1]
                shapes.append(pending)
                pending = None
        elif len(layers) >= 2:
            if match := re.fullmatch(r"([-\d.eE+ ]+) ([mlcvy])", line):
                commands.append((match[2], [float(n) for n in match[1].split()]))
            elif line in {"f", "F", "b", "B", "s", "S", "n", "N"}:
                if commands:
                    pending = {"layers": layers.copy(), "commands": commands, "paint": line}
                    commands = []
    return shapes, (left, top, right - left, top - bottom)


def decode_uid(uid):
    return re.sub(r"_x([0-9a-fA-F]{2,4})_", lambda m: chr(int(m[1], 16)), uid)


def unit_number(uid):
    decoded = decode_uid(uid).replace("А", "A")
    # Commercial A5-A7 have an upper part on 2100 as well as a lower part on 2000.
    if match := re.match(r"2000_A_(\d+)_level_2", decoded):
        return int(match[1])
    return int(re.match(r"\d+", decoded)[0])


def path_data(commands, origin):
    left, top, _, _ = origin
    output, current = [], None

    def point(x, y):
        return f"{x - left:.5f} {top - y:.5f}"

    for operator, numbers in commands:
        if operator in {"m", "l"}:
            output.append(f"{operator.upper()} {point(*numbers)}")
            current = numbers
        elif operator == "c":
            output.append("C " + " ".join(point(*numbers[i:i + 2]) for i in (0, 2, 4)))
            current = numbers[-2:]
        elif operator == "v":
            output.append("C " + " ".join([point(*current), point(*numbers[:2]), point(*numbers[2:])]))
            current = numbers[-2:]
        elif operator == "y":
            output.append("C " + " ".join([point(*numbers[:2]), point(*numbers[2:]), point(*numbers[2:])]))
            current = numbers[-2:]
    return " ".join(output) + " Z"


def write_svg(path, root):
    ET.indent(root, space="  ")
    path.write_text(ET.tostring(root, encoding="unicode") + "\n")


def background_for(level):
    path = SOURCE_BACKGROUNDS / f"level-{level}.jpg"
    if not path.is_file():
        raise FileNotFoundError(f"Missing canonical floor background: {path}")
    return path


def relative_href(path, parent):
    return Path(os.path.relpath(path, parent)).as_posix()


def scheme_paths(category, level):
    """Keep scheme metadata paths relative to the repository, not its manifest."""
    return {
        "source": (SOURCE_AI / SOURCES[category][0]).relative_to(ROOT).as_posix(),
        "image": display_path(BACKGROUNDS / background_for(level).name),
        "svg": display_path(OUTPUT / f"{category}-{level}.svg"),
    }


def display_path(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def generate():
    from pypdf import PdfReader

    baseline = json.loads(SOURCE_CATALOG.read_text())["catalogs"]["tchaikovsky"]
    if len(baseline) != 403:
        raise ValueError("The local source catalog must retain all 403 apartments")
    levels = {"1100", "1200", "1300", "1400", "2000"} | {row["id"] for row in LEVELS}
    backgrounds = [background_for(level) for level in sorted(levels)]
    for filename, _combined in SOURCES.values():
        if not (SOURCE_AI / filename).is_file():
            raise FileNotFoundError(SOURCE_AI / filename)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    OVERLAYS.mkdir(parents=True, exist_ok=True)
    BACKGROUNDS.mkdir(parents=True, exist_ok=True)
    METADATA.mkdir(parents=True, exist_ok=True)
    JS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    for background in backgrounds:
        shutil.copy2(background, BACKGROUNDS / background.name)
    inventory, ai_units = [], {}
    for category, (filename, combined_name) in SOURCES.items():
        source = SOURCE_AI / filename
        source_path = source.relative_to(ROOT).as_posix()
        shapes, origin = illustrator_shapes(source)
        _, _, width, height = origin
        # Illustrator HiResBoundingBox rounds a fractional page height upward.
        page = PdfReader(source).pages[0]
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        viewbox = f"0 0 {width:g} {height:g}"
        combined = svg_element("svg", {"viewBox": viewbox, "data-source-ai": source_path})
        levels = dict.fromkeys(shape["layers"][1] for shape in shapes)
        for index, level in enumerate(levels):
            paths = scheme_paths(category, level)
            background = BACKGROUNDS / background_for(level).name
            group = svg_element("g", {"id": f"_{level}", "data-level": level})
            group.append(svg_element("image", {
                "width": f"{width:g}", "height": f"{height:g}", "href": relative_href(background, OVERLAYS),
            }))
            count = 0
            units = {}
            for shape in shapes:
                if shape["layers"][1] != level:
                    continue
                number = unit_number(shape["uid"])
                wing = shape["layers"][2][0].replace("А", "A") if category != "parking" else ""
                unit = f"{wing}{number:02d}" if wing else str(number)
                units.setdefault(wing, []).append(unit)
                zone = svg_element("g", {"id": f"zone_{level}_{wing.lower() + '_' if wing else ''}{number}"})
                zone.append(svg_element("path", {
                    "d": path_data(shape["commands"], origin), "fill": "#1f244b", "opacity": "0.5",
                    "data-name": str(number), "data-unit": unit, "data-ai-uid": shape["uid"],
                }))
                group.append(zone)
                count += 1
                if category == "apartments":
                    if unit in ai_units:
                        raise ValueError(f"Duplicate apartment in AI: {unit}")
                    ai_units[unit] = level
            standalone = svg_element("svg", {"viewBox": viewbox, "data-source-ai": source_path})
            standalone.append(group)
            group.find(f"{{{SVG_NS}}}image").set("href", relative_href(background, OUTPUT))
            svg_name = f"{category}-{level}.svg"
            write_svg(OUTPUT / svg_name, standalone)
            group.find(f"{{{SVG_NS}}}image").set("href", relative_href(background, OVERLAYS))
            if index:
                group.set("style", "display:none")
            combined.append(group)
            inventory.append({
                "category": category, "level": level, "svg": paths["svg"],
                "source": paths["source"], "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "image": paths["image"], "contours": count, "units": units,
            })
        write_svg(OVERLAYS / combined_name, combined)

    for level in LEVELS:
        background = background_for(level["id"])
        # The canonical JPG remains the extraction reference; the runtime URL map
        # selects a verified smaller WebP where one is available.
        level["image"] = f"./assets/images/projects/tchaikovsky/floors/backgrounds/{background.name}"
        level["hasContours"] = any(s["category"] == "apartments" and s["level"] == level["id"] for s in inventory)
        level["units"] = {}
    assignments, changes = {}, []
    for apartment in baseline:
        unit = apartment["apartmentNumber"].removeprefix("STAN ")
        wing = unit[0]
        if unit in ai_units:
            level = next(row for row in LEVELS if row["id"] == ai_units[unit])
            evidence = "ai-contour"
        else:
            # The three upper levels are absent from the supplied AI. Retain
            # the existing official-table floor instead of guessing new ones.
            level = next(row for row in LEVELS if not row["hasContours"] and row["floors"].get(wing) == apartment.get("floorInWing", apartment["floor"]))
            evidence = "existing-apartment-table"
        floor = level["floors"][wing]
        assignments[unit] = {"floor": floor, "level": level["id"], "source": evidence}
        level["units"].setdefault(wing, []).append(unit)
        previous_floor = apartment.get("floorInWing", apartment["floor"])
        if floor != previous_floor:
            changes.append({"unit": unit, "before": previous_floor, "after": floor, "level": level["id"]})
    assert len(assignments) == 403 and len(ai_units) == 284
    assert sum(s["contours"] for s in inventory if s["category"] == "parking") == 525
    assert sum(s["contours"] for s in inventory if s["category"] == "commercial") == 31
    module = "// Generated by scripts/extract-tchaikovsky-schemes.py.\n"
    module += "// Upper floors retain existing official-table assignments; the AI contains 2100-3500 only.\n"
    module += "export const tchaikovskyFloorLevels = " + json.dumps(LEVELS, ensure_ascii=False, indent=2) + ";\n\n"
    module += "export const tchaikovskyFloorAssignments = Object.fromEntries(\n"
    module += "  tchaikovskyFloorLevels.flatMap((level) => Object.entries(level.units).flatMap(([wing, units]) =>\n"
    module += "    units.map((unit) => [unit, { floor: level.floors[wing], level: level.id, label: level.label }]),\n"
    module += "  )),\n);\n"
    JS_OUTPUT.write_text(module)
    report = {"schemes": inventory, "apartmentAssignments": assignments, "changes": changes,
              "aiVerifiedApartments": len(ai_units), "retainedUpperFloorApartments": len(assignments) - len(ai_units)}
    (METADATA / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"schemes": len(inventory), "aiVerified": len(ai_units), "retainedUpperFloors": 119, "changes": changes}, ensure_ascii=False))


def main():
    global GENERATED, FLOORS, BACKGROUNDS, OVERLAYS, OUTPUT, METADATA, JS_OUTPUT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Generate local staged outputs; never overwrite production")
    parser.add_argument("--output-dir", type=Path, default=GENERATED, help="Isolated staging root for images/data/js")
    args = parser.parse_args()
    GENERATED = args.output_dir.resolve()
    if GENERATED.is_relative_to(ROOT) and not GENERATED.is_relative_to(ROOT / "assets/sources/generated"):
        parser.error("Output inside the repository must be under ignored assets/sources/generated")
    FLOORS = GENERATED / "images/projects/tchaikovsky/floors"
    BACKGROUNDS, OVERLAYS, OUTPUT = (FLOORS / name for name in ("backgrounds", "overlays", "schemes"))
    METADATA = GENERATED / "data/projects/tchaikovsky/floors"
    JS_OUTPUT = GENERATED / "js/apartments/tchaikovsky-floors.js"
    if not args.apply:
        print(json.dumps({"dry_run": True, "source_ai": display_path(SOURCE_AI),
                          "source_backgrounds": display_path(SOURCE_BACKGROUNDS),
                          "source_catalog": display_path(SOURCE_CATALOG),
                          "staging_root": display_path(GENERATED), "production_modified": False}))
        return
    generate()


if __name__ == "__main__":
    main()
