#!/usr/bin/env python3
import os
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "https://www.brandonoxendine.com"
SITEMAP_URL = BASE_URL + "/sitemap.xml"
OUTPUT_ROOT = Path(__file__).resolve().parents[1]

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"


def fetch(url):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_tag_content(html, tag):
    pattern = re.compile(rf"<{tag}[^>]*>(.*?)</{tag}>", re.I | re.S)
    match = pattern.search(html)
    return match.group(1).strip() if match else ""


def extract_meta_description(html):
    match = re.search(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', html, re.I)
    if match:
        return match.group(1).strip()
    match = re.search(r"<meta[^>]+name='description'[^>]+content='([^']*)'", html, re.I)
    return match.group(1).strip() if match else ""


class MainContentParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.capture = False
        self.depth = 0
        self.parts = []

    def _attrs(self, attrs):
        rendered = []
        for key, value in attrs:
            if value is None:
                rendered.append(key)
            else:
                escaped = value.replace("&", "&amp;").replace("\"", "&quot;")
                rendered.append(f"{key}=\"{escaped}\"")
        return " ".join(rendered)

    def _start_tag(self, tag, attrs, self_closing=False):
        attr_str = self._attrs(attrs)
        if attr_str:
            if self_closing:
                return f"<{tag} {attr_str} />"
            return f"<{tag} {attr_str}>"
        if self_closing:
            return f"<{tag} />"
        return f"<{tag}>"

    def handle_starttag(self, tag, attrs):
        if not self.capture:
            attr_map = dict(attrs)
            if attr_map.get("id") == "mainContent" or attr_map.get("data-content-field") == "main-content":
                self.capture = True
                self.depth = 0
            return
        self.parts.append(self._start_tag(tag, attrs))
        self.depth += 1

    def handle_startendtag(self, tag, attrs):
        if self.capture:
            self.parts.append(self._start_tag(tag, attrs, self_closing=True))

    def handle_endtag(self, tag):
        if not self.capture:
            return
        if self.depth == 0:
            self.capture = False
            return
        self.parts.append(f"</{tag}>")
        self.depth -= 1

    def handle_data(self, data):
        if self.capture:
            self.parts.append(data)

    def handle_entityref(self, name):
        if self.capture:
            self.parts.append(f"&{name};")

    def handle_charref(self, name):
        if self.capture:
            self.parts.append(f"&#{name};")

    def handle_comment(self, data):
        if self.capture:
            self.parts.append(f"<!--{data}-->")


def extract_main_content(html):
    parser = MainContentParser()
    parser.feed(html)
    return "".join(parser.parts).strip()


def clean_content(content):
    content = re.sub(r"<script\\b[\\s\\S]*?</script>", "", content, flags=re.I)
    content = content.replace("https://www.brandonoxendine.com", "")
    content = content.replace("http://www.brandonoxendine.com", "")
    return content.strip()


def build_page(title, description, content, url_path):
    if not title:
        title = "Brandon Oxendine"
    description = description or ""

    return f"""<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
    <title>{title}</title>
    <meta name=\"description\" content=\"{description}\">
    <link rel=\"canonical\" href=\"{BASE_URL}{url_path}\">
    <link rel=\"stylesheet\" href=\"/assets/css/site.css\">
  </head>
  <body>
    <header class=\"site-header\">
      <div class=\"site-brand\"><a href=\"/\">Brandon Oxendine</a></div>
      <nav class=\"site-nav\">
        <a href=\"/\">Work</a>
        <a href=\"/writing\">Writing</a>
        <a href=\"/info\">Info</a>
      </nav>
    </header>
    <main class=\"site-content\">
{content}
    </main>
    <div class=\"lightbox\" hidden>
      <button class=\"lightbox-close\" aria-label=\"Close\">×</button>
      <img class=\"lightbox-image\" alt=\"\">
    </div>
    <script src=\"/assets/js/site.js\"></script>
  </body>
</html>
"""


def ensure_dir(path):
    path.mkdir(parents=True, exist_ok=True)


def url_to_path(url):
    if not url.startswith(BASE_URL):
        return None
    path = url[len(BASE_URL):]
    if not path or path == "/":
        return OUTPUT_ROOT / "index.html", "/"
    if path.endswith("/"):
        path = path[:-1]
    return OUTPUT_ROOT / path.lstrip("/") / "index.html", path


def parse_args():
    limit = None
    offset = 0
    force = False
    args = sys.argv[1:]
    for arg in args:
        if arg.startswith("--limit="):
            try:
                limit = int(arg.split("=", 1)[1])
            except ValueError:
                pass
        elif arg.startswith("--offset="):
            try:
                offset = int(arg.split("=", 1)[1])
            except ValueError:
                pass
        elif arg == "--force":
            force = True
    return offset, limit, force


def main():
    offset, limit, force = parse_args()
    try:
        sitemap_xml = fetch(SITEMAP_URL)
    except Exception as exc:
        print(f"Failed to fetch sitemap: {exc}", file=sys.stderr)
        sys.exit(1)

    root = ET.fromstring(sitemap_xml)
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = [loc.text for loc in root.findall("sm:url/sm:loc", ns) if loc.text]
    if BASE_URL not in locs:
        locs.insert(0, BASE_URL)

    print(f"Found {len(locs)} URLs")

    end = offset + limit if limit is not None else len(locs)
    batch = locs[offset:end]
    total = len(locs)
    batch_total = len(batch)

    for idx, url in enumerate(batch, start=1):
        out_path, url_path = url_to_path(url)
        if out_path is None:
            continue
        if out_path.exists() and not force:
            print(f"[{offset + idx}/{total}] Skip existing {out_path}")
            continue
        try:
            html = fetch(url)
        except (HTTPError, URLError) as exc:
            print(f"[{offset + idx}/{total}] Failed {url}: {exc}")
            continue

        title = extract_tag_content(html, "title")
        description = extract_meta_description(html)
        content = extract_main_content(html)
        if not content:
            print(f"[{offset + idx}/{total}] No main content for {url}")
            continue

        content = clean_content(content)
        page_html = build_page(title, description, content, url_path)

        ensure_dir(out_path.parent)
        out_path.write_text(page_html, encoding="utf-8")
        print(f"[{offset + idx}/{total}] Wrote {out_path}")


if __name__ == "__main__":
    main()
