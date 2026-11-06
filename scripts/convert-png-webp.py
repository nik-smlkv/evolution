#!/usr/bin/env python3
"""Create smaller, pixel-exact WebP alternatives without replacing PNG sources.

Requires Pillow and cwebp. ICC, EXIF, XMP and orientation are verified after
encoding. Standard PNG sRGB/gamma/chromaticity semantics are safe for WebP's
default sRGB space; unfamiliar color metadata and animated PNGs are retained.
Non-rendering PNG text/resolution metadata remains in each original PNG.
Dry-run is the default; --apply writes only verified smaller alternatives.
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
CACHE = Path("/private/tmp/evolution-png-webp-cache")
SETTINGS = ["-lossless", "-exact", "-metadata", "all", "-m", "4", "-q", "75"]
REFINED_SETTINGS = ["-lossless", "-exact", "-metadata", "all", "-m", "6", "-q", "100"]
SRGB_CHROMATICITY = (0.3127, 0.329, 0.64, 0.33, 0.3, 0.6, 0.15, 0.06)
PROOF_VERSION = 1


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def nfc(path):
    return unicodedata.normalize("NFC", path.as_posix())


def chunk_types(data):
    offset = 8
    while offset + 12 <= len(data):
        length = int.from_bytes(data[offset:offset + 4], "big")
        yield data[offset + 4:offset + 8]
        offset += length + 12


def metadata(image):
    exif = image.info.get("exif", b"")
    if exif.startswith(b"Exif\x00\x00"):
        exif = exif[6:]
    xmp = image.info.get("xmp", image.info.get("XML:com.adobe.xmp", b""))
    raw_profile = image.info.get("Raw profile type xmp")
    if not xmp and raw_profile:
        lines = raw_profile.splitlines()
        try:
            index = next(i for i, line in enumerate(lines) if line.strip().isdigit())
            length = int(lines[index].strip())
            xmp = bytes.fromhex("".join(lines[index + 1:]))
            if len(xmp) != length:
                raise ValueError("Invalid XMP profile length")
        except (StopIteration, ValueError) as error:
            raise ValueError("Unrecognized raw XMP profile") from error
    if isinstance(xmp, str):
        xmp = xmp.encode("utf-8")
    return {"icc": image.info.get("icc_profile", b""), "exif": exif,
            "xmp": xmp, "orientation": image.getexif().get(274, 1)}


def image_proof(path):
    with Image.open(path) as image:
        image.load()
        payloads = metadata(image)
        return {"width": image.width, "height": image.height,
                "rgba_sha256": sha256(image.convert("RGBA").tobytes()),
                "metadata": {name + "_sha256": sha256(value)
                             for name, value in payloads.items() if name != "orientation"},
                "orientation": payloads["orientation"]}


def inspect(path):
    data = path.read_bytes()
    row = {"path": path, "relative": nfc(path.relative_to(ROOT)), "bytes": len(data),
           "source_sha256": sha256(data)}
    try:
        with Image.open(path) as image:
            row.update(width=image.width, height=image.height, mode=image.mode)
            if image.format != "PNG" or data[24] != 8:
                raise ValueError("Retained non-8-bit PNG source")
            if getattr(image, "is_animated", False):
                raise ValueError("Retained animated PNG source")
            if b"orNT" in set(chunk_types(data)):
                raise ValueError("Retained PNG with private orientation metadata")
            metadata(image)
            if not image.info.get("icc_profile"):
                gamma = image.info.get("gamma")
                if gamma is not None and abs(gamma - 0.45455) > 0.00001:
                    raise ValueError("Retained non-sRGB PNG gamma")
                chromaticity = image.info.get("chromaticity")
                if chromaticity and any(abs(a - b) > 0.00001 for a, b in zip(chromaticity, SRGB_CHROMATICITY)):
                    raise ValueError("Retained unfamiliar PNG chromaticity")
                if image.info.get("srgb", 0) != 0:
                    raise ValueError("Retained non-default PNG sRGB rendering intent")
            row["color_semantics"] = "embedded ICC" if image.info.get("icc_profile") else "standard sRGB"
    except Exception as error:
        row.update(status="unsupported", warning=str(error))
    return row


def preserve_metadata(source, candidate, executable):
    with Image.open(source) as image:
        expected = metadata(image)
    with Image.open(candidate) as image:
        actual = metadata(image)
    for name in ("icc", "exif", "xmp"):
        if expected[name] == actual[name]:
            continue
        if not expected[name]:
            raise ValueError("Encoder added unexpected " + name + " metadata")
        if not executable:
            raise ValueError("webpmux needed to preserve " + name + " metadata")
        payload = candidate.with_suffix("." + name)
        combined = candidate.with_suffix(".mux.webp")
        payload.write_bytes(expected[name])
        try:
            result = subprocess.run([executable, "-set", name, str(payload), str(candidate),
                                     "-o", str(combined)], capture_output=True, timeout=60)
            if result.returncode:
                raise ValueError(result.stderr.decode(errors="replace")[:1000])
            combined.replace(candidate)
        finally:
            payload.unlink(missing_ok=True)
            combined.unlink(missing_ok=True)


def encode(row, executable, mux_executable):
    CACHE.mkdir(parents=True, exist_ok=True)
    key = row["source_sha256"]
    result_path = CACHE / (key + ".json")
    output = CACHE / (key + ".webp")
    if result_path.exists():
        cached = json.loads(result_path.read_text())
        needs_refinement = row.get("refine", False) or cached.get("candidate_bytes", 0) >= row["bytes"] * 0.95
        if (cached.get("settings") in (SETTINGS, REFINED_SETTINGS) and cached.get("proof_version") == PROOF_VERSION
                and cached.get("status") != "warning"
                and (cached.get("settings") == REFINED_SETTINGS or not needs_refinement or cached.get("refinement_attempted"))
                and (cached.get("status") != "smaller" or
                     (output.exists() and sha256(output.read_bytes()) == cached.get("webp_sha256")))):
            return {**cached, "cached": True}
    started = time.monotonic()
    result = {"source_sha256": key, "source_bytes": row["bytes"], "settings": SETTINGS,
              "proof_version": PROOF_VERSION, "cached": False}
    try:
        if sha256(row["path"].read_bytes()) != key:
            raise ValueError("PNG source changed after inventory")
        completed = subprocess.run([executable, *SETTINGS, "-quiet", str(row["path"]),
                                    "-o", str(output)], capture_output=True, timeout=600)
        if completed.returncode or not output.exists():
            raise ValueError(completed.stderr.decode(errors="replace")[:1000] or "No WebP output")
        preserve_metadata(row["path"], output, mux_executable)
        result["fast_candidate_bytes"] = output.stat().st_size
        if row.get("refine", False) or output.stat().st_size >= row["bytes"] * 0.95:
            result["refinement_attempted"] = True
            refined = output.with_suffix(".refined.webp")
            completed = subprocess.run([executable, *REFINED_SETTINGS, "-quiet", str(row["path"]),
                                       "-o", str(refined)], capture_output=True, timeout=600)
            if completed.returncode == 0 and refined.exists():
                preserve_metadata(row["path"], refined, mux_executable)
                result["refined_candidate_bytes"] = refined.stat().st_size
                if refined.stat().st_size < output.stat().st_size:
                    refined.replace(output)
                    result["settings"] = REFINED_SETTINGS
                else:
                    refined.unlink()
            else:
                result["refinement_warning"] = completed.stderr.decode(errors="replace")[:1000] or "No refined output"
                refined.unlink(missing_ok=True)
        result["candidate_bytes"] = output.stat().st_size
        if result["candidate_bytes"] >= row["bytes"]:
            result["status"] = "not_smaller"
            output.unlink()
        else:
            source_proof = image_proof(row["path"])
            if source_proof != image_proof(output):
                raise ValueError("Decoded RGBA, dimensions, ICC, EXIF, XMP or orientation differ")
            result.update(status="smaller", proof=source_proof,
                          webp_sha256=sha256(output.read_bytes()),
                          bytes_saved=row["bytes"] - result["candidate_bytes"])
    except Exception as error:
        result.update(status="warning", warning=str(error))
        output.unlink(missing_ok=True)
    result["elapsed_seconds"] = round(time.monotonic() - started, 3)
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    return result


def select_benchmark(rows, count):
    # Include photography, transparent art, palette transparency, XMP and plans.
    names = ["images/parking.png", "images/moving-img.png", "videos/preview-video.png",
             "images/comerrical-plug.png", "images/apartments-plans/apartment/4.png",
             "plans/А3/parking-plug.png", "plans/А3/Lamela A/Lamela_A_2D/Level_3/A34.png",
             "А3/Lamela A/Lamela_A_2D/Level_1/A3.png"]
    lookup = {row["relative"]: row for row in rows}
    ordered = [lookup[name] for name in names if name in lookup] + sorted(rows, key=lambda row: row["bytes"], reverse=True)
    selected = []
    seen = set()
    for row in ordered:
        if row["source_sha256"] not in seen:
            seen.add(row["source_sha256"])
            selected.append(row)
        if len(selected) == count:
            break
    return selected


def destination_for(row, encoded):
    desired = ROOT / unicodedata.normalize("NFC", str(row["path"].relative_to(ROOT).with_suffix(".webp")))
    candidates = [desired, desired.with_name(desired.stem + ".png.webp")]
    number = 2
    while True:
        for candidate in candidates:
            if not candidate.exists():
                return candidate, False
            # Never overwrite a JPEG variant or any different existing image.
            if sha256(candidate.read_bytes()) == encoded["webp_sha256"]:
                return candidate, True
            try:
                if candidate.stat().st_size <= encoded["candidate_bytes"] and image_proof(candidate) == encoded["proof"]:
                    return candidate, True
            except Exception:
                pass
        candidates = [desired.with_name(desired.stem + f".png-{number}.webp")]
        number += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--benchmark", type=int, help="Encode a diverse sample without changing repository files")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--report", type=Path, default=Path("/private/tmp/evolution-png-webp-report.json"))
    parser.add_argument("--map", type=Path, default=Path("/private/tmp/evolution-png-webp-map.json"))
    args = parser.parse_args()
    if args.benchmark is not None and (args.benchmark <= 0 or args.apply):
        parser.error("Benchmark needs a positive count and cannot be combined with --apply")
    executable = shutil.which("cwebp")
    if not executable:
        parser.error("Install cwebp before running this script")
    started = time.monotonic()
    paths = sorted(path for path in ROOT.rglob("*") if path.suffix.lower() == ".png"
                   and ".git" not in path.parts and "node_modules" not in path.parts)
    rows = [inspect(path) for path in paths]
    eligible = [row for row in rows if row.get("status") != "unsupported"]
    unique = {row["source_sha256"]: row for row in eligible}
    remaining = []
    for row in unique.values():
        cached_path = CACHE / (row["source_sha256"] + ".json")
        cached = json.loads(cached_path.read_text()) if cached_path.exists() else {}
        if cached.get("settings") != REFINED_SETTINGS or cached.get("status") == "warning":
            remaining.append(row)
    for row in sorted(remaining, key=lambda item: item["bytes"], reverse=True)[:24]:
        row["refine"] = True
    work = select_benchmark(list(unique.values()), args.benchmark) if args.benchmark else list(unique.values())
    results = {}
    report = {"applied": args.apply, "benchmark": args.benchmark, "settings": SETTINGS,
              "refined_settings": REFINED_SETTINGS,
              "refine_when": "Candidate >= 95% of PNG bytes, plus the 24 largest not already encoded with strongest settings",
              "workers": max(1, args.workers), "inventory": {
                  "files": len(rows), "bytes": sum(row["bytes"] for row in rows),
                  "eligible_files": len(eligible), "eligible_unique": len(unique),
                  "eligible_bytes": sum(row["bytes"] for row in eligible),
                  "modes": dict(Counter(row.get("mode", "unknown") for row in rows))},
              "encoding_results": [], "files": []}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.map.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"inventory": report["inventory"], "encoding_unique": len(work)}, ensure_ascii=False), flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        pending = {pool.submit(encode, row, executable, shutil.which("webpmux")): row for row in work}
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
                actual_bytes = destination.stat().st_size if reused else encoded["candidate_bytes"]
                entry.update(webp=nfc(destination.relative_to(ROOT)),
                             webp_sha256=sha256(destination.read_bytes()) if reused else encoded["webp_sha256"],
                             webp_bytes=actual_bytes, reused_existing=reused, saved=row["bytes"] - actual_bytes)
                mapping[row["relative"]] = entry["webp"]
        report["files"].append(entry)
    converted = [row for row in report["files"] if row.get("status") == "smaller"]
    report["totals"] = {"encoded_unique": len(results),
        "smaller_unique": sum(result["status"] == "smaller" for result in results.values()),
        "converted_files": len(converted), "reused_variants": sum(row.get("reused_existing", False) for row in converted),
        "before_network_bytes": sum(row["bytes"] for row in rows),
        "after_network_bytes": sum(row["bytes"] for row in rows) - sum(row.get("saved", 0) for row in converted),
        "saved_network_bytes": sum(row.get("saved", 0) for row in converted),
        "warnings": sum(row.get("status") in {"warning", "unsupported"} for row in report["files"]),
        "originals_retained": True}
    report["elapsed_seconds"] = round(time.monotonic() - started, 3)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    args.map.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"totals": report["totals"], "elapsed_seconds": report["elapsed_seconds"],
                      "report": str(args.report), "map": str(args.map)}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
