"""Build registered upper-floor apartment outlines and interior marker positions.

Build dependency: Shapely (python -m pip install shapely); the website itself
does not need it. Illustrator level 3500 supplies the registered coordinate
system and boundaries shared by the upper floors. Recessed facades and merged
apartments are adjusted against the corresponding 3600/3700/3800 JPGs and the
individual apartment sheets. This does not modify the source AI or JPG files.
The default command is a read-only preflight. --apply writes only a local staged
JS module and never overwrites runtime code.
"""
import argparse
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET
from itertools import combinations

ROOT = Path(__file__).resolve().parents[1]
NS = {"s": "http://www.w3.org/2000/svg"}
SOURCE_OVERLAY = ROOT / "assets/sources/originals/projects/tchaikovsky/floors/overlays/apartments.svg"
STAGED_OUTPUT = ROOT / "assets/sources/generated/js/apartments/tchaikovsky-plan-markers.js"


def build(source_path, output_path):
    from shapely.geometry import Polygon, box
    from shapely.ops import polylabel, unary_union

    plan = ET.parse(source_path).getroot()
    reference = plan.find("s:g[@id='_3500']", NS)
    outlines = {}
    for shape in reference.iter():
        unit = shape.get("data-unit")
        if not unit:
            continue
        points = list(map(float, re.findall(r"-?\d+(?:\.\d+)?", shape.get("d"))))
        outlines[unit] = Polygon(zip(points[::2], points[1::2]))

    plans = {level: [] for level in ("3600", "3700", "3800")}


    def below(geometry, slope, intercept):
        """Clip at a facade line y <= slope * x + intercept in SVG coordinates."""
        return geometry.intersection(Polygon([
            (0, 0), (960, 0), (960, slope * 960 + intercept), (0, intercept),
        ]))


    def joined(parts):
        if len(parts) == 1:
            return parts[0]
        # Fill only the narrow former party-wall gap; preserve the exterior edges.
        return unary_union(parts).buffer(1.3, join_style=2).buffer(-1.3, join_style=2)


    def adjust(level, wing, number, geometry):
        if level == "3700" and wing == "A":
            if number == 119:
                # A119 includes the west dressing-room extension formerly in A86.
                extension = below(outlines["A86"], 0.31, 489.5)
                west_facade = Polygon([
                    (280.5, 0), (960, 0), (960, 758.4),
                    (280.5 - 0.31 * 758.4, 758.4),
                ])
                extension = extension.intersection(west_facade)
                geometry = joined([geometry, extension])
            if 120 <= number <= 127:
                geometry = below(geometry, 0.304, 548.0)
        if level == "3700" and wing == "C":
            if 113 <= number <= 115:
                geometry = geometry.intersection(box(0, 74, 960, 758.4))
            if number == 113:
                geometry = geometry.intersection(box(581.25, 0, 960, 758.4))
            if number == 116:
                geometry = geometry.intersection(box(0, 80.5, 960, 758.4))
            if 116 <= number <= 120:
                geometry = geometry.intersection(box(0, 0, 823.5, 758.4))
        if level == "3800" and wing == "B":
            if 135 <= number <= 139:
                geometry = below(geometry, -0.185, 807.6)
            if number == 135:
                geometry = below(geometry, 0.3125, 544.0)
            if 139 <= number <= 143:
                geometry = geometry.intersection(box(0, 0, 823, 758.4))
        assert geometry.geom_type == "Polygon" and geometry.is_valid
        assert geometry.area > 300 and not geometry.interiors
        return geometry


    def add(level, wing, start, references):
        for number, refs in enumerate(references, start):
            refs = [refs] if isinstance(refs, int) else refs
            geometry = adjust(level, wing, number, joined([outlines[f"{wing}{n}"] for n in refs]))
            # Use an interior pole rather than a bounding-box centre, which can lie
            # in the corridor for the concave corner apartments.
            marker = polylabel(geometry, tolerance=0.25)
            points = list(geometry.exterior.coords)[:-1]
            path = "M " + " L ".join(f"{x:.3f} {y:.3f}" for x, y in points) + " Z"
            plans[level].append({"unit": f"{wing}{number}", "d": path,
                "x": round(marker.x, 3), "y": round(marker.y, 3), "geometry": geometry})

    add("3600", "A", 100, range(83, 100))
    add("3600", "B", 91, range(71, 91))
    add("3600", "C", 96, range(81, 96))
    # The western apartment on the A recessed floor no longer exists separately.
    add("3700", "A", 117, [83, 84, 85, *range(87, 100)])
    add("3700", "B", 111, range(71, 91))
    # C117 occupies the former apartment/studio locations C87 and C88.
    add("3700", "C", 111, [81, 82, 83, 84, 85, 86, [87, 88], *range(89, 96)])
    # The B recessed floor combines two pairs on its south side and one on its east side.
    add("3800", "B", 131, [71, 72, 73, 74, 75, [76, 77], 78, [79, 80], 81,
                            [82, 83], 84, 85, 86, 87, 88, 89, 90])
    assert [len(v) for v in plans.values()] == [52, 50, 17]
    assert len({m["unit"] for group in plans.values() for m in group}) == 119
    for level, units in plans.items():
        for first, second in combinations(units, 2):
            overlap = first["geometry"].intersection(second["geometry"]).area
            assert overlap < 0.1, (level, first["unit"], second["unit"], overlap)
    markers = {level: [{k: v for k, v in unit.items() if k != "geometry"} for unit in units]
               for level, units in plans.items()}
    source = "// Generated by scripts/build-tchaikovsky-upper-markers.py.\n"
    source += "// Registered apartment outlines and interior markers, reviewed against upper-floor JPGs.\n"
    source += "export const tchaikovskyUpperFloorMarkers = " + json.dumps(markers, ensure_ascii=False, indent=2) + ";\n"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(source)
    print({level: len(points) for level, points in markers.items()})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE_OVERLAY)
    parser.add_argument("--output", type=Path, default=STAGED_OUTPUT)
    parser.add_argument("--apply", action="store_true", help="Build only the local staged JS module")
    args = parser.parse_args()
    source_path, output_path = args.source.resolve(), args.output.resolve()
    if not source_path.is_relative_to(ROOT / "assets/sources"):
        parser.error("Source overlay must come from ignored assets/sources")
    if output_path.is_relative_to(ROOT) and not output_path.is_relative_to(ROOT / "assets/sources/generated"):
        parser.error("Output inside the repository must be under ignored assets/sources/generated")
    if source_path == output_path:
        parser.error("Source and staging output must be separate")
    if not args.apply:
        print(json.dumps({"dry_run": True, "source": str(source_path), "staged_output": str(output_path),
                          "production_modified": False}))
        return
    build(source_path, output_path)


if __name__ == "__main__":
    main()
