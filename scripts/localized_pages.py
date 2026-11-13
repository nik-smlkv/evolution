"""Render crawlable English pages from the Serbian templates and UI strings."""

from html import escape
from html.parser import HTMLParser
import re


TRANSLATIONS = "js/languages/languages.js"
LOCALE_CONFIG = "config/seo-locales.json"
VOID_ELEMENTS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}


def read_strings(source, locale):
    # The browser dictionary uses one object per locale and literal backticks.
    block = re.search(r"^\t" + locale + r": \{\n(.*?)^\t\},", source, re.M | re.S)[1]
    return dict(re.findall(r"^\s*(\w+): `([^`]*)`,", block, re.M))


class _TranslatedText(HTMLParser):
    def __init__(self, source, strings):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.strings = strings
        self.line_offsets = [0] + [match.end() for match in re.finditer("\n", source)]
        self.stack = []
        self.replacements = []
        self.feed(source)
        self.close()

    def source_offset(self):
        line, column = self.getpos()
        return self.line_offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        if tag in VOID_ELEMENTS:
            return
        attrs = dict(attrs)
        key = attrs.get("data-key") or attrs.get("data-static-key")
        self.stack.append((tag, key, self.source_offset() + len(self.get_starttag_text())))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                break
        else:
            return
        _, key, start = self.stack[index]
        del self.stack[index:]
        if key in self.strings:
            text = " ".join(self.strings[key].split())
            if key == "p_callback":
                first, _, rest = text.partition(" ")
                text = (
                    f'<span class="callback-title__line">{escape(first)}</span> '
                    f'<span class="callback-title__line">{escape(rest)}</span>'
                )
            else:
                text = escape(text, quote=False)
            stop = self.source_offset()
            content = self.source[start:stop]
            leading = content[:len(content) - len(content.lstrip())]
            trailing = content[len(content.rstrip()):] if content.strip() else ""
            self.replacements.append((start, stop, leading + text + trailing))


def translate_text(source, strings):
    parser = _TranslatedText(source, strings)
    # A translated parent replaces its own contents, including any child text.
    end = 0
    chunks = []
    for start, stop, text in sorted(parser.replacements):
        if start >= end:
            chunks.extend((source[end:start], text))
            end = stop
    chunks.append(source[end:])
    return "".join(chunks)


def render_english_page(source, strings, metadata, routes):
    source = translate_text(source, strings).replace('<html lang="sr"', '<html lang="en"', 1)
    source = source.replace('alt="Stambeni kompleks Evolution Residence na Voždovcu"',
                            'alt="Evolution Residence residential complex in Voždovac"', 1)
    canonical = re.search(r'<link rel="canonical" href="([^"]+)"', source)[1]
    english_url = re.search(r'hreflang="en" href="([^"]+)"', source)[1]
    source = source.replace(f'rel="canonical" href="{canonical}"', f'rel="canonical" href="{english_url}"', 1)
    source = source.replace(f'property="og:url" content="{canonical}"', f'property="og:url" content="{english_url}"', 1)
    source = source.replace('property="og:locale" content="sr_RS"', 'property="og:locale" content="en_GB"', 1)
    title = escape(metadata["title"])
    tab_title = escape(metadata.get("tab_title", metadata["title"]))
    description = escape(metadata["description"])
    source = re.sub(r"<title>[^<]*</title>", lambda _: f"<title>{tab_title}</title>", source, count=1)
    for attribute, value in (
        ('name="description"', description),
        ('property="og:description"', description),
        ('property="og:title"', title),
    ):
        source = re.sub(attribute + r' content="[^"]*"', lambda _: f'{attribute} content="{value}"', source, count=1)

    pages = {"", "search-by-parameters.html", *(slug + "/" for slug in routes)}
    pages.update(f"search-by-parameters/{house}/" for house in ("tchaikovsky", "vivaldi"))

    def english_link(match):
        start, path, query = match.groups()
        if 'data-lang=' in start or path not in pages:
            return match[0]
        return f'{start}./en/{path}{query or ""}"'

    source = re.sub(r'(<a\b[^>]*?\bhref=")\./([^?"<>]*)(\?[^"<>]*)?"', english_link, source)
    source = source.replace('class="lang_switch_list" data-active="srb"', 'class="lang_switch_list" data-active="en"', 1)
    source = source.replace('data-lang="srb" class="lang__item active"', 'data-lang="srb" class="lang__item"', 1)
    source = source.replace('lang="sr" aria-current="page"', 'lang="sr"', 1)
    source = source.replace('data-lang="en" class="lang__item"', 'data-lang="en" class="lang__item active"', 1)
    return source.replace('lang="en" aria-label="English"', 'lang="en" aria-current="page" aria-label="English"', 1)
