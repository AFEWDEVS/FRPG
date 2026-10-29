"""Job definitions: each job = one generated raw image (a single asset or a sheet of several)."""
STYLE = ("Dark fantasy hand-painted 2D game art in the style of late-90s isometric action RPGs like Diablo II, "
         "blended with the charming, slightly chibi proportions and warm colors of Ragnarok Online. "
         "Rich painterly shading, strong rim light, high detail, readable silhouette. "
         "Romantic-comedy tone: whimsical, a bit funny. ")
SPRITE = ("3/4 isometric top-down view (camera ~35 degrees), full body, centered, facing down-right, "
          "on a perfectly flat solid #FF00FF magenta background, no ground, no cast shadow, no text, no border. ")
SHEET = ("This is a SPRITE SHEET: {n} separate subjects arranged in a clean {cols}x{rows} grid, each fully visible and uncropped, "
         "with wide empty #FF00FF magenta gaps between them so nothing touches or overlaps. Every subject drawn in the same view. "
         "Subjects, left to right, top to bottom: ")
TILE = ("SEAMLESS TILEABLE top-down (straight overhead orthographic, no perspective) square ground texture, "
        "edges wrap perfectly, uniform lighting with no vignette, no objects, no large focal features, no text, no border. Texture: ")

jobs = {}  # id -> dict(prompt, out, images=[])


def add(id, cat, prompt, images=None):
    jobs[id] = dict(prompt=prompt, out=f"public/assets/gen/_raw/{cat}/{id}.png", images=images or [])


# ---- tiles
tiles = {
    "town_cobble": "worn medieval cobblestone street, warm grey and brown stones, small moss in cracks",
    "w1_grass": "lush green meadow grass, painterly, slightly warm",
    "w1_grass_flowers": "green meadow grass with sparse tiny pink and white flowers",
    "w1_dirt": "packed brown dirt path with small pebbles",
    "w1_forest_floor": "dark forest floor with dead leaves, pine needles, moss and twigs",
    "w1_water": "deep teal water surface with soft ripples and highlights",
    "d1_floor": "mossy cave stone floor, irregular grey flagstones with green moss, dark",
    "w2_ash": "grey volcanic ash ground with faint ember specks and cracks",
    "w2_lava": "cracked dark basalt rock with glowing orange lava in the cracks",
    "w2_obsidian": "polished black obsidian glassy rock with purple-blue reflections and sharp facets",
    "d2_floor": "arcane purple ruin floor tiles, dark stone slabs with faint glowing purple rune lines",
}
for k, v in tiles.items():
    add(k, "tiles", STYLE + TILE + v + ".")

walls = {
    "d1_wall": "rough cave rock wall block with mossy edges",
    "d2_wall": "dark arcane brick wall block with glowing purple runes",
    "town_wall": "medieval grey stone wall block with green ivy growing on it",
}
for k, v in walls.items():
    add(k, "walls", STYLE + "Isometric game wall block, cube-like: a single solid block, " + v +
        ". Wide diamond-shaped top face and two visible side faces; the bottom diamond footprint is exactly twice as wide as it is tall (2:1), "
        "the block is about 1.25 times as tall as the footprint is wide. Centered, on a perfectly flat solid #FF00FF magenta background, no ground, no cast shadow, no text.")


def sheet(id, cat, cols, rows, descs, extra="", images=None, sprite=True):
    n = len(descs)
    p = STYLE + (SPRITE if sprite else "") + SHEET.format(n=n, cols=cols, rows=rows) + "; ".join(f"({i+1}) {d}" for i, d in enumerate(descs)) + ". " + extra
    add(id, cat, p, images)


# ---- characters (sheets of 4, 2x2)
chars = [
    ("chars_a", ["hero_knight: gallant young knight in shining steel armor with a red plume and a single red rose pinned to his chest, sword at hip",
                 "hero_mage: arcanist in a deep blue robe covered in stars, pointy hat, holding a glowing staff",
                 "hero_ranger: troubadour archer with a lute strapped on his back and a short bow, feathered cap, green and brown clothes",
                 "amaranta: beautiful noble lady in an elegant flowing red dress, long dark hair, holding a small fan"]),
    ("chars_b", ["npc_elder: Abuelo Tobias, a kindly old man with a long white beard, brown robe, wooden walking stick",
                 "npc_merchant: Gertrudis, a stout cheerful merchant woman with an apron, big backpack of wares, rosy cheeks",
                 "npc_healer: Hermana Melisa, a gentle nun healer in white and blue habit holding a little glowing book",
                 "npc_bard: Pipo, a goofy bard in colorful mismatched clothes with a big feathered hat, holding a small mandolin"]),
    ("chars_c", ["goblin: scrappy green goblin with a rusty dagger and a ridiculous oversized helmet",
                 "heart_slime: cute pink heart-shaped slime blob with big shiny eyes",
                 "wolf: grey dark-fantasy wolf in a snarling-yet-goofy stance, on all fours",
                 "mushroom_man: walking humanoid mushroom with a red spotted cap and tiny arms"]),
    ("chars_d", ["imp: small red horned imp with bat wings and a mischievous grin, holding a tiny pitchfork",
                 "skeleton: lanky skeleton warrior with a cracked shield and rusty sword, funny grin",
                 "fire_elemental: humanoid made of swirling flames and glowing embers",
                 "ash_golem: huge hulking golem of grey volcanic ash and charred rock with glowing orange eyes"]),
    ("chars_e", ["thorn_queen: Reina Espinas, a plant queen made of thorny vines and blooming red roses, crown of thorns, imposing",
                 "ogre_poet: Ogro Poeta, a big hulking ogre holding a feather quill and a long scroll, wearing a tiny beret, dramatic poetic pose",
                 "jealous_gargoyle: Gargola Celosa, a green-tinted stone gargoyle with wings folded, glaring jealously with arms crossed",
                 "malvarron: Lord Malvarron, a vain flamboyant wizard with a huge curled mustache, purple and gold robes, tall gold-trimmed hat, holding a staff"]),
]
for id, d in chars:
    sheet(id, "characters", 2, 2, d, "Each subject large, filling most of its grid cell. Do not draw the names as text.")

# ---- props (sheets of 6, 3x2)
props = [
    ("props_a", ["tree_oak_1: big gnarled leafy oak tree", "tree_oak_2: a different leafy oak tree with thick roots, fuller crown",
                 "tree_pine: tall dark green pine tree", "bush: round green bush with a few berries",
                 "rock_1: small mossy boulder", "rock_2: larger grey rock formation"]),
    ("props_b", ["mushrooms: cluster of glowing blue-green magical mushrooms", "flowers: patch of pink and red romantic roses and flowers",
                 "fence: short section of wooden fence, isometric diagonal", "house_1: cozy medieval cottage with thatched roof, warm lit windows",
                 "house_2: taller medieval timber-frame house with chimney and balcony", "well: old stone well with wooden roof and bucket"]),
    ("props_c", ["market_stall: colorful market stall with striped awning and fruit and goods", "campfire: small campfire with logs, lit, and stones around it",
                 "chest_closed: ornate wooden treasure chest with iron bands, closed", "chest_open: the same treasure chest open with golden glow inside",
                 "barrel: wooden barrel", "crate: wooden crate"]),
    ("props_d", ["waypoint: glowing blue magical rune platform, circular stone with luminous blue runes and light pillar", "dungeon_entrance: dark cave mouth set in a rock face with a wooden support frame",
                 "stairs_down: stone stairway descending into the ground, short block with steps", "dead_tree: twisted leafless dead tree",
                 "lava_rock: dark rock with glowing orange lava cracks", "crystal: cluster of purple glowing crystals"]),
    ("props_e", ["obsidian_spire: tall jagged black obsidian spire with purple sheen", "skull_pile: pile of bones and skulls",
                 "brazier: iron brazier with a lit flame on a stand", "torch: standing wooden torch with a lit flame",
                 "ruins_pillar: broken ancient stone pillar with cracks and vines", "bone_pile_extra: a small cluster of old bones and a ribcage"]),
]
for id, d in props:
    sheet(id, "props", 3, 2, d, "Do not draw the names as text.")


# ---- icons (sheets of 12, 4x3)
def icon_sheet(id, descs):
    p = (STYLE + "ICON SHEET: " + str(len(descs)) + " separate square painted game inventory/skill icons in a clean 4x3 grid, each a square dark ornate painted tile "
         "with a rounded-corner dark background and the glowing subject centered, front view (not isometric), no text, no frame border. "
         "Wide flat #FF00FF magenta gaps between the icons so none touch. Icons left to right, top to bottom: " + "; ".join(f"({i+1}) {d}" for i, d in enumerate(descs)) + ".")
    add(id, "icons", p)


icon_sheet("icons_a", ["golpe valiente: a mighty sword strike glowing", "carga heroica: knight charging with a shield dashing", "torbellino: spinning whirlwind of blades",
                       "escudo radiante: shining golden shield", "aura coraje: red-gold aura around a fist", "martillo celestial: glowing holy hammer from the sky",
                       "bola fuego: fireball", "nova hielo: ice nova burst of frost crystals", "rayo encadenado: chain lightning bolts",
                       "meteoro: flaming meteor falling", "teletransporte: purple portal swirl with sparkles", "armadura escarcha: frosty blue ice armor"])
icon_sheet("icons_b", ["flecha multiple: three arrows fanning out", "flecha explosiva: arrow with an exploding tip", "lluvia flechas: arrows raining from above",
                       "trampa espinas: thorny trap with roses", "serenata: a lute with floating pink hearts and music notes", "paso ligero: winged boot",
                       "item_sword: steel sword", "item_axe: battle axe", "item_mace: spiked mace", "item_staff: wizard staff with orb", "item_wand: small magic wand with star", "item_bow: wooden bow"])
icon_sheet("icons_c", ["item_shield: round heraldic shield", "item_helm: knight helmet", "item_armor: steel chest armor", "item_gloves: leather gauntlets",
                       "item_boots: leather boots", "item_belt: leather belt with gold buckle", "item_ring: gold ring with ruby", "item_amulet: amulet necklace with blue gem",
                       "item_potion_health: red potion flask", "item_potion_mana: blue potion flask", "item_gold: pile of gold coins", "item_letter_page: a torn love-letter page with a heart seal"])
icon_sheet("icons_d", ["item_rose_bouquet: bouquet of red roses tied with ribbon", "item_amulet_quest: glowing pink heart-shaped quest amulet on a chain"])

# ---- ui
add("panel_stone", "ui", STYLE + "SEAMLESS TILEABLE dark carved stone panel texture, straight-on flat view, plain and subtle: rough hewn dark grey stone slab with fine cracks and chisel marks only, NO figures, NO faces, NO characters, NO motifs, uniform lighting, edges wrap perfectly, no text, no border.")
add("parchment", "ui", STYLE + "Flat straight-on aged parchment paper texture filling the whole image edge to edge, blank empty parchment: only subtle stains, fibers and slightly darker burnt edges, ABSOLUTELY NO illustrations, NO figures, NO characters, NO drawings, NO text.")
add("ui_sheet", "ui", STYLE + "UI SHEET on a flat solid #FF00FF magenta background with wide gaps: (1) a round glass health orb sphere filled with glowing red liquid, front view, no frame; "
    "(2) a round glass mana orb sphere filled with glowing blue liquid, front view, no frame; (3) an empty ornate gothic metal ring frame (circular, hollow center shown as magenta) for an orb; "
    "(4) a wide gothic stone-and-metal rectangular game button, aspect ratio about 4:1; (5) a small dark inventory slot, square, dark recessed with a thin metal bevel. Front view, no text.")

# ---- bg
add("title", "bg", STYLE + "Wide 16:9 cinematic key art for the game title screen: a gallant knight seen from behind-side holding a single red rose, before a dark gothic castle on a hill under two moons (one big pale, one small pink). Empty sky space at the top-center for a logo. No text.")
add("charselect", "bg", STYLE + "Wide 16:9 painted background: a dim cozy medieval tavern hall with warm candlelight, wooden beams, long tables, empty center floor. No characters, no text.")
add("ending", "bg", STYLE + "Wide 16:9 cinematic scene: a knight hero and a beautiful noble lady in a red dress dancing at a village festival under two moons, colorful fireworks in the sky, lanterns. No text.")
# ---- portraits (use the final character sprite as reference image)
PORT = {
    "hero_knight": ("hero_knight", "the gallant young knight with the red plume and rose"),
    "hero_mage": ("hero_mage", "the star-robed arcanist mage"),
    "hero_ranger": ("hero_ranger", "the troubadour archer"),
    "amaranta": ("amaranta", "the beautiful noble lady in the red dress"),
    "elder": ("npc_elder", "the bearded elder Abuelo Tobias"),
    "merchant": ("npc_merchant", "the stout cheerful merchant woman Gertrudis"),
    "healer": ("npc_healer", "the nun healer Hermana Melisa"),
    "bard": ("npc_bard", "the goofy bard Pipo"),
    "thorn_queen": ("thorn_queen", "the Thorn Queen, a rose-crowned thorny vine queen boss"),
    "ogre_poet": ("ogre_poet", "the Ogre Poet, a hulking green ogre bard with a red beret, feather quill and poem scroll"),
    "jealous_gargoyle": ("jealous_gargoyle", "the Jealous Gargoyle, a brooding winged stone gargoyle boss"),
    "malvarron": ("malvarron", "the vain flamboyant wizard Lord Malvarron with his huge mustache"),
}
for pid, (cid, desc) in PORT.items():
    sub = "characters" if cid.startswith(("hero", "amar", "malv")) else "characters"
    add("portrait_" + pid, "portraits",
        STYLE + "Painted bust portrait (head and shoulders, front three-quarter view, expressive face) of " + desc +
        ", exactly matching the character design in the attached reference image (same face, hair, clothes, colors). "
        "Square composition, dark moody vignette background (deep dark brown/black, NO magenta), rich painterly shading, no text, no border.",
        images=["public/assets/gen/characters/%s.png" % cid])