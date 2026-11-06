"""Cut every credited portrait out of its background so all cards share one backdrop.

Run:  python -I -X utf8 tools/photos/cutout_photos.py [player ids...]
Reads tools/photos/credits.json (written by fetch_photos.py), fetches each Commons file at
640 px into tools/photos/raw/ (cache, not committed), removes the background with rembg and
writes Assets/Players/<id>.png: 256x290 RGBA, head and shoulders, same framing for everyone.
The card's kit-coloured panel shows through the transparent background.
"""
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_photos import api, get  # noqa: E402  (reuses the polite User-Agent + 429 retries)

from PIL import Image  # noqa: E402
from rembg import new_session, remove  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Assets" / "Players"
RAW = ROOT / "tools" / "photos" / "raw"
W, H = 256, 290
HEAD_MARGIN = 0.07  # space above the hair, fraction of the crop height


def fetch_large(filename):
    j = api("https://commons.wikimedia.org/w/api.php", {
        "action": "query", "titles": "File:" + filename, "prop": "imageinfo", "iiprop": "url",
        "iiurlwidth": 640, "format": "json"})
    page = next(iter(j["query"]["pages"].values()))
    return get(page["imageinfo"][0]["thumburl"])


def frame(cut):
    """Crop a cut-out to head and shoulders, centred on the head."""
    alpha = cut.getchannel("A").point(lambda a: 255 if a > 128 else 0)
    x0, y0, x1, y1 = alpha.getbbox()
    bw, bh = x1 - x0, y1 - y0
    # Full-length or wide shots: the head and chest are the top ~45% of the figure.
    # Portraits: keep roughly a square of the subject's width.
    crop_h = bh * 0.45 if bh > 1.8 * bw else min(bh, 1.25 * bw)
    crop_h = max(crop_h, 40)
    # Close-ups: zoom out (transparent padding) until the head is at most ~46% of the card width,
    # so every player's head is about the same size. Capped so tiny crops don't vanish.
    head_w = max(_row_width(alpha, int(y0 + crop_h * f)) for f in (0.08, 0.12, 0.16))
    need_h = head_w / 0.46 * H / W
    crop_h = max(crop_h, min(need_h, crop_h * 1.6))
    # Centre on the head: the mean x of opaque pixels in the top fifth of the crop.
    band = alpha.crop((0, y0, cut.width, int(y0 + crop_h * 0.2)))
    xs = [x for (x, v) in enumerate(_column_sums(band)) if v]
    cx = sum(xs) / len(xs) if xs else (x0 + x1) / 2
    crop_w = crop_h * W / H
    top = y0 - crop_h * HEAD_MARGIN
    box = (int(cx - crop_w / 2), int(top), int(cx + crop_w / 2), int(top + crop_h))
    canvas = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    canvas.paste(cut.crop(box), (0, 0))
    out = canvas.resize((W, H), Image.LANCZOS)
    # Soft fade over the bottom fifth hides where the source photo was cut off.
    a = out.getchannel("A")
    px = a.load()
    start = int(H * 0.8)
    for y in range(start, H):
        k = 1 - (y - start) / (H - start)
        for x in range(W):
            px[x, y] = int(px[x, y] * k)
    out.putalpha(a)
    return out


def _row_width(alpha, y):
    if y >= alpha.height:
        return 0
    row = [x for x in range(alpha.width) if alpha.getpixel((x, y))]
    return (row[-1] - row[0]) if row else 0


def _column_sums(img):
    w, h = img.size
    px = img.load()
    return [sum(1 for y in range(h) if px[x, y]) for x in range(w)]


def main():
    credits = json.loads((ROOT / "tools" / "photos" / "credits.json").read_text(encoding="utf-8"))
    only = set(sys.argv[1:])
    RAW.mkdir(parents=True, exist_ok=True)
    session = new_session("u2net_human_seg")
    for pid, c in credits.items():
        if only and pid not in only:
            continue
        raw = RAW / f"{pid}.jpg"
        if not raw.exists():
            raw.write_bytes(fetch_large(c["file"]))
        img = Image.open(raw).convert("RGB")
        cut = remove(img, session=session)
        frame(cut).save(OUT / f"{pid}.png")
        print(f"{pid} {c['name']}: ok")


if __name__ == "__main__":
    main()
