#!/usr/bin/env python3
"""Stage static URL rewrites from a reviewed production-image alias map.

Alias keys may refer to originals kept only in local sources. Values must name
existing published images. Dry-run is the default; --apply writes changed code
only to an isolated staging tree, never to production or its runtime image map.
"""
import argparse
import json
import posixpath
import re
import unicodedata
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit


def normalize(value):
    return unicodedata.normalize("NFC", value)


def link_url(value, source, mapping):
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return value
    path = unquote(parsed.path)
    parent = source.parent.as_posix()
    candidates = [(posixpath.normpath(posixpath.join(parent, path)), "relative")]
    candidates.append((posixpath.normpath(path.lstrip("/")), "root"))
    for candidate, kind in candidates:
        replacement = mapping.get(normalize(candidate))
        if replacement is None:
            continue
        if path.startswith("/"):
            target = "/" + replacement
        elif kind == "relative":
            target = posixpath.relpath(replacement, parent)
            if path.startswith("./") and not target.startswith("."):
                target = "./" + target
        else:
            target = ("./" if path.startswith("./") else "") + replacement
        return urlunsplit(("", "", quote(target, safe="/.-_~"), parsed.query, parsed.fragment))
    return value


def rewrite(text, source, mapping):
    # Social images and platform icons keep their declared source format.
    def preserved_tags(content):
        spans = []
        if source.suffix.lower() != ".html":
            return spans
        for tag in re.finditer(r"<(?P<name>meta|link)\b[^>]*>", content, re.I | re.S):
            if tag.group("name").lower() == "meta":
                spans.append(tag.span())
                continue
            relation = re.search(r"\brel\s*=\s*(?:\"([^\"]*)\"|'([^']*)'|([^\s>]+))", tag.group(0), re.I)
            tokens = next((value for value in relation.groups() if value is not None), "").lower().split() if relation else []
            if "manifest" in tokens or any(token.endswith("icon") or token == "apple-touch-icon-precomposed" for token in tokens):
                spans.append(tag.span())
        return spans

    preserved = preserved_tags(text)
    pattern = re.compile(r"(?P<quote>[\"'])(?P<url>[^\"'<>\r\n]+?\.(?:jpe?g|png)(?:[?#][^\"'<>\r\n]*)?)(?P=quote)", re.I)
    changes = []

    def replace(match):
        if any(start <= match.start() < end for start, end in preserved):
            return match.group(0)
        before = match.group("url")
        after = link_url(before, source, mapping)
        if after != before:
            changes.append({"from": before, "to": after})
        return match.group("quote") + after + match.group("quote")

    result = pattern.sub(replace, text)
    preserved = preserved_tags(result)
    css_url = re.compile(r"url\(\s*(?P<url>[^)'\"\s]+\.(?:jpe?g|png)(?:[?#][^)'\"\s]*)?)\s*\)", re.I)

    def replace_css(match):
        if any(start <= match.start() < end for start, end in preserved):
            return match.group(0)
        before = match.group("url")
        after = link_url(before, source, mapping)
        if before != after:
            changes.append({"from": before, "to": after})
        return f"url({after})"

    return css_url.sub(replace_css, result), changes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--map", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--output-dir", type=Path, help="Changed-code staging directory; defaults to assets/sources/generated/code")
    parser.add_argument("--apply", action="store_true", help="Stage changed source files without changing production")
    args = parser.parse_args()
    root = args.root.resolve()
    output_dir = (args.output_dir or root / "assets/sources/generated/code").resolve()
    if output_dir.is_relative_to(root) and not output_dir.is_relative_to(root / "assets/sources/generated"):
        parser.error("Output inside the repository must be under ignored assets/sources/generated")
    report_path = args.report.resolve()
    if report_path.is_relative_to(root) and not report_path.is_relative_to(root / "assets/sources/generated"):
        parser.error("Reports inside the repository must stay in assets/sources/generated")
    mapping = {normalize(key): normalize(value) for key, value in json.loads(args.map.read_text()).items()}
    for original, optimized in mapping.items():
        if any(Path(value).parts[:2] != ("assets", "images") or ".." in Path(value).parts
               for value in (original, optimized)):
            raise ValueError(f"Source/variant must use canonical assets/images paths: {original} -> {optimized}")
        if not (root / optimized).is_file():
            raise ValueError(f"Missing selected production image: {original} -> {optimized}")
    changed = []
    excluded = {"js/optimized-image-map.js", "js/optimized-images.js"}
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if file.suffix.lower() not in {".html", ".css", ".js"} or not file.is_file():
            continue
        if (any(part in {".git", "node_modules", "tests", "scripts", "archive", "dist", "build"} for part in relative.parts)
                or relative.parts[:2] == ("assets", "sources") or relative.as_posix() in excluded):
            continue
        before = file.read_text()
        after, replacements = rewrite(before, relative, mapping)
        if before == after:
            continue
        if args.apply:
            destination = output_dir / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(after)
        changed.append({"file": relative.as_posix(), "replacements": replacements})
    report = {"applied": args.apply, "variants": len(mapping), "changed_files": changed,
              "output_directory": str(output_dir), "production_modified": False, "runtime_map_written": False,
              "replacements": sum(len(entry["replacements"]) for entry in changed)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({"variants": len(mapping), "changed_files": len(changed), "replacements": report["replacements"]}))


if __name__ == "__main__":
    main()
