#!/usr/bin/env python3
"""
压缩包内 images/：仅在体积变小时才覆盖原文件。
用法：python3 tools/compress_pack_images.py
"""
from __future__ import annotations

import io
import os
import struct
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"

MAX_EDGE = {
    "icons": 320,
    "themes": 400,
    "settings": 560,
    "win": 800,
    "timeup": 1300,
    "modals": 1300,
    "": 1300,
}

JPG_QUALITY = 82
PNG_COMPRESS = 9
SKIP_NAMES = {"rank.png", "share.png"}


def category_for(path: Path) -> str:
    parts = path.relative_to(IMAGES).parts
    return parts[0] if len(parts) > 1 else ""


def maybe_resize(img: Image.Image, max_edge: int) -> Image.Image:
    w, h = img.size
    edge = max(w, h)
    if edge <= max_edge:
        return img
    scale = max_edge / edge
    nw = max(1, int(w * scale))
    nh = max(1, int(h * scale))
    resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
    return img.resize((nw, nh), resample)


def encode_image(path: Path, img: Image.Image) -> bytes:
    buf = io.BytesIO()
    ext = path.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(buf, "JPEG", quality=JPG_QUALITY, optimize=True, progressive=True)
    else:
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        img.save(buf, "PNG", optimize=True, compress_level=PNG_COMPRESS)
    return buf.getvalue()


def compress_file(path: Path) -> tuple[int, int, bool]:
    before = path.stat().st_size
    ext = path.suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        return before, before, False

    img = Image.open(path)
    cat = category_for(path)
    max_edge = MAX_EDGE.get(cat, MAX_EDGE[""])
    img = maybe_resize(img, max_edge)
    data = encode_image(path, img)
    after = len(data)

    if after < before:
        path.write_bytes(data)
        return before, after, True
    return before, after, False


def main() -> int:
    if not IMAGES.is_dir():
        print("images/ not found", file=sys.stderr)
        return 1

    total_before = 0
    total_after = 0
    saved = 0
    files = sorted(
        p for p in IMAGES.rglob("*")
        if p.is_file() and p.suffix.lower() in (".png", ".jpg", ".jpeg")
        and p.name not in SKIP_NAMES
    )

    for path in files:
        b, a, ok = compress_file(path)
        total_before += b
        total_after += a if ok else b
        rel = path.relative_to(ROOT)
        if ok:
            saved += 1
            pct = int((1 - a / b) * 100) if b else 0
            print(f"- {rel}: {b // 1024}KB -> {a // 1024}KB (-{pct}%)")
        else:
            print(f"  {rel}: {b // 1024}KB (skip, would grow)")

    print(f"\nUpdated {saved}/{len(files)} files")
    print(f"Total: {total_before / 1024 / 1024:.2f}MB -> {total_after / 1024 / 1024:.2f}MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
