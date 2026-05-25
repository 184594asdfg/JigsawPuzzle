#!/usr/bin/env python3
"""生成首页 hero 5×5 拼图底图：交替色按拼图轮廓填充 + 白色半圆分割线（750×1000）"""
import math
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 750, 1000
COLS, ROWS = 5, 5
COLOR_A = (0xba, 0x6f, 0x3f)
COLOR_B = (0xcf, 0x86, 0x53)
WHITE = (0xff, 0xff, 0xff)
CELL_W = W / COLS
CELL_H = H / ROWS
KNOB_R = min(CELL_W, CELL_H) * 0.18
LINE_W = 2
ARC_STEPS = 14


def dir_hash(r, c, kind):
    h = (r * 7 + c * 13 + (1 if kind == 'v' else 17)) % 4
    return 1 if h < 2 else -1


def arc_points(cx, cy, radius, start_rad, end_rad, anticlockwise):
    pts = []
    if anticlockwise:
        if start_rad < end_rad:
            start_rad += 2 * math.pi
        total = start_rad - end_rad
        for i in range(ARC_STEPS + 1):
            t = i / ARC_STEPS
            a = start_rad - t * total
            pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    else:
        if end_rad < start_rad:
            end_rad += 2 * math.pi
        total = end_rad - start_rad
        for i in range(ARC_STEPS + 1):
            t = i / ARC_STEPS
            a = start_rad + t * total
            pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
    return pts


def piece_polygon(x, y, w, h, col, row, n):
    kr = min(w, h) * 0.18
    mid_x = x + w / 2
    mid_y = y + h / 2
    pts = [(x, y)]

    if row == 0:
        pts.append((x + w, y))
    else:
        dh = dir_hash(row - 1, col, 'h')
        pts.append((mid_x - kr, y))
        pts.extend(arc_points(mid_x, y, kr, math.pi, 0, dh == 1))
        pts.append((x + w, y))

    if col == n - 1:
        pts.append((x + w, y + h))
    else:
        dv = dir_hash(row, col, 'v')
        pts.append((x + w, mid_y - kr))
        pts.extend(arc_points(x + w, mid_y, kr, -math.pi / 2, math.pi / 2, dv == -1))
        pts.append((x + w, y + h))

    if row == n - 1:
        pts.append((x, y + h))
    else:
        dh = dir_hash(row, col, 'h')
        pts.append((mid_x + kr, y + h))
        pts.extend(arc_points(mid_x, y + h, kr, math.pi, 0, dh == 1))
        pts.append((x, y + h))

    if col == 0:
        pass
    else:
        dv = dir_hash(row, col - 1, 'v')
        pts.append((x, mid_y + kr))
        pts.extend(arc_points(x, mid_y, kr, math.pi / 2, -math.pi / 2, dv == 1))

    return pts


def main():
    img = Image.new('RGB', (W, H), COLOR_A)
    draw = ImageDraw.Draw(img)

    for r in range(ROWS):
        for c in range(COLS):
            x0 = c * CELL_W
            y0 = r * CELL_H
            color = COLOR_A if (r + c) % 2 == 0 else COLOR_B
            poly = piece_polygon(x0, y0, CELL_W, CELL_H, c, r, COLS)
            draw.polygon(poly, fill=color)

    def stroke_arc(cx, cy, radius, start_deg, end_deg, anticlockwise=False):
        if anticlockwise:
            start_deg, end_deg = end_deg, start_deg
        bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
        draw.arc(bbox, start=start_deg, end=end_deg, fill=WHITE, width=LINE_W)

    for c in range(COLS - 1):
        line_x = round((c + 1) * CELL_W)
        for r in range(ROWS):
            top = int(r * CELL_H)
            bottom = int(H if r == ROWS - 1 else (r + 1) * CELL_H)
            mid_y = (top + bottom) / 2
            draw.line([(line_x, top), (line_x, int(mid_y - KNOB_R))], fill=WHITE, width=LINE_W)
            dv = dir_hash(r, c, 'v')
            stroke_arc(line_x, mid_y, KNOB_R, 270, 90, anticlockwise=(dv == -1))
            draw.line([(line_x, int(mid_y + KNOB_R)), (line_x, bottom)], fill=WHITE, width=LINE_W)

    for r in range(ROWS - 1):
        line_y = round((r + 1) * CELL_H)
        for c in range(COLS):
            left = int(c * CELL_W)
            right = int(W if c == COLS - 1 else (c + 1) * CELL_W)
            mid_x = (left + right) / 2
            draw.line([(left, line_y), (int(mid_x - KNOB_R), line_y)], fill=WHITE, width=LINE_W)
            dh = dir_hash(r, c, 'h')
            stroke_arc(mid_x, line_y, KNOB_R, 180, 0, anticlockwise=(dh == 1))
            draw.line([(int(mid_x + KNOB_R), line_y), (right, line_y)], fill=WHITE, width=LINE_W)

    out = Path(__file__).resolve().parent.parent / 'images' / 'home-hero-grid-bg.png'
    img.save(out, 'PNG')
    print('wrote', out)


if __name__ == '__main__':
    main()
