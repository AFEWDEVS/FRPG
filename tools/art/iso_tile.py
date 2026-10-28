"""Seamless square texture -> 256x128 iso diamond (exact inverse mapping, no rotation artifacts)."""
import numpy as np
from PIL import Image, ImageDraw


def make_seamless(img, border=0.5):
    im = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = im.shape
    sh = np.roll(np.roll(im, h // 2, 0), w // 2, 1)
    x = np.linspace(0, 1, w)
    y = np.linspace(0, 1, h)
    wx = np.clip(1 - np.abs(2 * x - 1), 0, 1) / border
    wy = np.clip(1 - np.abs(2 * y - 1), 0, 1) / border
    wx = np.clip(wx, 0, 1); wy = np.clip(wy, 0, 1)
    wx = wx * wx * (3 - 2 * wx)
    wy = wy * wy * (3 - 2 * wy)
    wgt = wx[None, :] * wy[:, None]  # 1 at center, 0 at borders: borders come from the half-shifted copy
    out = im * wgt[..., None] + sh * (1 - wgt[..., None])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def to_diamond(img, W=256, H=128, ss=2, seamless=True):
    img = img.convert("RGB")
    if img.width != img.height:
        s = min(img.size)
        img = img.crop(((img.width - s) // 2, (img.height - s) // 2, (img.width + s) // 2, (img.height + s) // 2))
    if seamless:
        img = make_seamless(img)
    img = img.resize((1024, 1024), Image.LANCZOS)
    S = 1024
    w2, h2 = W * ss, H * ss
    # inverse map: u = S*(x/W + y/H - .5), v = S*(y/H - x/W + .5)
    coeff = (S / w2, S / h2, -0.5 * S, -S / w2, S / h2, 0.5 * S)
    big = img.transform((w2, h2), Image.AFFINE, coeff, resample=Image.BICUBIC)
    mask = Image.new("L", (w2, h2), 0)
    ImageDraw.Draw(mask).polygon([(w2 / 2, 0), (w2 - 1, h2 / 2), (w2 / 2, h2 - 1), (0, h2 / 2)], fill=255)
    big = big.convert("RGBA")
    big.putalpha(mask)
    return big.resize((W, H), Image.LANCZOS)


def montage(tile, n=6, path="preview.png"):
    W, H = tile.size
    cv = Image.new("RGBA", (W * n, H * (n + 1)), (20, 20, 20, 255))
    for i in range(n):
        for j in range(n):
            x = (i - j) * W // 2 + W * n // 2 - W // 2
            y = (i + j) * H // 2
            cv.alpha_composite(tile, (x, y))
    cv.convert("RGB").save(path)