import sys, os, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import audit
def sheet(files, out, cell=128, cols=8, bg="check"):
    rows = (len(files) + cols - 1) // cols
    S = Image.new("RGB", (cols * cell, rows * (cell + 14)), (128, 128, 128))
    if bg == "check":
        px = S.load()
        for y in range(S.height):
            for x in range(S.width):
                px[x, y] = (150, 150, 150) if ((x // 8 + y // 8) % 2) else (110, 110, 110)
    d = ImageDraw.Draw(S)
    for i, (name, p) in enumerate(files):
        im = Image.open(p).convert("RGBA"); im.thumbnail((cell - 4, cell - 4))
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        S.paste(im, (x + 2, y + 2), im); d.text((x + 2, y + cell), name[:20], fill=(255, 255, 0))
    S.save(out)
if __name__ == "__main__":
    kind = sys.argv[1]
    G = audit.GEN
    pv = os.path.join(os.path.dirname(__file__), "previews"); os.makedirs(pv, exist_ok=True)
    fl = [(f, p) for d, f, p in audit.targets() if d == kind]
    sheet(fl, os.path.join(pv, "audit_" + kind.replace("/", "_") + ".png"), cell=int(sys.argv[2]) if len(sys.argv) > 2 else 128, cols=int(sys.argv[3]) if len(sys.argv) > 3 else 8)