#!/usr/bin/env python3
"""Recompress PNG pixels losslessly while preserving all original metadata.

Requires Pillow. Only the IDAT chunks are replaced; IHDR, palettes, transparency,
ICC/gamma, EXIF, resolution and other chunks remain byte-for-byte unchanged.
Every candidate is decoded again and checked against the original pixel bytes.
Local originals are read only. --apply writes smaller verified candidates into
ignored assets/sources/generated; public assets are never replaced. Reports and
temporary encoding work stay outside the published website.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ProcessPoolExecutor, as_completed
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import struct
import time
import zlib

from PIL import Image

SIGNATURE = b"\x89PNG\r\n\x1a\n"


def chunks(data: bytes) -> list[tuple[bytes, bytes, bytes]]:
    if not data.startswith(SIGNATURE):
        raise ValueError("Not a PNG")
    result = []
    offset = len(SIGNATURE)
    while offset < len(data):
        if len(data) - offset < 12:
            raise ValueError("Truncated PNG chunk")
        size = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + size
        if end > len(data):
            raise ValueError("Truncated PNG payload")
        kind = data[offset + 4 : offset + 8]
        payload = data[offset + 8 : end - 4]
        checksum = struct.unpack_from(">I", data, end - 4)[0]
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != checksum:
            raise ValueError(f"Invalid CRC in {kind!r}")
        result.append((kind, payload, data[offset:end]))
        offset = end
        if kind == b"IEND":
            if offset != len(data):
                raise ValueError("Trailing data after IEND")
            break
    if not result or result[-1][0] != b"IEND":
        raise ValueError("Missing IEND")
    return result


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def replace_idat(original_chunks, compressed: bytes) -> bytes:
    result = [SIGNATURE]
    inserted = False
    for kind, _payload, raw in original_chunks:
        if kind == b"IDAT":
            if not inserted:
                result.append(png_chunk(b"IDAT", compressed))
                inserted = True
        else:
            result.append(raw)
    if not inserted:
        raise ValueError("Missing IDAT")
    return b"".join(result)


def pixel_signature(data: bytes):
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        return image.mode, image.size, image.tobytes(), image.getpalette()


def optimize_unique(path_text: str, source_hash: str, cache_directory: str):
    source_path = Path(path_text)
    original = source_path.read_bytes()
    result = {"source_hash": source_hash, "before": len(original)}
    try:
        original_chunks = chunks(original)
        if any(kind == b"acTL" for kind, _payload, _raw in original_chunks):
            return {**result, "status": "skipped_animated"}

        # Recompress the source's existing scanlines and compare them with a
        # fresh lossless adaptive-filter encoding; either can be the smaller.
        original_idat = b"".join(payload for kind, payload, _raw in original_chunks if kind == b"IDAT")
        scanlines = zlib.decompress(original_idat)
        best = original
        candidate = replace_idat(original_chunks, zlib.compress(scanlines, level=9))
        if len(candidate) < len(best):
            best = candidate

        original_pixels = pixel_signature(original)
        with Image.open(io.BytesIO(original)) as image:
            output = io.BytesIO()
            image.save(output, format="PNG", optimize=True, compress_level=9)
        encoded_chunks = chunks(output.getvalue())
        # Reusing IDAT requires the same color model, bit depth, interlacing,
        # palette and transparency indexing as the source.
        identity_types = {b"IHDR", b"PLTE", b"tRNS"}
        source_identity = [(kind, payload) for kind, payload, _raw in original_chunks if kind in identity_types]
        encoded_identity = [(kind, payload) for kind, payload, _raw in encoded_chunks if kind in identity_types]
        if source_identity == encoded_identity:
            encoded_idat = b"".join(payload for kind, payload, _raw in encoded_chunks if kind == b"IDAT")
            candidate = replace_idat(original_chunks, encoded_idat)
            if len(candidate) < len(best):
                best = candidate

        if best == original:
            return {**result, "status": "already_smaller", "after": len(original)}
        if pixel_signature(best) != original_pixels:
            raise ValueError("Decoded pixel mismatch")
        final_chunks = chunks(best)
        if [raw for kind, _payload, raw in final_chunks if kind != b"IDAT"] != [raw for kind, _payload, raw in original_chunks if kind != b"IDAT"]:
            raise ValueError("Non-IDAT metadata changed")

        cache_path = Path(cache_directory) / f"{source_hash}.png"
        cache_path.write_bytes(best)
        return {
            **result,
            "status": "optimized",
            "after": len(best),
            "result_hash": hashlib.sha256(best).hexdigest(),
            "cache_path": str(cache_path),
            "verified_pixels": True,
            "verified_metadata": True,
        }
    except Exception as error:
        return {**result, "status": "error", "error": str(error)}


def processing_paths(parser, args, root):
    """Read local originals and stage candidates; never overwrite public assets."""
    local = root / "assets/sources"
    requested = args.source_dir or [local / name for name in
                                    ("originals", "unavailable-apartments", "project-exports")]
    sources = [Path(path).resolve() for path in requested if Path(path).is_dir()]
    if not sources:
        parser.error("No local image sources; provide --source-dir under assets/sources")
    for source in sources:
        if (not source.is_relative_to(local) or source.is_relative_to(local / "generated")
                or (local / "generated").is_relative_to(source)):
            parser.error("Inputs must be local assets/sources originals, not generated/public assets")
    output = (args.output_dir or local / "generated/images").resolve()
    if output.is_relative_to(root) and not output.is_relative_to(local / "generated"):
        parser.error("Output inside the repository must be under ignored assets/sources/generated")
    if any(output.is_relative_to(source) or source.is_relative_to(output) for source in sources):
        parser.error("Input and staging output directories must be separate")
    for name in ("map", "report"):
        value = getattr(args, name, None)
        if value:
            target = Path(value).resolve()
            if target.is_relative_to(root) and not target.is_relative_to(local / "generated"):
                parser.error("Reports/maps inside the repository must stay in assets/sources/generated")
    return sorted(set(sources)), output


def staged_path(output, source, root):
    return output / source.relative_to(root / "assets/sources")


def display_path(path, root):
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1],
                        help="Repository root containing ignored assets/sources")
    parser.add_argument("--source-dir", type=Path, action="append", help="Local source directory; repeat to select several")
    parser.add_argument("--output-dir", type=Path, help="Separate staging directory; defaults to assets/sources/generated/images")
    parser.add_argument("--work-dir", type=Path, default=Path("/private/tmp/evolution-png-optimization"))
    parser.add_argument("--report", type=Path, default=Path("/private/tmp/evolution-png-report.json"))
    parser.add_argument("--jobs", type=int, default=4)
    parser.add_argument("--apply", action="store_true", help="Write smaller verified candidates to staging; source/public files stay unchanged")
    args = parser.parse_args()
    started = time.monotonic()
    root = args.root.resolve()
    source_dirs, output_dir = processing_paths(parser, args, root)
    cache = args.work_dir / "optimized"
    backup = args.work_dir / "originals"
    cache.mkdir(parents=True, exist_ok=True)
    backup.mkdir(parents=True, exist_ok=True)

    groups: dict[str, list[Path]] = {}
    for path in sorted({path for directory in source_dirs for path in directory.rglob("*")}):
        if path.is_file() and path.suffix.lower() == ".png" and ".git" not in path.relative_to(root).parts:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            groups.setdefault(digest, []).append(path)
    count = sum(len(paths) for paths in groups.values())
    print(f"Found {count} PNGs, {len(groups)} unique byte streams", flush=True)
    records = []
    with ProcessPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(optimize_unique, str(paths[0]), digest, str(cache)): (digest, paths)
            for digest, paths in groups.items()
        }
        for index, future in enumerate(as_completed(futures), 1):
            digest, paths = futures[future]
            result = future.result()
            if result["status"] == "optimized" and args.apply:
                original_data = paths[0].read_bytes()
                if hashlib.sha256(original_data).hexdigest() != digest:
                    raise RuntimeError(f"Source changed while optimizing: {paths[0]}")
                backup_path = backup / f"{digest}.png"
                if not backup_path.exists():
                    backup_path.write_bytes(original_data)
                optimized_data = Path(result["cache_path"]).read_bytes()
                for path in paths:
                    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                        raise RuntimeError(f"Source changed while optimizing: {path}")
                    destination = staged_path(output_dir, path, root)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    temporary = destination.with_name(destination.name + ".lossless-tmp")
                    temporary.write_bytes(optimized_data)
                    temporary.chmod(stat.S_IMODE(path.stat().st_mode))
                    os.replace(temporary, destination)
            for path in paths:
                records.append({"path": str(path.relative_to(root)),
                                "staged_output": display_path(staged_path(output_dir, path, root), root) if result["status"] == "optimized" else None,
                                **{key: value for key, value in result.items() if key != "cache_path"}})
            if index % 20 == 0 or index == len(futures):
                savings = sum(record["before"] - record.get("after", record["before"]) for record in records)
                print(f"Processed {index}/{len(futures)} unique PNGs; saved {savings / 1_000_000:.2f} MB", flush=True)

    summary = {
        "root": str(root),
        "applied": args.apply,
        "source_directories": [display_path(path, root) for path in source_dirs],
        "output_directory": display_path(output_dir, root),
        "sources_unchanged": True,
        "production_modified": False,
        "files": count,
        "unique_sources": len(groups),
        "optimized": sum(record["status"] == "optimized" for record in records),
        "before_bytes": sum(record["before"] for record in records),
        "after_bytes": sum(record.get("after", record["before"]) for record in records),
        "errors": [record for record in records if record["status"] == "error"],
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "backup_directory": str(backup),
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({"summary": summary, "files": records}, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
