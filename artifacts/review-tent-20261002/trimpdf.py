"""Trim a Chrome-made PDF to its fully painted area, so no bare-white hairline is left along the edges.

Chrome rounds the page size it writes (e.g. 533.25 pt → 534 pt) and the last sliver is not painted. For a sheet that must be
colour edge to edge that sliver is a white line. This rasterises the page at 600 dpi, finds the all-white lines along each
edge, and shrinks the page's MediaBox/CropBox to exclude them plus a 2 px (0.08 mm) safety margin. The content stays vector.

    /tmp/qrvenv/bin/python trimpdf.py out/<base>.pdf        (needs pypdf, pillow, numpy; pdftoppm from poppler)
"""
import os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

DPI, SAFETY = 600, 2
src = sys.argv[1]
reader = PdfReader(src)
assert len(reader.pages) == 1, 'expects a one-page PDF'

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['pdftoppm', '-r', str(DPI), '-png', src, os.path.join(tmp, 'p')], check=True, stderr=subprocess.DEVNULL)
    a = np.asarray(Image.open(os.path.join(tmp, sorted(os.listdir(tmp))[0])).convert('RGB'))
H, W = a.shape[:2]
white = (a == 255).all(axis=2)


def lead(share):                       # leading lines that are (almost) entirely white
    n = 0
    for v in share:
        if v <= 0.98:
            break
        n += 1
    return n


rows, cols = white.mean(axis=1), white.mean(axis=0)
t, b, l, r = lead(rows), lead(rows[::-1]), lead(cols), lead(cols[::-1])
print(f'unpainted edge lines @{DPI} dpi: top {t}, bottom {b}, left {l}, right {r}')

pt = 72 / DPI                          # points per raster pixel
page = reader.pages[0]
x0, y0, x1, y1 = (float(v) for v in page.mediabox)
box = RectangleObject([x0 + (l + SAFETY) * pt, y0 + (b + SAFETY) * pt, x1 - (r + SAFETY) * pt, y1 - (t + SAFETY) * pt])
page.mediabox = box
page.cropbox = box
w = PdfWriter()
w.add_page(page)
with open(src, 'wb') as f:
    w.write(f)
bw, bh = float(box.width), float(box.height)
print(f'trimmed page: {bw:.2f} x {bh:.2f} pt = {bw / 72 * 25.4:.2f} x {bh / 72 * 25.4:.2f} mm')
