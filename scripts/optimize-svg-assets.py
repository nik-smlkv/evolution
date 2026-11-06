#!/usr/bin/env python3
"""Losslessly compact SVGs and their embedded rasters without changing SVG IDs.

Run with the bundled Python environment (Pillow and lxml are required). A dry run
is the default; --apply writes only smaller, verified results and backs up every
changed SVG outside the repository. No path precision or render nodes change.
"""

import argparse
import base64
import hashlib
import io
import json
import shutil
import struct
import tempfile
import zlib
from pathlib import Path

from lxml import etree
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CACHE = Path("/private/tmp/evolution-svg-raster-cache")
TEXT_TAGS = {"text", "tspan", "textPath", "style", "script", "foreignObject"}
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def png_chunks(data):
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError("Invalid PNG signature")
    chunks = []
    position = len(PNG_SIGNATURE)
    while position < len(data):
        length = struct.unpack_from(">I", data, position)[0]
        end = position + 12 + length
        encoded = data[position:end]
        kind = encoded[4:8]
        payload = encoded[8:-4]
        if len(encoded) != length + 12:
            raise ValueError("Truncated PNG chunk")
        if zlib.crc32(kind + payload) & 0xFFFFFFFF != struct.unpack(">I", encoded[-4:])[0]:
            raise ValueError("Invalid PNG CRC")
        chunks.append((kind, payload, encoded))
        position = end
    return chunks


def encode_png_chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)


def replace_png_idat(original, replacement):
    """Retain every original color/profile/metadata chunk byte for byte."""
    result = [PNG_SIGNATURE]
    inserted = False
    for kind, _payload, encoded in png_chunks(original):
        if kind == b"IDAT":
            if not inserted:
                result.append(encode_png_chunk(kind, replacement))
                inserted = True
        else:
            result.append(encoded)
    return b"".join(result)


def raster_signature(data):
    image = Image.open(io.BytesIO(data))
    image.load()
    # Exact samples are compared, including RGB under fully transparent pixels.
    result = (image.format, image.mode, image.size, digest(image.tobytes()))
    if image.format == "PNG":
        result += (tuple((kind.decode("ascii"), digest(encoded)) for kind, _payload, encoded in png_chunks(data) if kind != b"IDAT"),)
    else:
        # jpegtran -copy all also retains original APP/COM marker contents.
        result += (image.info,)
    return result


def optimize_png(data):
    chunks = png_chunks(data)
    compressed = b"".join(payload for kind, payload, _encoded in chunks if kind == b"IDAT")
    filtered = zlib.decompress(compressed)
    candidates = [data]
    for strategy in (zlib.Z_DEFAULT_STRATEGY, zlib.Z_FILTERED):
        compressor = zlib.compressobj(9, zlib.DEFLATED, 15, 9, strategy)
        candidates.append(replace_png_idat(data, compressor.compress(filtered) + compressor.flush()))
    image = Image.open(io.BytesIO(data))
    image.load()
    candidate = io.BytesIO()
    image.save(candidate, format="PNG", optimize=True, compress_level=9)
    candidate_chunks = png_chunks(candidate.getvalue())
    original_ihdr = next(payload for kind, payload, _encoded in chunks if kind == b"IHDR")
    candidate_ihdr = next(payload for kind, payload, _encoded in candidate_chunks if kind == b"IHDR")
    if original_ihdr == candidate_ihdr:
        payload = b"".join(payload for kind, payload, _encoded in candidate_chunks if kind == b"IDAT")
        candidates.append(replace_png_idat(data, payload))
    return min(candidates, key=len)


def optimize_jpeg(data):
    # Keep embedded JPEG bytes intact. Even coefficient-lossless Huffman/scan
    # rewrites can change native SVG renderer decoding/rounding decisions.
    return data


def optimize_raster(data, mime):
    if mime in {"image/jpeg", "image/jpg"}:
        return optimize_jpeg(data)
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE / (digest(data) + ".raster")
    if cache_file.exists():
        optimized = cache_file.read_bytes()
    else:
        optimized = optimize_png(data) if mime == "image/png" else optimize_jpeg(data) if mime in {"image/jpeg", "image/jpg"} else data
    before = raster_signature(data)
    after = raster_signature(optimized)
    if before != after:
        raise ValueError("Embedded raster pixels, encoding mode or color metadata changed")
    if len(optimized) > len(data):
        raise ValueError("Embedded raster increased in size")
    cache_file.write_bytes(optimized)
    return optimized


def parse_svg(data):
    return etree.fromstring(data, etree.XMLParser(remove_blank_text=False, remove_comments=False, resolve_entities=False, no_network=True))


def strip_formatting(element, preserve=False):
    if not isinstance(element.tag, str):
        return
    local = etree.QName(element).localname
    preserve = preserve or local in TEXT_TAGS or element.get(XML_SPACE) == "preserve"
    if not preserve and element.text is not None and not element.text.strip():
        element.text = None
    for child in list(element):
        if isinstance(child, etree._Comment):
            # Comments cannot render; preserve any following meaningful text.
            if child.tail and (preserve or child.tail.strip()):
                previous = child.getprevious()
                if previous is None:
                    element.text = (element.text or "") + child.tail
                else:
                    previous.tail = (previous.tail or "") + child.tail
            element.remove(child)
            continue
        strip_formatting(child, preserve)
        if not preserve and child.tail is not None and not child.tail.strip():
            child.tail = None


def semantic_svg(data):
    root = parse_svg(data)
    strip_formatting(root)
    embedded = []
    for element in root.iter():
        for key, value in list(element.attrib.items()):
            if value.startswith("data:image/") and ";base64," in value:
                header, encoded = value.split(",", 1)
                raw = base64.b64decode(encoded)
                signature = raster_signature(raw)
                # Pixel equality and metadata equality are checked separately.
                embedded.append(signature)
                element.set(key, header + ",VERIFIED_EMBEDDED_RASTER")
    canonical = etree.tostring(root, method="c14n", with_comments=False)
    return canonical, embedded


def optimize_svg(data):
    root = parse_svg(data)
    rasters = []
    for element in root.iter():
        for key, value in list(element.attrib.items()):
            if value.startswith("data:image/") and ";base64," in value:
                header, encoded = value.split(",", 1)
                mime = header[5:].split(";", 1)[0]
                raw = base64.b64decode(encoded)
                optimized = optimize_raster(raw, mime)
                if optimized != raw:
                    element.set(key, header + "," + base64.b64encode(optimized).decode("ascii"))
                rasters.append({"mime": mime, "before": len(raw), "after": len(optimized), "pixels_identical": True, "color_metadata_identical": True})
    strip_formatting(root)
    output = etree.tostring(root, encoding="utf-8", xml_declaration=False, pretty_print=False)
    # Serializer choices that increase size are never written.
    if len(output) >= len(data):
        output = data
    if semantic_svg(data) != semantic_svg(output):
        raise ValueError("SVG render nodes, text, attribute values or raster pixels changed")
    return output, rasters


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--sample-count", type=int, help="Benchmark only the largest N SVGs")
    parser.add_argument("--report", type=Path, default=Path("/private/tmp/evolution-svg-report.json"))
    args = parser.parse_args()
    files = sorted(ROOT.rglob("*.svg"))
    files = [path for path in files if ".git" not in path.parts and "node_modules" not in path.parts]
    if args.sample_count:
        files = sorted(files, key=lambda path: path.stat().st_size, reverse=True)[:args.sample_count]
    backup = Path(tempfile.mkdtemp(prefix="evolution-svg-backup-", dir="/private/tmp")) if args.apply else None
    report = {"applied": args.apply, "backup_directory": str(backup) if backup else None, "files": []}
    for path in files:
        original = path.read_bytes()
        optimized, rasters = optimize_svg(original)
        entry = {"path": str(path.relative_to(ROOT)), "before": len(original), "after": len(optimized), "saved": len(original) - len(optimized), "semantic_equality": True, "embedded_rasters": rasters}
        if args.apply and optimized != original:
            backup_path = backup / path.relative_to(ROOT)
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup_path)
            path.write_bytes(optimized)
        report["files"].append(entry)
        args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
        print(json.dumps(entry, ensure_ascii=False), flush=True)
    report["totals"] = {name: sum(entry[name] for entry in report["files"]) for name in ("before", "after", "saved")}
    report["totals"]["files"] = len(files)
    report["totals"]["changed"] = sum(entry["saved"] > 0 for entry in report["files"])
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"report": str(args.report), "totals": report["totals"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
