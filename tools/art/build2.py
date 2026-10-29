"""v2 painterly world: raw (_raw/v2) -> final assets. usage: python build2.py [tiles walls props atmo ui]"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from chroma import key, bbox_trim, split_sheet, fit_sprite
from iso_tile import to_diamond, make_seamless
import jobs2

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")
R2 = os.path.join(GEN, "_raw", "v2")
PREV = os.path.join(GEN, "_raw", "previews", "v2")
os.makedirs(PREV, exist_ok=True)
TW, TH = 512, 256


def raw(cat, id):
    p = os.path.join(R2, cat, id + ".png")
    return Image.open(p) if os.path.exists(p) else None


def save(cat, name, im):
    os.makedirs(os.path.join(GEN, cat), exist_ok=True)
    im.save(os.path.join(GEN, cat, name + ".png"))


def montage(tile, n=6, path="m.png", scale=0.5):
    W, H = tile.size
    cv = Image.new("RGBA", (W * n, H * (n + 1)), (20, 20, 20, 255))
    for i in range(n):
        for j in range(n):
            cv.alpha_composite(tile, ((i - j) * W // 2 + W * n // 2 - W // 2, (i + j) * H // 2))
    cv = cv.convert("RGB")
    cv = cv.resize((int(cv.width * scale), int(cv.height * scale)), Image.LANCZOS)
    cv.save(path)


def do_tiles():
    for t in jobs2.tiles:
        r = raw("tiles", t)
        if r is None:
            print("missing", t); continue
        d = to_diamond(r, TW, TH, ss=2)
        save("tiles", t, d)
        montage(d, 6, os.path.join(PREV, "mont_" + t + ".png"), 0.35)
        print("tile", t, d.size)


def do_walls():
    for w in jobs2.walls:
        r = raw("walls", w)
        if r is None:
            print("missing", w); continue
        sp = bbox_trim(key(r))
        h = round(sp.height * TW / sp.width)
        sp = sp.resize((TW, h), Image.LANCZOS)
        cv = Image.new("RGBA", (TW, h + 2), (0, 0, 0, 0)); cv.paste(sp, (0, 0), sp)
        save("tiles", w, cv); print("wall", w, cv.size)


def do_props():
    allsp = []
    for sid, (c, rws, items) in jobs2.SHEETS.items():
        r = raw("props", sid)
        if r is None:
            print("missing", sid); continue
        sps, found = split_sheet(key(r), len(items), rows=rws, reach=300)
        print(sid, "expected", len(items), "found", found)
        for (name, h, _), sp in zip(items, sps):
            f = fit_sprite(sp, h)
            save("props", name, f); allsp.append((name, f))
    cell = 200
    cols = 8
    rows = -(-len(allsp) // cols)
    cs = Image.new("RGBA", (cols * cell, rows * (cell + 14)), (90, 90, 100, 255))
    d = ImageDraw.Draw(cs)
    for i, (n, f) in enumerate(allsp):
        t = f.copy(); t.thumbnail((cell - 6, cell - 6))
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        cs.alpha_composite(t, (x + 3, y + 3)); d.text((x + 3, y + cell), n, fill=(255, 255, 0, 255))
    cs.convert("RGB").save(os.path.join(PREV, "props_contact.png"))


def lum(im):
    a = np.asarray(im.convert("L")).astype(np.float32) / 255
    lo, hi = np.percentile(a, 1), np.percentile(a, 99.5)
    return np.clip((a - lo) / max(hi - lo, 1e-3), 0, 1)


def fit_ar(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def edgefade(a, m=0.08):
    h, w = a.shape
    fx = np.clip(np.minimum(np.arange(w), w - 1 - np.arange(w)) / (m * w), 0, 1)
    fy = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / (m * h), 0, 1)
    return a * (fx[None, :] * fy[:, None])


def rgba(alpha, color):
    out = np.zeros(alpha.shape + (4,), np.uint8)
    out[..., :3] = color
    out[..., 3] = (alpha.clip(0, 1) * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def do_atmo():
    spec = {"god_rays": (1024, 1024, "w"), "fog_wisp_1": (1024, 512, "w"), "fog_wisp_2": (1024, 512, "w"), "light_pool": (512, 512, "w"),
            "shadow_blob": (512, 512, "d"), "paint_vignette": (1920, 1080, "v")}
    for k, (w, h, mode) in spec.items():
        r = raw("atmo", k)
        if r is None:
            print("missing", k); continue
        im = fit_ar(r.convert("RGB"), w, h)
        l = lum(im)
        if mode == "w":
            a = edgefade(l, 0.04 if k != "god_rays" else 0.0001); out = rgba(a, (255, 255, 255))
        elif mode == "d":
            out = rgba(edgefade(1 - l, 0.04), (8, 6, 10))
        else:
            out = rgba(1 - l, (10, 7, 6))
        save("atmo", k, out); print("atmo", k, out.size)
    r = raw("atmo", "paper_grain")
    if r is not None:
        im = make_seamless(fit_ar(r.convert("RGB"), min(r.size), min(r.size)).resize((512, 512), Image.LANCZOS)).convert("L")
        a = np.asarray(im).astype(np.float32)
        a = 128 + (a - a.mean()) * (0.6 / max(a.std() / 40, 1e-3))
        save("atmo", "paper_grain", Image.fromarray(a.clip(0, 255).astype(np.uint8)).convert("RGBA"))
        print("paper_grain 512")


def fit_box(sp, n):
    sp = bbox_trim(sp); s = (n - 4) / max(sp.size)
    sp = sp.resize((max(1, round(sp.width * s)), max(1, round(sp.height * s))), Image.LANCZOS)
    cv = Image.new("RGBA", (n, n), (0, 0, 0, 0)); cv.paste(sp, ((n - sp.width) // 2, (n - sp.height) // 2), sp)
    return cv


def do_ui():
    r = raw("ui", "ui_a")
    if r is not None:
        sps, f = split_sheet(key(r), 3, rows=1, reach=60)
        print("ui_a found", f)
        for name, n, sp in zip(["orb_life_small", "orb_mana_small", "slot_round"], [160, 160, 64], sps):
            save("ui2", name, fit_box(sp, n))
    r = raw("ui", "ui_b")
    if r is not None:
        sps, f = split_sheet(key(r), 3, rows=3, reach=40)
        print("ui_b found", f)
        for name, (w, h), sp in zip(["bar_frame", "button_painted", "divider"], [(600, 40), (240, 64), (512, 32)], sps):
            sp = bbox_trim(sp); print(name, "src aspect", round(sp.width / sp.height, 1))
            save("ui2", name, sp.resize((w, h), Image.LANCZOS))
    r = raw("ui", "ui_fills")
    if r is not None:
        r = r.convert("RGB"); bh = r.height // 3
        for i, name in enumerate(["bar_fill_red", "bar_fill_gold", "bar_fill_blue"]):
            band = r.crop((0, i * bh + bh // 6, r.width, (i + 1) * bh - bh // 6))
            band = fit_ar(band, 600, 24)
            a = np.asarray(band).astype(np.float32)
            g = np.linspace(1.12, 0.78, 24)[:, None, None]  # soft top highlight, bottom shade
            save("ui2", name, Image.fromarray((a * g).clip(0, 255).astype(np.uint8)).convert("RGBA"))
    r = raw("ui", "panel_painted")
    if r is not None:
        save("ui2", "panel_painted", fit_ar(r.convert("RGB"), 512, 512).convert("RGBA"))


if __name__ == "__main__":
    g = sys.argv[1:] or ["tiles", "walls", "props", "atmo", "ui"]
    for x in g:
        globals()["do_" + x]()
