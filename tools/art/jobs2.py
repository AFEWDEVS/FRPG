"""v2 painterly world jobs. Raws go to public/assets/gen/_raw/v2/<cat>/<id>.png. Characters are NOT regenerated."""
STYLE2 = ("Rich hand-painted oil-painting style for a modern isometric action RPG: visible confident brush strokes, thick impasto paint texture, "
          "rich earthy palette with saturated accents, strong value contrast, soft painterly edges, warm moody lighting with a warm key light from the upper left, "
          "cool shadows, no outlines, no pixel art, no photorealism, no 3D render look. Slightly whimsical romantic-comedy fantasy tone. ")
SPRITE2 = ("3/4 isometric top-down view (camera ~35 degrees), each object fully visible and uncropped, standing on the ground, "
           "on a perfectly flat solid #FF00FF magenta background, no ground plane, no cast shadow, no text, no border. ")
TILE2 = ("SEAMLESS TILEABLE straight-overhead orthographic square ground texture, painted with visible brush strokes and impasto, edges wrap perfectly, "
         "even lighting with no vignette, no gradient across the image, no objects, no large focal features, no text, no border. Texture: ")
jobs = {}


def add(id, cat, prompt, images=None):
    jobs[id] = dict(prompt=prompt, out=f"public/assets/gen/_raw/v2/{cat}/{id}.png", images=images or [])


tiles = {
    "town_cobble": "warm worn cobblestone street of a festival town, rounded stones in terracotta, ochre, grey and cream, tiny moss in cracks, painted light and shadow on each stone",
    "w1_grass": "lush meadow grass, layered brush strokes of emerald, yellow-green and deep green, sunlit and slightly warm",
    "w1_grass_flowers": "lush meadow grass with sparse small painted pink, white and yellow wildflowers dabbed in impasto",
    "w1_dirt": "packed earthy brown and ochre dirt path with small pebbles and subtle wheel ruts, thick paint",
    "w1_forest_floor": "dark enchanted forest floor of fallen leaves, pine needles, moss and twigs, deep greens and warm browns with a few teal accents",
    "w1_water": "deep teal-blue water with soft painted ripples, brushy highlights and darker swirls",
    "d1_floor": "damp cave floor of irregular grey-blue flagstones with green moss and puddle glints, dark and moody",
    "w2_ash": "grey volcanic ash ground with charred cracks and a few faint orange ember dabs, smoky brush strokes",
    "w2_lava": "cracked dark basalt crust with glowing molten orange-yellow lava running through the cracks, strong glow contrast",
    "w2_obsidian": "polished black obsidian rock with purple and blue reflective facets and sharp painted glints",
    "d2_floor": "arcane ruin floor of dark violet stone slabs with faint glowing magenta-purple rune lines, worn edges",
}
for k, v in tiles.items():
    add(k, "tiles", STYLE2 + TILE2 + v + ".")

walls = {
    "d1_wall": "rough cave rock wall with layered strata, mossy edges and cool blue-grey light, damp",
    "d2_wall": "dark arcane violet brick wall with glowing purple runes and cracks, warm violet glow",
    "town_wall": "medieval warm grey-beige stone wall with green ivy and a few small flowers, mortar lines painted thickly",
}
for k, v in walls.items():
    add(k, "walls", STYLE2 + "Isometric game wall block, a single tall solid block: " + v +
        ". Wide diamond-shaped top face (lighter) and two visible side faces (left darker, right mid), the bottom diamond footprint is exactly twice as wide as it is tall (2:1), "
        "and the block is TALL: its total height is about 1.5 times its width. Fills most of the image, centered, on a perfectly flat solid #FF00FF magenta background, no ground, no cast shadow, no text.")


def sheet(id, cols, rows, descs, extra="Do not draw the names as text. Each subject large, filling most of its cell."):
    n = len(descs)
    p = (STYLE2 + SPRITE2 + f"This is a SPRITE SHEET of {n} separate subjects in a {cols}x{rows} grid (columns x rows) with wide empty #FF00FF magenta gaps between them so nothing touches or overlaps. "
         "Same view and same painterly style for all. Subjects left to right, top to bottom: " + "; ".join(f"({i+1}) {d}" for i, d in enumerate(descs)) + ". " + extra)
    add(id, "props", p)


SHEETS = {  # id: (cols, rows, [(key, height, desc)])
    "pv_big_a": (3, 1, [("tree_oak_1", 480, "big gnarled oak tree with a lush layered painted canopy of many leaf clusters in varied greens with warm yellow highlights, thick readable trunk with visible roots"),
                        ("tree_oak_2", 480, "a different oak tree, wider fuller crown, thick twisting trunk and roots, some dappled warm light on the leaves"),
                        ("tree_pine", 512, "tall dark teal-green pine tree with layered drooping boughs, reddish trunk, snow-free")]),
    "pv_big_b": (3, 1, [("dead_tree", 448, "twisted leafless dead tree with gnarled silhouette, grey-brown bark and a few hanging vines"),
                        ("house_1", 544, "cozy medieval cottage with a thatched roof, plaster walls, warm golden light glowing in the windows, flower boxes"),
                        ("house_2", 576, "taller timber-frame house with chimney smoke, balcony, tiled roof, warm lit windows, festival bunting")]),
    "pv_big_c": (3, 1, [("market_stall", 320, "colorful market stall with striped red and cream awning, crates of fruit and goods"),
                        ("dungeon_entrance", 416, "dark cave mouth set in a mossy rock face with a wooden support frame and a lantern"),
                        ("well", 240, "old stone well with a small wooden roof, rope and bucket, moss")]),
    "pv_big_d": (3, 1, [("obsidian_spire", 384, "tall jagged black obsidian spire with purple-blue sheen and glints"),
                        ("ruins_pillar", 416, "broken ancient carved stone pillar with cracks, vines and scorch marks"),
                        ("ruin_arch", 420, "ruined ancient stone archway, half collapsed, with scorched carved stones and glowing embers at the base")]),
    "pv_big_e": (3, 1, [("cliff_1", 400, "tall rocky cliff face segment, layered ochre and grey rock strata with moss and grass tufts on top, strong light from upper left"),
                        ("cliff_2", 400, "a different tall rocky cliff face segment with a cracked ledge and hanging roots, cooler grey-blue rock"),
                        ("waterfall_rock", 400, "rocky outcrop with a small waterfall pouring down into a foamy pool, mossy rocks, painted water highlights")]),
    "pv_big_f": (3, 1, [("broken_wall", 220, "section of crumbled old stone wall with ivy, broken top edge"),
                        ("bridge_wood", 200, "short wooden plank bridge section running diagonally along the isometric axis, with rope railings"),
                        ("big_root", 260, "huge gnarled tree root arching out of the ground, mossy, with small mushrooms")]),
    "pv_big_g": (3, 1, [("giant_mushroom", 360, "giant magical mushroom with a big red spotted cap with soft glowing teal underside, thick stalk, tiny glowing spores"),
                        ("statue_heart", 400, "romantic town statue of two stylized lovers holding a big heart together, weathered stone on a pedestal, rose petals at the base"),
                        ("arcane_obelisk", 420, "tall dark stone obelisk with glowing violet runes and floating small stone fragments, arcane energy")]),
    "pv_big_h": (3, 1, [("lava_pillar", 380, "tall pillar of cooled black basalt with glowing molten lava veins and rising embers"),
                        ("banner_festival", 400, "tall wooden pole with a hanging festive red and gold fabric banner with a heart emblem, fluttering"),
                        ("lantern_string", 260, "two short wooden posts connected by a sagging string of glowing warm paper lanterns and bunting")]),
    "pv_mid_a": (2, 2, [("waypoint", 256, "glowing blue magical rune platform, circular stone with luminous blue runes and a faint light pillar"),
                        ("stairs_down", 192, "stone stairway descending into the ground, short block with worn steps"),
                        ("crystal", 224, "cluster of purple glowing crystals with pink highlights"),
                        ("brazier", 208, "iron brazier on a stand with a lit orange flame")]),
    "pv_mid_b": (3, 2, [("chains_hanging", 320, "set of heavy iron chains hanging from above with shackles, rusty"),
                        ("cobweb_corner", 240, "thick dusty cobweb in a corner with a small spider, white-grey wisps"),
                        ("stalagmite", 260, "cluster of cave stalagmites, grey-blue rock with wet highlights"),
                        ("bones_large", 160, "large pile of old bones with a big ribcage and skull"),
                        ("fence", 144, "short section of wooden fence, isometric diagonal, weathered"),
                        ("skull_pile", 112, "pile of bones and skulls")]),
    "pv_small_a": (3, 2, [("bush", 144, "round green bush with a few red berries"), ("rock_1", 128, "small mossy boulder with impasto highlights"),
                          ("rock_2", 176, "larger grey rock formation, layered, mossy"), ("lava_rock", 176, "dark rock with glowing orange lava cracks"),
                          ("mushrooms", 112, "cluster of glowing blue-green magical mushrooms"), ("flowers", 80, "patch of pink and red roses and flowers")]),
    "pv_small_b": (3, 2, [("barrel", 128, "wooden barrel with iron hoops"), ("crate", 112, "wooden crate"),
                          ("chest_closed", 128, "ornate wooden treasure chest with iron bands, closed"), ("chest_open", 144, "the same style treasure chest open with golden glow inside"),
                          ("campfire", 144, "small campfire with logs and stones, lit with warm glow"), ("torch", 176, "standing wooden torch with a lit flame")]),
}
for sid, (c, r, items) in SHEETS.items():
    sheet(sid, c, r, [f"{k}: {d}" for k, h, d in items])

# ---- atmosphere (grayscale; converted to alpha afterwards)
ATM = "Painterly brushwork, soft, no hard edges, no text, no border. Pure grayscale only, no color. "
add("god_rays", "atmo", ATM + "Square image: pure black background with several soft diagonal shafts of light (god rays) falling from the top-right to the bottom-left at about 60 degrees, white to pale gray, soft feathered edges with faint brush streaks, varied widths, fading out toward the lower-left.")
add("fog_wisp_1", "atmo", ATM + "Wide 2:1 image: pure black background with a soft painterly cloud of fog / mist in white-gray, thick brushy swirls, feathered edges that fade fully to black before reaching the image borders.")
add("fog_wisp_2", "atmo", ATM + "Wide 2:1 image: pure black background with a different soft painterly drifting fog bank in white-gray, layered long horizontal brush swirls, feathered edges that fade fully to black before the image borders.")
add("light_pool", "atmo", ATM + "Square image: pure black background with a soft round warm-glow light pool in the center, white at the center falling off smoothly with subtle brush texture to pure black well before the borders.")
add("shadow_blob", "atmo", ATM + "Square image: pure white background with a soft irregular dark blob shadow (like a tree canopy shadow with slightly leafy lobed edges) in the center, dark gray to black at the center, feathered painterly edges fading to pure white well before the borders.")
add("paint_vignette", "atmo", ATM + "Wide 16:9 image: a painted frame vignette: the center is pure white and empty, the edges and corners are heavily darkened with dark brushy painted strokes in near-black gray, smooth gradient inward, irregular brush edge.")
add("paper_grain", "atmo", ATM + "SEAMLESS TILEABLE square subtle painter canvas and brush grain texture, mid-gray with very subtle fine canvas weave and faint bristle strokes, low contrast, uniform, edges wrap perfectly.")

# ---- ui
UI = "Elegant, discreet, dark fantasy painted UI art, oil-painting brush strokes, dark umber and aged gold palette. "
add("ui_a", "ui", STYLE2 + UI + "Three separate UI elements side by side on a flat #FF00FF magenta background with wide gaps, each front view, no text: "
    "(1) a round glass health orb, a glass sphere filled with glowing red liquid with painted highlights and a thin dark-gold rim; "
    "(2) a round glass mana orb, same style, filled with glowing blue liquid; "
    "(3) a small round empty inventory slot: dark recessed circle with a thin aged gold ring.")
add("ui_b", "ui", STYLE2 + UI + "Three separate UI elements stacked vertically on a flat #FF00FF magenta background with wide gaps, each front view, no text: "
    "(1) a very wide thin horizontal bar frame, aspect ratio about 15:1, thin painted dark-gold border with dark inside (not magenta); "
    "(2) a wide dark painted button plate, aspect ratio about 4:1, with a thin gold rim and subtle brushy texture; "
    "(3) a very wide thin painted gold ornamental divider, aspect 16:1, a horizontal flourish line with a small diamond in the center.")
add("ui_fills", "ui", STYLE2 + UI + "Flat image divided into three equal horizontal bands filling the whole image edge to edge: top band glowing crimson red thick brushy paint with lighter streaks, "
    "middle band glowing golden-yellow brushy paint, bottom band glowing blue brushy paint. Horizontal brush stroke texture, no text, no frames, no gaps.")
add("panel_painted", "ui", STYLE2 + UI + "Front view square dark panel filling the image: very dark brown-black painted surface with subtle brushy texture, brushy irregular darker edges, "
    "and a thin gold rim line inset near the border all around. Plain empty center, no characters, no text, no magenta.")

jobs["d2_wall"]["prompt"] += " IMPORTANT: the block must be WIDE, not a thin tall column: the full image of the block is only about 1.5 times as tall as it is wide (for example 1000px wide and 1500px tall), with a large visible top diamond face."
