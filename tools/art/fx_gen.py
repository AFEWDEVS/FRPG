"""Task 3 FX: python fx_gen.py gen | build.   gen -> codex 3 images to _raw/fx/, build -> public/assets/gen/fx/"""
import sys, os, json, shutil, subprocess, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import chroma
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")
RAW = os.path.join(GEN, "_raw", "fx")
OUT = os.path.join(GEN, "fx")
STYLE = "Ragnarok Online style 2D game effect sprite art, painterly clean, vivid colors, soft glow. "
MAG = "Pure flat magenta #FF00FF background, wide magenta gaps between items, no text, no grid lines, items fully separate. "
JOBS = {
 "levelup_angel": STYLE + MAG + "A horizontal strip of exactly 6 animation frames in ONE row, left to right, of a level-up effect: a cute small angel wing halo burst. Frame 1 tiny golden halo ring with sparkle, frame 2 halo grows with small white feather wings appearing, frame 3 big spread white angel wings with glowing golden halo and sparkles, frame 4 wings fully open, bright light rays and floating feathers, frame 5 wings fading with feathers drifting, frame 6 only a few sparkles and feathers left. Every frame the same size, centered.",
 "cast_circle": STYLE + "An ornate glowing magic circle (rune ring with inner star polygon, concentric rings, arcane glyphs, ornate details), perfectly top-down orthographic view, centered, filling the square image, rendered in white and light grey glow only (no color) on a pure black background, designed to be tinted in game. Square image.",
 "emotes": STYLE + MAG + "A sheet of exactly 12 cute Ragnarok Online style emote icons in a 4 columns x 3 rows grid (reading order left to right, top to bottom): 1 pink heart, 2 blue sweat drop, 3 red exclamation mark, 4 yellow question mark, 5 red angry vein pop symbol, 6 music note, 7 gold sparkle star, 8 ZZZ sleeping letters, 9 pink blush cheeks with lines, 10 broken heart, 11 speech bubble with three dots '...', 12 laughing happy face with tears of joy. Bold dark outlines, each icon similar size, wide magenta gaps.",
}


def gen():
    os.makedirs(RAW, exist_ok=True)
    lines = ["Use your built-in image generation tool %d separate times (fresh generation each). After each, copy the generated PNG unchanged to the destination path. Reply only with saved paths." % len(JOBS)]
    for k, (n, p) in enumerate(JOBS.items(), 1):
        lines.append("\nIMAGE %d -> save to %s\nPrompt: %s" % (k, os.path.join(RAW, n + ".png").replace("\\", "/"), p))
    cmd = [shutil.which("codex.cmd") or "codex", "exec", "--skip-git-repo-check", "-s", "workspace-write", "-"]
    r = subprocess.run(cmd, input="\n".join(lines), capture_output=True, text=True, cwd=ROOT, encoding="utf-8", errors="replace")
    open(os.path.join(ROOT, "tools", "art", "gen_fx.log"), "w", encoding="utf-8").write((r.stdout or "")[-3000:] + (r.stderr or "")[-2000:])


def center(sp, w, h, s):
    sp = sp.resize((max(1, round(sp.width * s)), max(1, round(sp.height * s))), Image.LANCZOS)
    c = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    c.alpha_composite(sp, ((w - sp.width) // 2, (h - sp.height) // 2))
    return c


def grid_split(im, cols, rows, dil=12):
    from scipy import ndimage as ndi
    arr = np.asarray(im).copy()
    H, W = arr.shape[:2]
    a = arr[..., 3] > 40
    lab, n = ndi.label(ndi.binary_dilation(a, iterations=dil))
    lab = lab * a
    cells = {}
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < 30:
            continue
        ys, xs = np.where(m)
        c = min(int(xs.mean() // (W / cols)), cols - 1); r = min(int(ys.mean() // (H / rows)), rows - 1)
        cells[r * cols + c] = cells.get(r * cols + c, np.zeros((H, W), bool)) | m
    out = []
    for k in range(cols * rows):
        m = cells.get(k)
        if m is None:
            out.append(Image.new("RGBA", (4, 4))); continue
        ys, xs = np.where(m)
        sub = arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        sub[..., 3] = np.where(m[ys.min():ys.max() + 1, xs.min():xs.max() + 1], sub[..., 3], 0)
        out.append(Image.fromarray(sub, "RGBA"))
    return out


def build():
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(RAW, "levelup_angel.png")
    if os.path.exists(p):
        sps = grid_split(chroma.key(Image.open(p).convert("RGBA")), 6, 1, 25)
        sps = [chroma.bbox_trim(s) for s in sps]
        S = 192
        s = (S * 0.96) / max(max(x.width for x in sps), max(x.height for x in sps))
        sheet = Image.new("RGBA", (S * len(sps), S), (0, 0, 0, 0))
        for i, sp in enumerate(sps):
            sheet.alpha_composite(center(sp, S, S, s), (i * S, 0))
        sheet.save(os.path.join(OUT, "levelup_angel.png"))
        json.dump({"frameWidth": S, "frameHeight": S, "frames": len(sps), "fps": 12}, open(os.path.join(OUT, "levelup_angel.json"), "w"))
        print("levelup_angel frames", len(sps))
    p = os.path.join(RAW, "cast_circle.png")
    if os.path.exists(p):
        im = Image.open(p).convert("RGB")
        lum = np.asarray(im.convert("L")).astype(np.float32)
        yy, xx = np.mgrid[:lum.shape[0], :lum.shape[1]]; rr = np.hypot(yy - lum.shape[0] / 2, xx - lum.shape[1] / 2) / (lum.shape[0] / 2)
        lum = np.clip((lum - 40) * 255 / (255 - 40), 0, 255) * np.clip((1.0 - rr) / 0.04, 0, 1)
        a = np.stack([np.full_like(lum, 255)] * 3 + [lum], -1).astype(np.uint8)
        Image.fromarray(a, "RGBA").resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "cast_circle.png"))
        print("cast_circle ok")
    p = os.path.join(RAW, "emotes.png")
    if os.path.exists(p):
        sps = grid_split(chroma.key(Image.open(p).convert("RGBA")), 4, 3, 14)
        sps = [chroma.bbox_trim(s) for s in sps]
        s = 56 / max(max(x.width for x in sps), max(x.height for x in sps))
        sheet = Image.new("RGBA", (256, 192), (0, 0, 0, 0))
        for i, sp in enumerate(sps[:12]):
            sheet.alpha_composite(center(sp, 64, 64, s), ((i % 4) * 64, (i // 4) * 64))
        sheet.save(os.path.join(OUT, "emotes.png"))
        names = ["heart", "sweat", "exclamation", "question", "angry", "music", "sparkle", "zzz", "blush", "broken_heart", "dots", "laugh"]
        json.dump({"frameWidth": 64, "frameHeight": 64, "cols": 4, "rows": 3, "frames": {n: i for i, n in enumerate(names)}}, open(os.path.join(OUT, "emotes.json"), "w"))
        print("emotes", len(sps))


if __name__ == "__main__":
    gen() if sys.argv[1] == "gen" else build()