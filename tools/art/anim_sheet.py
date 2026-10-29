"""Slice a raw 4x4 animation sheet (magenta bg) into a uniform packed sheet + json + preview gif.
usage: python anim_sheet.py key [key ...]      (reads _raw/anim/<key>.png; or <key>_a/<key>_b 2x4 halves)
Output: public/assets/gen/anim/<key>.png/.json, tools/art/previews/anim_<key>.gif and anim_<key>_sheet.png"""
import sys, os, json, numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
import chroma
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")
PV = os.path.join(ROOT, "tools", "art", "previews")
COLS = ROWS = 4
ANIMS = {"walk_down": {"frames": [0, 1, 2, 3], "fps": 8, "loop": True}, "walk_up": {"frames": [4, 5, 6, 7], "fps": 8, "loop": True},
         "attack_down": {"frames": [8, 9, 10, 11], "fps": 12, "loop": False}, "idle": {"frames": [12, 13], "fps": 2, "loop": True},
         "hurt": {"frames": [14], "fps": 1, "loop": False}, "death": {"frames": [15], "fps": 1, "loop": False}}


def load_sheet(key):
    raw = os.path.join(GEN, "_raw", "anim")
    if os.path.exists(os.path.join(raw, key + ".png")):
        return chroma.key(Image.open(os.path.join(raw, key + ".png")).convert("RGBA")), 4
    a = chroma.key(Image.open(os.path.join(raw, key + "_a.png")).convert("RGBA"))
    b = chroma.key(Image.open(os.path.join(raw, key + "_b.png")).convert("RGBA"))
    w = max(a.width, b.width)
    out = Image.new("RGBA", (w, a.height + b.height)); out.paste(a, (0, 0)); out.paste(b, (0, a.height))
    return out, 4


def slice_frames(im, min_area=40):
    arr = np.asarray(im).copy()
    H, W = arr.shape[:2]
    a = arr[..., 3] > 40
    lab, n = ndi.label(ndi.binary_dilation(a, iterations=5))
    lab = lab * a
    frames = {}
    cw, ch = W / COLS, H / ROWS
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < min_area:
            continue
        ys, xs = np.where(m)
        c = min(int(xs.mean() // cw), COLS - 1); r = min(int(ys.mean() // ch), ROWS - 1)
        frames.setdefault(r * COLS + c, []).append(m)
    out = []
    for f in range(COLS * ROWS):
        m = np.zeros((H, W), bool)
        for x in frames.get(f, []):
            m |= x
        if not m.any():
            out.append(None); continue
        ys, xs = np.where(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        sub = arr[y0:y1, x0:x1].copy()
        sub[..., 3] = np.where(m[y0:y1, x0:x1], sub[..., 3], 0)
        out.append(Image.fromarray(sub, "RGBA"))
    return out


def feet_x(im):
    a = np.asarray(im)[..., 3] > 40
    h = a.shape[0]
    ys, xs = np.where(a[int(h * 0.7):])
    return float(xs.mean()) if len(xs) else im.width / 2


def pack(key):
    sheet, _ = load_sheet(key)
    frames = slice_frames(sheet)
    miss = [i for i, f in enumerate(frames) if f is None]
    if miss:
        print(key, "MISSING FRAMES", miss)
    static = Image.open(os.path.join(GEN, "characters", key + ".png")).convert("RGBA")
    th = chroma.bbox_trim(static).height
    ref = frames[12] or next(f for f in frames if f)
    s = th / ref.height
    sc = []
    for f in frames:
        if f is None:
            sc.append(None); continue
        g = f.resize((max(1, round(f.width * s)), max(1, round(f.height * s))), Image.LANCZOS)
        sc.append((g, feet_x(g)))
    left = max(fx for g, fx in [x for x in sc if x]); right = max(g.width - fx for g, fx in [x for x in sc if x])
    hh = max(g.height for g, _ in [x for x in sc if x])
    pad = 4
    fw = int(2 * max(left, right)) + 2 * pad; fw += fw % 2
    fh = hh + pad
    sheet_out = Image.new("RGBA", (fw * COLS, fh * ROWS), (0, 0, 0, 0))
    cells = []
    for i, x in enumerate(sc):
        cell = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
        if x:
            g, fx = x
            cell.alpha_composite(g, (int(round(fw / 2 - fx)), fh - pad - g.height))
        cells.append(cell)
        sheet_out.paste(cell, ((i % COLS) * fw, (i // COLS) * fh))
    od = os.path.join(GEN, "anim"); os.makedirs(od, exist_ok=True); os.makedirs(PV, exist_ok=True)
    sheet_out.save(os.path.join(od, key + ".png"))
    json.dump({"frameWidth": fw, "frameHeight": fh, "cols": COLS, "rows": ROWS, "anims": ANIMS}, open(os.path.join(od, key + ".json"), "w"))
    # previews: gif of all anims in sequence on grey + contact sheet
    bg = (96, 96, 112, 255)
    seq, dur = [], []
    for name, an in ANIMS.items():
        reps = 3 if an["loop"] and len(an["frames"]) > 1 else 1
        for _ in range(reps):
            for fi in an["frames"]:
                fr = Image.new("RGBA", (fw, fh), bg); fr.alpha_composite(cells[fi])
                seq.append(fr.convert("P", palette=Image.ADAPTIVE)); dur.append(int(1000 / an["fps"]) if len(an["frames"]) > 1 else 700)
    seq[0].save(os.path.join(PV, "anim_%s.gif" % key), save_all=True, append_images=seq[1:], duration=dur, loop=0, disposal=2)
    cs = Image.new("RGBA", sheet_out.size, bg); cs.alpha_composite(sheet_out)
    cs.convert("RGB").save(os.path.join(PV, "anim_%s_sheet.png" % key))
    print(key, "cell %dx%d scale %.3f missing=%s" % (fw, fh, s, miss))


if __name__ == "__main__":
    for k in sys.argv[1:]:
        pack(k)