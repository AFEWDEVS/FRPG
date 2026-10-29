"""Audit generated PNGs for black/opaque backgrounds connected to the border.
usage: python audit.py          report only
       python audit.py --fix    also remove the black background (originals backed up to _raw/audit_backup/)"""
import sys, os, shutil, numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")
DIRS = ["characters", "props", "ui", "ui/icons"]
SKIP = {"panel_stone.png", "parchment.png"}
TOL = 40


def targets():
    for d in DIRS:
        p = os.path.join(GEN, d)
        for f in sorted(os.listdir(p)):
            if f.endswith(".png") and f not in SKIP:
                yield d, f, os.path.join(p, f)


def bgmask(a):
    rgb = a[..., :3].astype(int)
    dark = (rgb.max(-1) <= TOL) & (a[..., 3] > 16)
    lab, n = ndi.label(dark)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge = edge[edge > 0]
    return np.isin(lab, edge)


def analyze(path):
    a = np.asarray(Image.open(path).convert("RGBA"))
    bord = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    return float((bord[:, 3] > 16).mean()), float(bgmask(a).mean()), a


def fix(a):
    m = bgmask(a)
    m = m | (ndi.binary_dilation(m, iterations=2) & (a[..., :3].max(-1) <= TOL + 30))
    soft = ndi.gaussian_filter(m.astype(np.float32), 0.8)
    alpha = a[..., 3].astype(np.float32) * (1 - np.clip(soft * 1.2, 0, 1))
    alpha[m & (soft > 0.95)] = 0
    out = a.copy()
    out[..., 3] = alpha.clip(0, 255).astype(np.uint8)
    return out


def flagged_list():
    res = []
    for d, f, p in targets():
        of, fr, a = analyze(p)
        icon = d.endswith("icons") or f == "slot.png"
        if (a[0, 0, 3] > 16 and a[-1, -1, 3] > 16) if icon else (of > 0.10 or fr > 0.02):
            res.append((d, f, p))
            print("FLAG %-10s %-28s borderOpaque=%.2f blackBg=%.2f" % (d, f, of, fr))
    print(len(res), "flagged")
    return res


if __name__ == "__main__":
    fl = flagged_list()
    if "--fix" in sys.argv:
        bk = os.path.join(GEN, "_raw", "audit_backup")
        os.makedirs(bk, exist_ok=True)
        for d, f, p in fl:
            shutil.copy(p, os.path.join(bk, d.replace("/", "_") + "_" + f))
            Image.fromarray(fix(np.asarray(Image.open(p).convert("RGBA"))), "RGBA").save(p)
            print("FIXED", d + "/" + f)
