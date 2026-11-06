#!/usr/bin/env python3
"""Optimize JPEG entropy coding without recompression, resizing, or metadata loss.

Each unique source is tested with baseline and progressive jpegtran output. Only
the smallest candidate is eligible for replacement, and only after dimensions,
all APP/COM metadata, and the complete djpeg-decoded RGB stream match the source.
CMYK sources use matching deterministic baseline coefficient serialization,
since djpeg cannot convert CMYK JPEGs to RGB.
Byte-identical sources share optimization and verification work. Changed files
are backed up outside the repository before atomic replacement.

Dry run by default. Requires libjpeg-turbo's jpegtran and djpeg on PATH (or the
usual Homebrew paths), for example:
    python3 scripts/optimize-jpeg-assets.py --apply --workers 4
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def jpeg_structure(data: bytes) -> dict:
    """Inspect all marker segments, including those between progressive scans."""
    if not data.startswith(b"\xff\xd8"):
        raise ValueError("Not a JPEG SOI stream")
    position = 2
    metadata = []
    frame = None
    while position < len(data):
        marker_start = data.find(b"\xff", position)
        if marker_start < 0:
            break
        position = marker_start + 1
        while position < len(data) and data[position] == 0xFF:
            position += 1
        if position >= len(data):
            break
        marker = data[position]
        position += 1
        if marker == 0xD9:
            break
        if marker in (0x00, 0x01, 0xD8) or 0xD0 <= marker <= 0xD7:
            continue
        if position + 2 > len(data):
            raise ValueError("Truncated JPEG marker length")
        length = int.from_bytes(data[position:position + 2], "big")
        if length < 2 or position + length > len(data):
            raise ValueError("Truncated JPEG marker payload")
        payload = data[position + 2:position + length]
        if 0xE0 <= marker <= 0xEF or marker == 0xFE:
            metadata.append(bytes([marker]) + payload)
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            if len(payload) < 6:
                raise ValueError("Truncated JPEG frame")
            frame = {
                "precision": payload[0],
                "height": int.from_bytes(payload[1:3], "big"),
                "width": int.from_bytes(payload[3:5], "big"),
                "components": payload[5],
                "component_parameters": payload[6:].hex(),
            }
        position += length
    if frame is None:
        raise ValueError("JPEG frame marker missing")
    return {
        "frame": frame,
        "metadata": Counter(sha256(segment) for segment in metadata),
        "metadata_count": len(metadata),
    }


def decoded_rgb_digest(path: Path, djpeg: str) -> str:
    """Hash the entire PPM stream without holding a large bitmap in memory."""
    digest = hashlib.sha256()
    with tempfile.TemporaryFile() as errors:
        process = subprocess.Popen(
            [djpeg, "-strict", "-rgb", "-pnm", str(path)],
            stdout=subprocess.PIPE,
            stderr=errors,
        )
        assert process.stdout is not None
        size = 0
        while chunk := process.stdout.read(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
        process.stdout.close()
        return_code = process.wait()
        if return_code != 0 or size == 0:
            errors.seek(0)
            raise RuntimeError(
                f"djpeg failed ({return_code}): "
                f"{errors.read().decode(errors='replace').strip()}"
            )
    return digest.hexdigest()


def coefficient_digest(path: Path, jpegtran: str) -> str:
    """Canonical entropy serialization proves identical coefficients/tables.

Both inputs pass through the same lossless sequential encoder, without source
metadata. Identical output bytes prove identical quantized DCT coefficients and
quantization/component parameters; APP/COM metadata is checked separately.
    """
    process = subprocess.run(
        [jpegtran, "-copy", "none", "-optimize", str(path)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if process.returncode != 0 or not process.stdout:
        raise RuntimeError(
            f"Coefficient serialization failed ({process.returncode}): "
            f"{process.stderr.decode(errors='replace').strip()}"
        )
    return sha256(process.stdout)


def optimize_unique(source_hash: str, source: Path, work: Path,
                    jpegtran: str, djpeg: str) -> dict:
    started = time.monotonic()
    result = {"source_sha256": source_hash, "source": str(source)}
    try:
        original = source.read_bytes()
        if sha256(original) != source_hash:
            raise RuntimeError("Source changed after inventory; left untouched")
        structure = jpeg_structure(original)
        result.update({
            "before_bytes": len(original),
            "frame": structure["frame"],
            "metadata_count": structure["metadata_count"],
        })
        candidates = []
        for variant, flags in (("baseline", []), ("progressive", ["-progressive"])):
            output = work / f"{source_hash}-{variant}.jpg"
            process = subprocess.run(
                [jpegtran, "-copy", "all", "-optimize", *flags,
                 "-outfile", str(output), str(source)],
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                check=False,
            )
            if process.returncode != 0:
                raise RuntimeError(
                    f"jpegtran {variant} failed ({process.returncode}): "
                    f"{process.stderr.decode(errors='replace').strip()}"
                )
            candidates.append((output.stat().st_size, variant, output))
        result["candidate_bytes"] = {
            variant: size for size, variant, _ in candidates
        }
        size, variant, output = min(candidates, key=lambda candidate: candidate[0])
        if size >= len(original):
            result.update({"status": "unchanged", "after_bytes": len(original)})
            for _, _, candidate in candidates:
                candidate.unlink()
            return result
        optimized = output.read_bytes()
        output_structure = jpeg_structure(optimized)
        if structure["frame"] != output_structure["frame"]:
            raise RuntimeError("JPEG dimensions/component parameters changed")
        if structure["metadata"] != output_structure["metadata"]:
            raise RuntimeError("APP/COM metadata changed; output rejected")
        if structure["frame"]["components"] == 4:
            original_coefficients = coefficient_digest(source, jpegtran)
            optimized_coefficients = coefficient_digest(output, jpegtran)
            if original_coefficients != optimized_coefficients:
                raise RuntimeError("DCT coefficients changed; output rejected")
            verification = {"coefficient_sha256": original_coefficients,
                            "coefficients_preserved": True}
        else:
            original_rgb = decoded_rgb_digest(source, djpeg)
            optimized_rgb = decoded_rgb_digest(output, djpeg)
            if original_rgb != optimized_rgb:
                raise RuntimeError("Decoded RGB bytes changed; output rejected")
            verification = {"rgb_sha256": original_rgb, "rgb_equal": True}
        if sha256(source.read_bytes()) != source_hash:
            raise RuntimeError("Source changed during verification; left untouched")
        result.update({
            "status": "optimized",
            "after_bytes": size,
            "variant": variant,
            "output": str(output),
            "output_sha256": sha256(optimized),
            **verification,
            "metadata_preserved": True,
            "dimensions_preserved": True,
        })
        for _, _, candidate in candidates:
            if candidate != output:
                candidate.unlink()
    except Exception as error:
        result.update({"status": "error", "error": str(error)})
    finally:
        result["seconds"] = round(time.monotonic() - started, 6)
    return result


def executable(name: str) -> str:
    path = shutil.which(name)
    if path:
        return path
    homebrew = Path("/opt/homebrew/bin") / name
    if homebrew.is_file():
        return str(homebrew)
    raise SystemExit(f"Required executable not found: {name}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--report", type=Path)
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--retry-errors-from", type=Path,
                        help="Only retry error paths from an earlier JSON report")
    args = parser.parse_args()
    root = args.root.resolve()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = args.report or Path(f"/private/tmp/evolution-jpeg-report-{timestamp}.json")
    backup = args.backup_dir or Path(f"/private/tmp/evolution-jpeg-backup-{timestamp}")
    if backup.resolve().is_relative_to(root):
        raise SystemExit("Backup directory must be outside the repository")
    jpegtran = executable("jpegtran")
    djpeg = executable("djpeg")
    paths = sorted(
        path for path in root.rglob("*")
        if ".git" not in path.relative_to(root).parts
        and path.is_file() and not path.is_symlink()
        and path.suffix.lower() in (".jpg", ".jpeg")
    )
    if args.retry_errors_from:
        earlier = json.loads(args.retry_errors_from.read_text())
        if Path(earlier["root"]).resolve() != root:
            raise SystemExit("Retry report belongs to another repository")
        retry_paths = {row["path"] for row in earlier["files"] if row["status"] == "error"}
        paths = [path for path in paths if str(path.relative_to(root)) in retry_paths]
    groups = defaultdict(list)
    inventory = {}
    for path in paths:
        data = path.read_bytes()
        source_hash = sha256(data)
        groups[source_hash].append(path)
        inventory[path] = {"before_bytes": len(data), "source_sha256": source_hash}
    print(json.dumps({"event": "inventory", "files": len(paths),
                      "unique_sources": len(groups),
                      "bytes": sum(row["before_bytes"] for row in inventory.values())}),
          flush=True)
    started = time.monotonic()
    unique_results = {}
    rows = []
    with tempfile.TemporaryDirectory(prefix="evolution-jpeg-work-", dir="/private/tmp") as directory:
        work = Path(directory)
        with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
            tasks = {
                executor.submit(optimize_unique, source_hash, sources[0], work,
                                jpegtran, djpeg): source_hash
                for source_hash, sources in groups.items()
            }
            for number, future in enumerate(as_completed(tasks), start=1):
                source_hash = tasks[future]
                unique_results[source_hash] = future.result()
                if number % 50 == 0 or number == len(tasks):
                    print(json.dumps({"event": "progress", "unique_done": number,
                                      "unique_total": len(tasks),
                                      "seconds": round(time.monotonic() - started, 1)}),
                          flush=True)
        for path in paths:
            source_hash = inventory[path]["source_sha256"]
            result = unique_results[source_hash]
            row = {"path": str(path.relative_to(root)), **inventory[path],
                   "after_bytes": inventory[path]["before_bytes"],
                   "status": result["status"]}
            if result["status"] == "optimized":
                try:
                    if sha256(path.read_bytes()) != source_hash:
                        raise RuntimeError("File changed since inventory; left untouched")
                    row.update({key: result[key] for key in (
                        "after_bytes", "variant", "output_sha256", "rgb_sha256",
                        "rgb_equal", "coefficient_sha256", "coefficients_preserved",
                        "metadata_preserved", "dimensions_preserved", "frame"
                    ) if key in result})
                    if args.apply:
                        backup_path = backup / path.relative_to(root)
                        backup_path.parent.mkdir(parents=True, exist_ok=True)
                        if backup_path.exists():
                            if sha256(backup_path.read_bytes()) != source_hash:
                                raise RuntimeError("Backup already exists for another source; "
                                                   "choose a new backup directory")
                        else:
                            shutil.copy2(path, backup_path)
                        if sha256(backup_path.read_bytes()) != source_hash:
                            raise RuntimeError("Backup does not match source; left untouched")
                        descriptor, temporary = tempfile.mkstemp(
                            prefix=f".{path.stem}-jpeg-", suffix=path.suffix, dir=path.parent
                        )
                        os.close(descriptor)
                        temporary_path = Path(temporary)
                        try:
                            shutil.copyfile(result["output"], temporary_path)
                            shutil.copystat(path, temporary_path)
                            if sha256(temporary_path.read_bytes()) != result["output_sha256"]:
                                raise RuntimeError("Replacement copy hash mismatch")
                            if sha256(path.read_bytes()) != source_hash:
                                raise RuntimeError("Source changed before replacement; left untouched")
                            os.replace(temporary_path, path)
                        finally:
                            temporary_path.unlink(missing_ok=True)
                        row["backup"] = str(backup_path)
                    else:
                        row["status"] = "would_optimize"
                except Exception as error:
                    row.update({"status": "error", "error": str(error),
                                "after_bytes": inventory[path]["before_bytes"]})
            elif result["status"] == "error":
                row["error"] = result["error"]
            rows.append(row)
    before_bytes = sum(row["before_bytes"] for row in rows)
    after_bytes = sum(row["after_bytes"] for row in rows)
    summary = {
        "files": len(rows), "unique_sources": len(groups),
        "statuses": dict(Counter(row["status"] for row in rows)),
        "before_bytes": before_bytes, "after_bytes": after_bytes,
        "saved_bytes": before_bytes - after_bytes,
        "saved_percent": round(100 * (before_bytes - after_bytes) / before_bytes, 3)
                         if before_bytes else 0,
        "seconds": round(time.monotonic() - started, 3),
    }
    report = {"root": str(root), "timestamp_utc": timestamp, "apply": args.apply,
              "tools": {"jpegtran": jpegtran, "djpeg": djpeg},
              "backup_directory": str(backup) if args.apply else None,
              "validation": "jpegtran coefficient-preserving entropy optimization; "
                            "matching frame/APP/COM segments and full djpeg RGB SHA-256 "
                            "or deterministic baseline DCT serialization equality for CMYK",
              "summary": summary, "files": rows,
              "unique_results": [{key: value for key, value in result.items()
                                  if key != "output"}
                                 for result in unique_results.values()]}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"event": "complete", **summary, "report": str(report_path),
                      "backup": str(backup) if args.apply else None}), flush=True)
    return 1 if summary["statuses"].get("error") else 0


if __name__ == "__main__":
    raise SystemExit(main())
