import os
from PIL import Image
G = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", "gen"))
L = ["# Generated art (Codex image generation)", "", "All files produced by tools/art (see tools/art/README.md). `_raw/` holds raw generations (gitignored). Sprites are RGBA, bottom-center anchored (4px bottom pad, 2px side pad).", ""]
for cat in ["tiles", "characters", "props", "portraits", "ui", "ui/icons", "bg"]:
    d = os.path.join(G, cat)
    if not os.path.isdir(d):
        continue
    L += ["## " + cat + "/", "", "| file | size |", "|---|---|"]
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        if os.path.isfile(p) and f.lower().endswith((".png", ".jpg")):
            L.append("| %s | %dx%d |" % (f, *Image.open(p).size))
    L.append("")
L += ["Notes: wall blocks (tiles/*_wall.png) are 256 wide, ~256-265 tall (shorter than the 320 requested; bottom aligned). Ground tiles are exact 256x128 diamonds."]
open(os.path.join(G, "README.md"), "w").write("\n".join(L) + "\n")
