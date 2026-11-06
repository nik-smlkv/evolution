#!/usr/bin/env python3
"""Create strictly smaller, pixel-exact WebP alternatives for repository JPEGs.

Original JPEGs are retained. CMYK and unsupported formats are skipped. Run with
the bundled Python (Pillow), installed cwebp and --apply to write alternatives.
The JSON URL map uses project-relative NFC paths. Encoding is hash-deduplicated
and resumable from a temporary cache; existing differing WebPs are never replaced.
"""

import argparse
import concurrent.futures
import hashlib
import json
import shutil
import subprocess
import time
import unicodedata
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CACHE = Path("/private/tmp/evolution-jpeg-webp-cache")
SETTINGS = ["-lossless", "-exact", "-metadata", "all", "-m", "4", "-q", "75"]
REFINED_SETTINGS = ["-lossless", "-exact", "-metadata", "all", "-m", "6", "-q", "100"]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def nfc(path):
    return unicodedata.normalize("NFC", path.as_posix())


def metadata(image):
    exif = image.info.get("exif", b"")
    if exif.startswith(b"Exif\x00\x00"):
        exif = exif[6:]
    xmp = image.info.get("xmp", b"")
    if isinstance(xmp, str):
        xmp = xmp.encode("utf-8")
    return {
        "icc_sha256": sha256(image.info.get("icc_profile", b"")),
        "exif_sha256": sha256(exif),
        "xmp_sha256": sha256(xmp),
        "orientation": image.getexif().get(274, 1),
    }


def image_proof(path):
    with Image.open(path) as image:
        if image.mode not in {"RGB", "RGBA", "L"}:
            raise ValueError("Unsupported color mode: " + image.mode)
        image.load()
        if image.mode == "RGBA" and image.getextrema()[3] != (255, 255):
            raise ValueError("Unexpected alpha channel in JPEG alternative")
        return {"width": image.width, "height": image.height,
                "rgb_sha256": sha256(image.convert("RGB").tobytes()),
                "metadata": metadata(image)}


def inspect(path):
    row = {"path": path, "relative": nfc(path.relative_to(ROOT)), "bytes": path.stat().st_size,
           "source_sha256": sha256(path.read_bytes())}
    try:
        with Image.open(path) as image:
            row.update(width=image.width, height=image.height, mode=image.mode)
            if image.format != "JPEG" or image.mode not in {"RGB", "L"} or getattr(image, "bits", 8) != 8:
                row.update(status="unsupported", warning=f"Preserved {image.format}/{image.mode} source")
    except Exception as error:
        row.update(status="unsupported", warning=str(error))
    return row


def encode(row, executable):
    CACHE.mkdir(parents=True, exist_ok=True)
    key = row["source_sha256"]
    result_path = CACHE / (key + ".json")
    output = CACHE / (key + ".webp")
    if result_path.exists():
        result = json.loads(result_path.read_text())
        if result.get("settings") in (SETTINGS, REFINED_SETTINGS) and result.get("status") != "warning" and (result.get("status") != "smaller" or output.exists()):
            result["cached"] = True
            return result
    started = time.monotonic()
    result = {"source_sha256": key, "source_bytes": row["bytes"], "settings": SETTINGS, "cached": False}
    try:
        command = [executable, *SETTINGS, "-quiet", str(row["path"]), "-o", str(output)]
        completed = subprocess.run(command, capture_output=True, timeout=600)
        if completed.returncode or not output.exists():
            raise ValueError(completed.stderr.decode(errors="replace")[:1000] or "cwebp did not create an output")
        result["fast_candidate_bytes"] = output.stat().st_size
        large_floor_background = row["path"].parent == ROOT / "plans" / "А3" and row["width"] * row["height"] >= 8_000_000
        if output.stat().st_size <= row["bytes"] * 1.05 or large_floor_background:
            refined = CACHE / (key + ".refined.webp")
            completed = subprocess.run([executable, *REFINED_SETTINGS, "-quiet", str(row["path"]), "-o", str(refined)], capture_output=True, timeout=600)
            if completed.returncode == 0 and refined.exists():
                result["refined_candidate_bytes"] = refined.stat().st_size
                if refined.stat().st_size < output.stat().st_size:
                    refined.replace(output)
                else:
                    refined.unlink()
            elif refined.exists():
                refined.unlink()
        result["candidate_bytes"] = output.stat().st_size
        if result["candidate_bytes"] >= row["bytes"]:
            result["status"] = "not_smaller"
            output.unlink()
        else:
            source_proof = image_proof(row["path"])
            target_proof = image_proof(output)
            if source_proof != target_proof:
                raise ValueError("Decoded pixels, dimensions, ICC, EXIF, XMP or orientation differ")
            result.update(status="smaller", proof=source_proof,
                          webp_sha256=sha256(output.read_bytes()),
                          bytes_saved=row["bytes"] - result["candidate_bytes"])
    except Exception as error:
        result.update(status="warning", warning=str(error))
        if output.exists():
            output.unlink()
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    result_path.write_text(json.dumps(result, indent=2) + "\n")
    return result


def select_benchmark(rows, count):
    # Distinct photographic, drawing, legacy thumbnail and large-plan surfaces.
    preferred = [
        "images/1.jpg", "images/gallery3.jpg", "images/main-img.jpg",
        "images/apartments-plans/Lamela_A/Level_1/A1_1.jpg",
        "plans/b/img/2.jpg", "plans/b/big/1.jpg", "plans/img/1.jpg",
        "А3/Lamela A/A01.jpg", "А3/Lamela B/B01.jpg",
        "plans/А3/3200 Osnova 2- Sprata (A,C)_1-Sprat (B).jpg",
    ]
    lookup = {row["relative"]: row for row in rows}
    selected = []
    seen = set()
    ordered = [lookup[name] for name in preferred if name in lookup] + sorted(rows, key=lambda row: row["bytes"], reverse=True)
    for row in ordered:
        if row["source_sha256"] not in seen:
            seen.add(row["source_sha256"])
            selected.append(row)
        if len(selected) == count:
            break
    return selected


def destination_for(row, encoded):
    desired = ROOT / unicodedata.normalize("NFC", str(row["path"].relative_to(ROOT).with_suffix(".webp")))
    choices = [desired, desired.with_name(desired.stem + ".optimized.webp")]
    number = 2
    while True:
        for candidate in choices:
            if not candidate.exists():
                return candidate, False
            if sha256(candidate.read_bytes()) == encoded["webp_sha256"]:
                return candidate, True
        choices = [desired.with_name(desired.stem + f".optimized-{number}.webp")]
        number += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--benchmark", type=int, help="Encode a diverse sample without changing repository files")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--report", type=Path, default=Path("/private/tmp/evolution-jpeg-webp-report.json"))
    parser.add_argument("--map", type=Path, default=Path("/private/tmp/evolution-jpeg-webp-map.json"))
    args = parser.parse_args()
    if args.benchmark and args.apply:
        parser.error("Benchmark is read-only; omit --apply")
    executable = shutil.which("cwebp")
    if not executable:
        parser.error("Install cwebp before running this script")
    started = time.monotonic()
    paths = sorted(path for path in ROOT.rglob("*") if path.suffix.lower() in {".jpg", ".jpeg"} and ".git" not in path.parts and "node_modules" not in path.parts)
    rows = [inspect(path) for path in paths]
    eligible = [row for row in rows if row.get("status") != "unsupported"]
    unique = {row["source_sha256"]: row for row in eligible}
    work = select_benchmark(list(unique.values()), args.benchmark) if args.benchmark else list(unique.values())
    results = {}
    report = {"applied": args.apply, "benchmark": args.benchmark,
              "settings": SETTINGS, "refined_settings": REFINED_SETTINGS,
              "refine_when": "Fast candidate <= 105% of JPEG bytes, or large floor-plan background",
              "workers": args.workers, "inventory": {
                  "files": len(rows), "bytes": sum(row["bytes"] for row in rows),
                  "eligible_files": len(eligible), "eligible_unique": len(unique),
                  "eligible_bytes": sum(row["bytes"] for row in eligible),
                  "modes": dict(Counter(row.get("mode", "unknown") for row in rows))},
              "encoding_results": [], "files": []}
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        pending = {pool.submit(encode, row, executable): row for row in work}
        for future in concurrent.futures.as_completed(pending):
            result = future.result()
            results[result["source_sha256"]] = result
            report["encoding_results"].append(result)
            report["elapsed_seconds"] = round(time.monotonic() - started, 3)
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            done = len(results)
            if done <= 10 or done % 25 == 0 or done == len(work):
                print(json.dumps({"completed_unique": done, "total_unique": len(work), "status": result["status"],
                                  "source": pending[future]["relative"], "elapsed_seconds": report["elapsed_seconds"]}, ensure_ascii=False), flush=True)
    mapping = {}
    for row in rows:
        entry = {key: value for key, value in row.items() if key != "path"}
        encoded = results.get(row["source_sha256"])
        if encoded:
            entry.update(status=encoded["status"], candidate_bytes=encoded.get("candidate_bytes"),
                         proof=encoded.get("proof"), warning=encoded.get("warning"))
            if encoded["status"] == "smaller":
                destination, reused = destination_for(row, encoded)
                if args.apply and not reused:
                    shutil.copyfile(CACHE / (row["source_sha256"] + ".webp"), destination)
                entry.update(webp=nfc(destination.relative_to(ROOT)), webp_sha256=encoded["webp_sha256"],
                             reused_existing=reused, saved=row["bytes"] - encoded["candidate_bytes"])
                mapping[row["relative"]] = entry["webp"]
        report["files"].append(entry)
    examined = [row for row in report["files"] if row.get("status") in {"smaller", "not_smaller", "warning"}]
    converted = [row for row in report["files"] if row.get("status") == "smaller"]
    report["totals"] = {
        "examined_files": len(examined), "encoded_unique": len(results),
        "smaller_unique": sum(result["status"] == "smaller" for result in results.values()),
        "converted_files": len(converted), "before_network_bytes": sum(row["bytes"] for row in examined),
        "after_network_bytes": sum(row["candidate_bytes"] if row.get("status") == "smaller" else row["bytes"] for row in examined),
        "saved_network_bytes": sum(row.get("saved", 0) for row in converted),
        "all_before_network_bytes": sum(row["bytes"] for row in rows),
        "all_after_network_bytes": sum(row["bytes"] for row in rows) - sum(row.get("saved", 0) for row in converted),
        "warnings": sum(row.get("status") in {"warning", "unsupported"} for row in report["files"]),
        "originals_retained": True,
    }
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    args.map.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"totals": report["totals"], "elapsed_seconds": report["elapsed_seconds"],
                      "report": str(args.report), "map": str(args.map)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
