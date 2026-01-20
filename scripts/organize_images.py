#!/usr/bin/env python3
import shutil
from pathlib import Path
from urllib.parse import urlparse
import re

ROOT = Path(__file__).resolve().parents[1]
IMAGES_ROOT = ROOT / "images"

IMG_PATTERN = re.compile(r'<img\b[^>]*src="([^"]+)"[^>]*>', re.I)


def page_slug(path: Path):
    rel = path.relative_to(ROOT)
    if rel.parts == ("index.html",):
        return "home"
    return rel.parts[-2]


def page_section(path: Path):
    rel = path.relative_to(ROOT)
    return rel.parts[0] if len(rel.parts) > 1 else "home"


def is_local_image(src):
    return src.startswith("/images/")


def ext_from_src(src):
    parsed = urlparse(src)
    name = Path(parsed.path).name
    if "." in name:
        return "." + name.split(".")[-1]
    return ""


def move_image(src_path: Path, dest_path: Path):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    if src_path.resolve() == dest_path.resolve():
        return
    if dest_path.exists():
        return
    shutil.move(str(src_path), str(dest_path))


def update_page(path: Path):
    text = path.read_text()
    section = page_section(path)
    if section not in {"alcohol", "my-collection-of-things"}:
        return

    matches = list(IMG_PATTERN.finditer(text))
    if not matches:
        return

    slug = page_slug(path)
    imgs = []
    for m in matches:
        src = m.group(1)
        if not is_local_image(src):
            continue
        imgs.append(src)

    if not imgs:
        return

    if section == "alcohol":
        # One image per product in /images/alcohol/<slug>.<ext>
        first_src = imgs[0]
        first_ext = ext_from_src(first_src)
        dest_rel = f"/images/alcohol/{slug}{first_ext}"
        src_path = ROOT / first_src.lstrip("/")
        dest_path = ROOT / dest_rel.lstrip("/")
        move_image(src_path, dest_path)

        def repl(match):
            src = match.group(1)
            if src == first_src:
                return match.group(0).replace(src, dest_rel)
            # drop other images in alcohol pages
            return ""

        text = IMG_PATTERN.sub(repl, text)
        path.write_text(text)
        return

    # my-collection-of-things
    if len(imgs) == 1:
        only_src = imgs[0]
        ext = ext_from_src(only_src)
        dest_rel = f"/images/mycollectionofthings/{slug}{ext}"
        src_path = ROOT / only_src.lstrip("/")
        dest_path = ROOT / dest_rel.lstrip("/")
        move_image(src_path, dest_path)
        text = text.replace(only_src, dest_rel)
        path.write_text(text)
        return

    # multiple images: keep them in folder
    def repl_multi(match):
        src = match.group(1)
        if src not in imgs:
            return match.group(0)
        src_path = ROOT / src.lstrip("/")
        ext = ext_from_src(src)
        name = src_path.stem
        dest_rel = f"/images/mycollectionofthings/{slug}/{name}{ext}"
        dest_path = ROOT / dest_rel.lstrip("/")
        move_image(src_path, dest_path)
        return match.group(0).replace(src, dest_rel)

    text = IMG_PATTERN.sub(repl_multi, text)
    path.write_text(text)


def main():
    html_files = [p for p in ROOT.rglob('index.html') if '.git' not in p.parts]
    for path in html_files:
        update_page(path)


if __name__ == "__main__":
    main()
