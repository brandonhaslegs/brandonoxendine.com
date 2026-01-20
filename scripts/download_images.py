#!/usr/bin/env python3
import hashlib
import re
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parents[1]
IMAGES_ROOT = ROOT / "images"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"

IMG_PATTERN = re.compile(r'<img\b([^>]*)>', re.I)
SRC_PATTERN = re.compile(r'\bsrc="([^"]+)"', re.I)
ALT_PATTERN = re.compile(r'\balt="([^"]*)"', re.I)


def safe_name(name):
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name)
    return name.strip("-") or "image"


def filename_from_url(url):
    parsed = urlparse(url)
    path = unquote(parsed.path)
    base = Path(path).name
    if not base:
        base = "image"
    base = safe_name(base)
    return base


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        return True
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=30) as resp:
            data = resp.read()
    except (HTTPError, URLError) as exc:
        print(f"Failed {url}: {exc}")
        return False

    dest.write_bytes(data)
    return True


def rel_page_folder(page_path: Path):
    rel = page_path.relative_to(ROOT)
    if rel.parts == ("index.html",):
        return "home"
    return "-".join(rel.parts[:-1])


def parse_args():
    limit = None
    offset = 0
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
    return offset, limit


def main():
    offset, limit = parse_args()
    html_files = [p for p in ROOT.rglob('index.html') if '.git' not in p.parts]
    html_files.sort()
    end = offset + limit if limit is not None else len(html_files)
    batch = html_files[offset:end]
    IMAGES_ROOT.mkdir(parents=True, exist_ok=True)

    total = len(html_files)
    for idx, path in enumerate(batch, start=1):
        text = path.read_text()
        page_folder = rel_page_folder(path)
        page_images = IMAGES_ROOT / page_folder

        def repl(match):
            attrs = match.group(1)
            src_match = SRC_PATTERN.search(attrs)
            alt_match = ALT_PATTERN.search(attrs)
            src = src_match.group(1) if src_match else ""
            alt = alt_match.group(1) if alt_match else ""
            if not src or src.startswith("data:"):
                return match.group(0)

            parsed = urlparse(src)
            if not parsed.scheme:
                return match.group(0)

            filename = filename_from_url(src)
            # Avoid collisions with same basename from different URLs
            hashed = hashlib.sha1(src.encode("utf-8")).hexdigest()[:8]
            stem, dot, ext = filename.partition(".")
            if ext:
                filename = f"{stem}-{hashed}.{ext}"
            else:
                filename = f"{stem}-{hashed}"

            dest = page_images / filename
            if download(src, dest):
                rel_src = f"/images/{page_folder}/{filename}"
                return f'<img src="{rel_src}" alt="{alt}">' 
            return match.group(0)

        updated = IMG_PATTERN.sub(repl, text)
        path.write_text(updated)
        print(f"[{offset + idx}/{total}] {path}")

    print(f"Downloaded images into {IMAGES_ROOT}")


if __name__ == "__main__":
    main()
