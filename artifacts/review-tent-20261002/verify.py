"""Decode the finished sheet and compare every QR with out/targets.json.

Run with an interpreter that has zxing-cpp + pillow + numpy:  /tmp/qrvenv/bin/python verify.py [base-name]
base-name is the out/<base>.png|pdf pair to check (default: peri-review-tent-a5).
Checks the PNG at several scales, a phone-camera-like degraded copy (tilt, blur, noise, JPEG) and the PDF raster.
Exit code is non-zero if a required check fails.
"""
import io, json, os, subprocess, sys, tempfile
import numpy as np
import zxingcpp
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
BASE = sys.argv[1] if len(sys.argv) > 1 else 'peri-review-tent-a5'
want ={t['url']: t['name'] for t in json.load(open(os.path.join(OUT, 'targets.json'), encoding='utf-8'))}


def decode(img):
    # QR only: zxing sometimes "finds" a Micro QR (text like '0034') in a downscaled copy of a real QR; filtering by the
    # reported format after decoding is what works — the formats= argument did not stop it
    return sorted(r.text for r in zxingcpp.read_barcodes(np.array(img.convert('RGB'))) if r.format == zxingcpp.BarcodeFormat.QRCode)


def check(label, img, required=True):
    got = decode(img)
    ok = got == sorted(want)
    missing = [want[u] for u in want if u not in got]
    extra = [g for g in got if g not in want]
    note = '' if ok else f'  missing={missing}' + (f' unexpected={extra}' if extra else '')
    print(f"{'OK  ' if ok else ('FAIL' if required else 'info')}  {label:36s} decoded {len(got)}/{len(want)}{note}")
    return ok or not required


def camera(img, width=1000, angle=4, blur=1.1, quality=55):
    im = img.convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im = im.rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=(120, 110, 100))
    im = im.filter(ImageFilter.GaussianBlur(blur))
    arr = np.array(im).astype(np.int16) + np.random.default_rng(1).normal(0, 6, np.array(im).shape).astype(np.int16)
    buf = io.BytesIO()
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=quality)
    return Image.open(buf)


png = Image.open(os.path.join(OUT, f'{BASE}.png'))
print(BASE, '| PNG', png.size)
results = [check('PNG full size', png)]
for w in (1000, 700):
    results.append(check(f'PNG downscaled to {w}px wide', png.resize((w, round(png.height * w / png.width)), Image.LANCZOS)))
check('PNG downscaled to 500px wide', png.resize((500, round(png.height * 500 / png.width)), Image.LANCZOS), required=False)
results.append(check('camera-like copy (tilt+blur+noise+JPEG)', camera(png)))

with tempfile.TemporaryDirectory() as tmp:
    subprocess.run(['pdftoppm', '-r', '150', '-png', os.path.join(OUT, f'{BASE}.pdf'), os.path.join(tmp, 'p')], check=True)
    page = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
    print('PDF pages rasterised:', len(page))
    results.append(len(page) == 1 and check('PDF raster @150 dpi', Image.open(os.path.join(tmp, page[0]))))

sys.exit(0 if all(results) else 1)
