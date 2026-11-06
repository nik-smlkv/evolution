#!/usr/bin/env python3
"""Validate runtime files and create a fresh deployment folder or exact ZIP.

The reviewed image manifest is the image allowlist. HTML entry points and their
local CSS/JavaScript/font/video dependencies form the remaining dependency graph.
Source artwork, archives, developer tools and reports never enter the output.
Existing nonempty output folders are refused; this command deletes no files.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import zipfile
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


DEFAULT_ROOT = Path(__file__).resolve().parents[1]
ENTRY_POINTS = (
    "index.html",
    "search-by-parameters.html",
    "search-by-parameters/tchaikovsky/index.html",
    "search-by-parameters/vivaldi/index.html",
)
IMAGE_MANIFEST = "assets/manifests/production-images.json"
IMAGE_PREFIX = "assets/images/"
FORBIDDEN_PREFIXES = (
    ".git/", ".codex/", ".agents/", "archive/", "assets/sources/",
    "assets/data/", "assets/manifests/", "scripts/", "tests/", "dist/",
)
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg", ".ico", ".webmanifest"}
RUNTIME_EXTENSIONS = IMAGE_EXTENSIONS | {".html", ".css", ".js", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm", ".ogg"}
CSS_URL = re.compile(r"url\(\s*['\"]?([^\s)'\"]+)", re.IGNORECASE)
CSS_IMPORT = re.compile(r"@import\s+['\"]([^'\"]+)['\"]", re.IGNORECASE)
MODULE_IMPORT = re.compile(r"(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['\"]((?:\.\.?/)[^'\"]+)['\"]")
DYNAMIC_DATASET = re.compile(r"\bdataModule\s*:\s*['\"]([^'\"]+)['\"]")
DOCUMENT_IMAGE = re.compile(r"['\"`]((?:\./|/)?assets/images/[^'\"`\s]+)['\"`]")


def sha256(path):
    result = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


class BuildError(ValueError):
    pass


class RuntimeGraph:
    def __init__(self, root):
        self.root = root.resolve()
        self.files = set()
        self.queue = []
        self.edges = []
        self.images = {}

    def project_path(self, value):
        candidate = self.root / value
        resolved = candidate.resolve()
        if not resolved.is_relative_to(self.root):
            raise BuildError("Dependency escapes the project: " + str(value))
        relative = candidate.relative_to(self.root).as_posix()
        if relative.startswith(FORBIDDEN_PREFIXES) or candidate.name.startswith("."):
            raise BuildError("Non-production dependency: " + relative)
        if candidate.is_symlink():
            raise BuildError("Symlink dependencies are not copied: " + relative)
        return candidate

    def include(self, relative):
        path = self.project_path(relative)
        if not path.is_file():
            raise BuildError("Missing runtime dependency: " + relative)
        if path.suffix.lower() not in RUNTIME_EXTENSIONS:
            raise BuildError("Unsupported runtime dependency: " + relative)
        if path.suffix.lower() in IMAGE_EXTENSIONS:
            if relative not in self.images:
                raise BuildError("Image is absent from the production allowlist: " + relative)
        if relative not in self.files:
            self.files.add(relative)
            self.queue.append(path)

    def reference(self, value, parent, document_root=False):
        value = value.strip()
        if not value or value.startswith("#"):
            return
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return
        decoded = unquote(parsed.path)
        if decoded.startswith("/") or document_root:
            path = self.root / decoded.removeprefix("./").lstrip("/")
        else:
            path = parent.parent / decoded
        # Normalize dot segments without following a symlink outside the tree.
        path = Path(os.path.normpath(path))
        if not path.is_relative_to(self.root):
            raise BuildError("Dependency escapes the project: " + value)
        if path.is_dir():
            path = path / "index.html"
        relative = path.relative_to(self.root).as_posix()
        self.edges.append({"from": parent.relative_to(self.root).as_posix(), "to": relative})
        self.include(relative)

    def css(self, text, parent):
        for value in CSS_URL.findall(text) + CSS_IMPORT.findall(text):
            self.reference(value, parent)

    def javascript(self, text, parent):
        for value in MODULE_IMPORT.findall(text) + DYNAMIC_DATASET.findall(text):
            self.reference(value, parent)
        for value in DOCUMENT_IMAGE.findall(text):
            if "${" in value:
                continue  # Generated image paths are covered by the allowlist.
            if Path(urlsplit(value).path).suffix.lower() in IMAGE_EXTENSIONS:
                self.reference(value, parent, document_root=True)

    def load_image_manifest(self):
        manifest = self.root / IMAGE_MANIFEST
        if not manifest.is_file():
            raise BuildError("Missing reviewed image manifest: " + IMAGE_MANIFEST)
        entries = json.loads(manifest.read_text())["files"]
        if not entries:
            raise BuildError("Production image allowlist is empty")
        for entry in entries:
            relative = entry["path"]
            if not relative.startswith(IMAGE_PREFIX) or ".." in Path(relative).parts:
                raise BuildError("Invalid production image path: " + relative)
            if relative in self.images:
                raise BuildError("Duplicate production image: " + relative)
            path = self.project_path(relative)
            if not path.is_file():
                raise BuildError("Missing production image: " + relative)
            if path.stat().st_size != entry["bytes"] or sha256(path) != entry["sha256"]:
                raise BuildError("Production image integrity check failed: " + relative)
            self.images[relative] = entry
        for relative in self.images:
            self.include(relative)

    def collect(self):
        self.load_image_manifest()
        for entry in ENTRY_POINTS:
            self.include(entry)
        while self.queue:
            path = self.queue.pop(0)
            extension = path.suffix.lower()
            if extension == ".html":
                parser = RuntimeHTML(self, path)
                parser.feed(path.read_text())
            elif extension == ".css":
                self.css(path.read_text(), path)
            elif extension == ".js":
                self.javascript(path.read_text(), path)
            elif extension == ".svg":
                svg = ET.parse(path)
                for element in svg.iter():
                    for key, value in element.attrib.items():
                        if key.rsplit("}", 1)[-1] == "href":
                            self.reference(value, path)
                    if element.tag.rsplit("}", 1)[-1] == "style" and element.text:
                        self.css(element.text, path)
            elif extension == ".webmanifest":
                manifest = json.loads(path.read_text())
                for collection in ("icons", "screenshots"):
                    for image in manifest.get(collection, []):
                        self.reference(image["src"], path)
        return self


class RuntimeHTML(HTMLParser):
    def __init__(self, graph, path):
        super().__init__()
        self.graph, self.path = graph, path
        self.script = self.style = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("src", "href", "xlink:href", "poster"):
            if attrs.get(key):
                self.graph.reference(attrs[key], self.path)
        if attrs.get("style"):
            self.graph.css(attrs["style"], self.path)
        if attrs.get("srcset"):
            for candidate in attrs["srcset"].split(","):
                self.graph.reference(candidate.strip().split()[0], self.path)
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "refresh":
            redirect = re.search(r"url\s*=\s*(.*)", attrs.get("content", ""), re.IGNORECASE)
            if redirect:
                self.graph.reference(redirect[1].strip("'\" "), self.path)
        if tag == "meta" and (attrs.get("property") in {"og:image", "og:image:url"} or attrs.get("name") == "twitter:image"):
            self.graph.reference(attrs.get("content", ""), self.path)
        if tag == "script":
            self.script = True
        if tag == "style":
            self.style = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.script = False
        if tag == "style":
            self.style = False

    def handle_data(self, text):
        if self.script:
            self.graph.javascript(text, self.path)
        if self.style:
            self.graph.css(text, self.path)


def build_report(graph):
    entries = [{"path": path, "bytes": (graph.root / path).stat().st_size,
                "sha256": sha256(graph.root / path)} for path in sorted(graph.files)]
    return {"version": 1, "files": entries,
            "summary": {"files": len(entries), "images": len(graph.images),
                        "bytes": sum(item["bytes"] for item in entries),
                        "by_extension": dict(sorted(Counter(Path(item["path"]).suffix for item in entries).items()))}}


def build_archive(graph, report, destination):
    if destination.exists():
        raise BuildError("Archive already exists; existing files are never replaced: " + str(destination))
    destination.parent.mkdir(parents=True, exist_ok=True)
    compressed_text = {".html", ".css", ".js", ".svg", ".webmanifest"}
    try:
        with zipfile.ZipFile(destination, mode="x") as archive:
            for entry in report["files"]:
                path = graph.root / entry["path"]
                compression = zipfile.ZIP_DEFLATED if path.suffix.lower() in compressed_text else zipfile.ZIP_STORED
                archive.write(path, arcname=entry["path"], compress_type=compression, compresslevel=9)
    except FileExistsError as error:
        raise BuildError("Archive already exists; existing files are never replaced: " + str(destination)) from error
    # Verify the actual archived payload, rather than trusting copied paths or
    # directory contents. Finder sidecars can never enter this explicit list.
    with zipfile.ZipFile(destination) as archive:
        if sorted(archive.namelist()) != sorted(entry["path"] for entry in report["files"]):
            raise BuildError("Production archive file list differs from the validated graph")
        for entry in report["files"]:
            digest = hashlib.sha256()
            count = 0
            with archive.open(entry["path"]) as source:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(block)
                    count += len(block)
            if digest.hexdigest() != entry["sha256"] or count != entry["bytes"]:
                raise BuildError("Archived file integrity check failed: " + entry["path"])
    return {"path": str(destination), "bytes": destination.stat().st_size, "sha256": sha256(destination)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="Project to validate; defaults to this checkout")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Validate runtime closure without writing files")
    mode.add_argument("--archive", type=Path, metavar="ZIP", help="Create a fresh ZIP directly from validated runtime files")
    parser.add_argument("--output", type=Path, help="Fresh deployment directory; defaults to ROOT/dist")
    parser.add_argument("--report", type=Path, help="Optional audit JSON outside the deployment directory")
    args = parser.parse_args()
    if args.archive and args.output:
        raise BuildError("Choose --archive or --output; an archive is built without a staging directory")
    if args.archive and args.report and args.archive.resolve() == args.report.resolve():
        raise BuildError("Audit report cannot replace the production archive")
    graph = RuntimeGraph(args.root).collect()
    report = build_report(graph)
    output = (args.output or graph.root / "dist").resolve()
    if output == graph.root or graph.root.is_relative_to(output):
        raise BuildError("Output cannot contain or replace the project")
    if args.report and args.report.resolve().is_relative_to(output):
        raise BuildError("Audit reports must stay outside the production directory")
    if args.archive:
        report["archive"] = build_archive(graph, report, args.archive.resolve())
    elif not args.check:
        if output.exists() and (not output.is_dir() or any(output.iterdir())):
            raise BuildError("Output must be absent or empty; existing files are never replaced: " + str(output))
        output.mkdir(parents=True, exist_ok=True)
        for entry in report["files"]:
            target = output / entry["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(graph.root / entry["path"], target)
            if sha256(target) != entry["sha256"]:
                raise BuildError("Copied file integrity check failed: " + entry["path"])
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n")
    result = {"mode": "archive" if args.archive else "check" if args.check else "build", **report["summary"]}
    if args.archive:
        result.update({"archive": report["archive"]["path"], "archive_bytes": report["archive"]["bytes"], "archive_sha256": report["archive"]["sha256"]})
    else:
        result["output"] = None if args.check else str(output)
    print(json.dumps(result))


if __name__ == "__main__":
    try:
        main()
    except (BuildError, KeyError, json.JSONDecodeError, ET.ParseError) as error:
        print("Production build failed: " + str(error), file=sys.stderr)
        sys.exit(1)
