"""Magenta chroma-key, sheet slicing and sprite fitting."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi


def key(img, t0=70, t1=150):
    """RGB(A) image -> RGBA with magenta removed (soft edge, despill, slight erode)."""
    if img.mode == "RGBA":  # codex sometimes returns real transparency: put it on magenta and key as usual
        bg = Image.new("RGBA", img.size, (255, 0, 255, 255)); bg.alpha_composite(img); img = bg
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b) - g  # magenta-ness
    alpha = np.clip(1 - (m - t0) / (t1 - t0), 0, 1)
    # require reddish+bluish too (avoid eating pure greens etc. -- they have m<0 anyway)
    al = Image.fromarray((alpha * 255).astype(np.uint8))
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    alpha = np.asarray(al).astype(np.float32) / 255
    # despill near the border: clamp r,b toward g
    solid = alpha > 0.98
    near = ndi.binary_dilation(~solid, iterations=3) & (alpha > 0)
    spill = np.maximum(np.minimum(r, b) - g, 0)
    f = np.where(near, 1.0, 0.0)
    cap = g + 0.15 * spill
    r2 = np.where(near & (r > cap) & (spill > 25), np.minimum(r, cap + 0.3 * (r - cap)), r)
    b2 = np.where(near & (b > cap) & (spill > 25), np.minimum(b, cap + 0.3 * (b - cap)), b)
    out = np.stack([r2, g, b2, alpha * 255], -1).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def bbox_trim(im, thr=8):
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > thr)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def split_sheet(im, expected, merge=4, min_frac=0.004, rows=None, reach=200):
    """im: keyed RGBA sheet. N largest blobs are seeds; smaller fragments join the nearest seed (within `reach` px)."""
    arr = np.asarray(im)
    a = arr[..., 3] > 40
    dl, n = ndi.label(ndi.binary_dilation(a, iterations=merge))
    lab = dl * a
    idx = list(range(1, n + 1))
    sizes = ndi.sum(a, dl, idx)
    cms = ndi.center_of_mass(a, dl, idx)
    objs = ndi.find_objects(dl)
    order = np.argsort(-np.array(sizes))
    seeds = [int(i) for i in order[:expected]]
    groups = {s: [s] for s in seeds}
    for i in order[expected:]:
        if sizes[i] < 15:
            continue
        sl = objs[i]
        best, bd = None, 1e9
        for s in seeds:
            so = objs[s]
            dy = max(so[0].start - sl[0].stop, sl[0].start - so[0].stop, 0)
            dx = max(so[1].start - sl[1].stop, sl[1].start - so[1].stop, 0)
            d = (dx * dx + dy * dy) ** 0.5
            if d < bd:
                best, bd = s, d
        if best is not None and bd <= reach:
            groups[best].append(int(i))
    items = []
    for s, mem in groups.items():
        m = np.isin(dl, [k + 1 for k in mem]) & a
        ys, xs = np.where(m)
        items.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1, m))
    if rows is None:
        rows = 1
    cy = np.array([(t[1] + t[3]) / 2 for t in items])
    srt = np.argsort(cy)
    per = int(np.ceil(len(items) / rows))
    res = []
    for r in range(rows):
        grp = [items[i] for i in srt[r * per:(r + 1) * per]]
        grp.sort(key=lambda t: t[0])
        res += grp
    out = []
    for (x0, y0, x1, y1, m) in res:
        sub = arr[y0:y1, x0:x1].copy()
        sub[..., 3] = np.where(m[y0:y1, x0:x1], sub[..., 3], 0)
        out.append(Image.fromarray(sub, "RGBA"))
    return out, len(items)

def fit_sprite(sp, height, pad=4):
    """Resize to target height, canvas with bottom/side padding, bottom-center anchored."""
    sp = bbox_trim(sp)
    w, h = sp.size
    nw = max(1, round(w * height / h))
    sp = sp.resize((nw, height), Image.LANCZOS)
    canvas = Image.new("RGBA", (nw + 4, height + pad), (0, 0, 0, 0))
    canvas.paste(sp, (2, 0), sp)
    return canvas


if __name__ == "__main__":
    import sys
    im = key(Image.open(sys.argv[1]))
    bbox_trim(im).save(sys.argv[2])