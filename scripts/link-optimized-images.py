#!/usr/bin/env python3
"""Link verified WebP variants in static sources and generate the runtime URL map.

Original image files remain available. Run with --apply to write changes.
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
    # Social-image metadata retains the source JPEG for crawler compatibility.
    metadata = [match.span() for match in re.finditer(r"<meta\b[^>]*>", text, re.I | re.S)] if source.suffix == ".html" else []
    pattern = re.compile(r"(?P<quote>[\"'])(?P<url>[^\"'<>\r\n]+?\.jpe?g(?:[?#][^\"'<>\r\n]*)?)(?P=quote)", re.I)
    changes = []

    def replace(match):
        if any(start <= match.start() < end for start, end in metadata):
            return match.group(0)
        before = match.group("url")
        after = link_url(before, source, mapping)
        if after != before:
            changes.append({"from": before, "to": after})
        return match.group("quote") + after + match.group("quote")

    result = pattern.sub(replace, text)
    css_url = re.compile(r"url\(\s*(?P<url>[^)'\"\s]+\.jpe?g(?:[?#][^)'\"\s]*)?)\s*\)", re.I)

    def replace_css(match):
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
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    mapping = {normalize(key): normalize(value) for key, value in json.loads(args.map.read_text()).items()}
    for original, optimized in mapping.items():
        if not (root / original).is_file() or not (root / optimized).is_file():
            raise ValueError(f"Missing source/variant: {original} -> {optimized}")
    changed = []
    excluded = {"js/optimized-image-map.js", "js/optimized-images.js"}
    for file in sorted(root.rglob("*")):
        relative = file.relative_to(root)
        if file.suffix.lower() not in {".html", ".css", ".js"} or not file.is_file():
            continue
        if any(part in {".git", "node_modules", "tests", "scripts"} for part in relative.parts) or relative.as_posix() in excluded:
            continue
        before = file.read_text()
        after, replacements = rewrite(before, relative, mapping)
        if before == after:
            continue
        if args.apply:
            file.write_text(after)
        changed.append({"file": relative.as_posix(), "replacements": replacements})
    if args.apply:
        generated = "// Generated from verified, smaller lossless WebP variants.\nexport default " + json.dumps(dict(sorted(mapping.items())), ensure_ascii=False, separators=(",", ":")) + ";\n"
        (root / "js/optimized-image-map.js").write_text(generated)
    report = {"applied": args.apply, "variants": len(mapping), "changed_files": changed,
              "replacements": sum(len(entry["replacements"]) for entry in changed)}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({"variants": len(mapping), "changed_files": len(changed), "replacements": report["replacements"]}))


if __name__ == "__main__":
    main()
