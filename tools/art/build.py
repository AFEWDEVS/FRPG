"""Post-process raw generations into final assets. usage: python build.py [group ...]  groups: tiles walls chars props icons ui bg"""
import os, sys
from PIL import Image
from chroma import key, bbox_trim, split_sheet, fit_sprite
from iso_tile import to_diamond, montage, make_seamless

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")
RAW = os.path.join(GEN, "_raw")
PREV = os.path.join(RAW, "previews")
os.makedirs(PREV, exist_ok=True)


def out(cat, name, im):
    os.makedirs(os.path.join(GEN, cat), exist_ok=True)
    im.save(os.path.join(GEN, cat, name + ".png"))


def raw(cat, id):
    p = os.path.join(RAW, cat, id + ".png")
    return Image.open(p) if os.path.exists(p) else None


TILES = ["town_cobble", "w1_grass", "w1_grass_flowers", "w1_dirt", "w1_forest_floor", "w1_water", "d1_floor", "w2_ash", "w2_lava", "w2_obsidian", "d2_floor"]
WALLS = ["d1_wall", "d2_wall", "town_wall"]
CHARS = {
    "chars_a": [("hero_knight", 256), ("hero_mage", 256), ("hero_ranger", 256), ("amaranta", 256)],
    "chars_b": [("npc_elder", 256), ("npc_merchant", 256), ("npc_healer", 256), ("npc_bard", 256)],
    "chars_c": [("goblin", 180), ("heart_slime", 130), ("wolf", 170), ("mushroom_man", 170)],
    "chars_d": [("imp", 150), ("skeleton", 220), ("fire_elemental", 260), ("ash_golem", 300)],
    "chars_e": [("thorn_queen", 340), ("ogre_poet", 360), ("jealous_gargoyle", 340), ("malvarron", 300)],
}
PROPS = {
    "props_a": [("tree_oak_1", 300), ("tree_oak_2", 300), ("tree_pine", 320), ("bush", 90), ("rock_1", 80), ("rock_2", 110)],
    "props_b": [("mushrooms", 70), ("flowers", 50), ("fence", 90), ("house_1", 340), ("house_2", 360), ("well", 150)],
    "props_c": [("market_stall", 200), ("campfire", 90), ("chest_closed", 80), ("chest_open", 90), ("barrel", 80), ("crate", 70)],
    "props_d": [("waypoint", 160), ("dungeon_entrance", 260), ("stairs_down", 120), ("dead_tree", 280), ("lava_rock", 110), ("crystal", 140)],
    "props_e": [("obsidian_spire", 240), ("skull_pile", 70), ("brazier", 130), ("torch", 110), ("ruins_pillar", 260), (None, 0)],
}
ICONS = {
    "icons_a": ["skill_golpe_valiente", "skill_carga_heroica", "skill_torbellino", "skill_escudo_radiante", "skill_aura_coraje", "skill_martillo_celestial",
                "skill_bola_fuego", "skill_nova_hielo", "skill_rayo_encadenado", "skill_meteoro", "skill_teletransporte", "skill_armadura_escarcha"],
    "icons_b": ["skill_flecha_multiple", "skill_flecha_explosiva", "skill_lluvia_flechas", "skill_trampa_espinas", "skill_serenata", "skill_paso_ligero",
                "item_sword", "item_axe", "item_mace", "item_staff", "item_wand", "item_bow"],
    "icons_c": ["item_shield", "item_helm", "item_armor", "item_gloves", "item_boots", "item_belt", "item_ring", "item_amulet",
                "item_potion_health", "item_potion_mana", "item_gold", "item_letter_page"],
    "icons_d": ["item_rose_bouquet", "item_amulet_quest"],
}


def sheet_rows(n, cols):
    return -(-n // cols)


def do_tiles():
    ims = []
    for t in TILES:
        r = raw("tiles", t)
        if r is None:
            print("missing raw", t); continue
        d = to_diamond(r)
        out("tiles", t, d)
        ims.append(d)
        # square seamless preview (2x2 repeat)
        s = make_seamless(r.convert("RGB").resize((256, 256)))
        rep = Image.new("RGB", (512, 512))
        for i in range(2):
            for j in range(2):
                rep.paste(s, (i * 256, j * 256))
        rep.save(os.path.join(PREV, "sq_" + t + ".png"))
    for t, d in zip([t for t in TILES if raw("tiles", t) is not None], ims):
        montage(d, 6, os.path.join(PREV, "iso_" + t + ".png"))


def do_walls():
    for w in WALLS:
        r = raw("walls", w)
        if r is None:
            continue
        sp = bbox_trim(key(r))
        h = round(sp.height * 256 / sp.width)
        sp = sp.resize((256, h), Image.LANCZOS)
        cv = Image.new("RGBA", (256, h + 2), (0, 0, 0, 0))
        cv.paste(sp, (0, 0), sp)
        out("tiles", w, cv)
        print(w, cv.size)


def do_sheets(table, cat, rawcat, cols):
    for sid, items in table.items():
        r = raw(rawcat, sid)
        if r is None:
            print("missing raw", sid); continue
        k = key(r)
        sps, found = split_sheet(k, len(items), rows=sheet_rows(len(items), cols))
        print(sid, "expected", len(items), "found", found)
        for (name, h), sp in zip(items, sps):
            if name is None:
                continue
            out(cat, name, fit_sprite(sp, h))
        # debug contact sheet
        cs = Image.new("RGBA", (180 * len(sps), 260), (60, 60, 70, 255))
        for i, sp in enumerate(sps):
            t = sp.copy(); t.thumbnail((170, 250)); cs.alpha_composite(t, (i * 180 + 5, 5))
        cs.convert("RGB").save(os.path.join(PREV, sid + "_contact.png"))


def do_icons():
    for sid, names in ICONS.items():
        r = raw("icons", sid)
        if r is None:
            print("missing raw", sid); continue
        k = key(r)
        sps, found = split_sheet(k, 12, rows=3, merge=3)
        print(sid, "expected", len(names), "found", found)
        for n, sp in zip(names, sps):
            sp = bbox_trim(sp)
            out("ui/icons", n, sp.resize((64, 64), Image.LANCZOS))
        cs = Image.new("RGBA", (70 * len(sps), 70), (60, 60, 70, 255))
        for i, n in enumerate(names[:len(sps)]):
            cs.alpha_composite(Image.open(os.path.join(GEN, "ui/icons", n + ".png")), (i * 70 + 3, 3))
        cs.resize((cs.width * 2, cs.height * 2)).convert("RGB").save(os.path.join(PREV, sid + "_contact.png"))


def do_ui():
    p = raw("ui", "panel_stone")
    if p is not None:
        out("ui", "panel_stone", make_seamless(p.convert("RGB").resize((512, 512), Image.LANCZOS)).convert("RGBA"))
    p = raw("ui", "parchment")
    if p is not None:
        out("ui", "parchment", p.convert("RGB").resize((768, 768), Image.LANCZOS).convert("RGBA"))
    r = raw("ui", "ui_sheet")
    if r is not None:
        sps, found = split_sheet(key(r), 5, rows=2, merge=4)
        print("ui_sheet found", found, [s.size for s in sps])
        cs = Image.new("RGBA", (300 * len(sps), 300), (60, 60, 70, 255))
        for i, sp in enumerate(sps):
            t = sp.copy(); t.thumbnail((290, 290)); cs.alpha_composite(t, (i * 300, 0))
        cs.convert("RGB").save(os.path.join(PREV, "ui_contact.png"))
        os.makedirs(os.path.join(RAW, "ui_parts"), exist_ok=True)
        for i, sp in enumerate(sps):
            sp.save(os.path.join(RAW, "ui_parts", "part%d.png" % i))


def fit_to(im, w, h):
    im = bbox_trim(im)
    s = min(w / im.width, h / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    cv = Image.new("RGBA", (w, h), (0, 0, 0, 0)); cv.paste(im, ((w - im.width) // 2, (h - im.height) // 2), im)
    return cv


def do_ui_parts(order):
    """order: dict name -> part index (after visual check)."""
    sizes = {"orb_health": (256, 256), "orb_mana": (256, 256), "orb_frame": (300, 300), "button": (300, 80), "slot": (64, 64)}
    for n, i in order.items():
        out("ui", n, fit_to(Image.open(os.path.join(RAW, "ui_parts", "part%d.png" % i)), *sizes[n]))


def do_bg():
    for n in ["title", "charselect", "ending"]:
        r = raw("bg", n)
        if r is None:
            continue
        r = r.convert("RGB")
        w, h = r.size
        ch = round(w * 9 / 16)
        top = (h - ch) // 2
        r = r.crop((0, top, w, top + ch)).resize((1920, 1080), Image.LANCZOS)
        os.makedirs(os.path.join(GEN, "bg"), exist_ok=True)
        r.save(os.path.join(GEN, "bg", n + ".jpg"), quality=90)
        print(n, "bg", (w, h))


if __name__ == "__main__":
    g = sys.argv[1:] or ["tiles", "walls", "chars", "props", "icons", "ui", "bg"]
    if "tiles" in g: do_tiles()
    if "walls" in g: do_walls()
    if "chars" in g: do_sheets(CHARS, "characters", "characters", 2)
    if "props" in g: do_sheets(PROPS, "props", "props", 3)
    if "icons" in g: do_icons()
    if "ui" in g: do_ui()
    if "bg" in g: do_bg()

def do_portraits():
    names = ["hero_knight", "hero_mage", "hero_ranger", "amaranta", "elder", "merchant", "healer", "bard", "malvarron"]
    os.makedirs(os.path.join(GEN, "portraits"), exist_ok=True)
    ims = []
    for n in names:
        r = raw("portraits", "portrait_" + n)
        if r is None:
            print("missing portrait", n); continue
        r = r.convert("RGB")
        s = min(r.size)
        r = r.crop(((r.width - s) // 2, (r.height - s) // 2, (r.width + s) // 2, (r.height + s) // 2)).resize((256, 256), Image.LANCZOS)
        r.save(os.path.join(GEN, "portraits", n + ".png")); ims.append(r)
    cv = Image.new("RGB", (256 * len(ims), 256))
    for i, r in enumerate(ims): cv.paste(r, (i * 256, 0))
    cv.save(os.path.join(PREV, "portraits_contact.png"))
