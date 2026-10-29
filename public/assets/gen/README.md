# Generated art (Codex image generation)

All files produced by tools/art (see tools/art/README.md). `_raw/` holds raw generations (gitignored). Sprites are RGBA, bottom-center anchored (4px bottom pad, 2px side pad).

## tiles/

| file | size |
|---|---|
| d1_floor.png | 256x128 |
| d1_wall.png | 256x265 |
| d2_floor.png | 256x128 |
| d2_wall.png | 256x256 |
| town_cobble.png | 256x128 |
| town_wall.png | 256x260 |
| w1_dirt.png | 256x128 |
| w1_forest_floor.png | 256x128 |
| w1_grass.png | 256x128 |
| w1_grass_flowers.png | 256x128 |
| w1_water.png | 256x128 |
| w2_ash.png | 256x128 |
| w2_lava.png | 256x128 |
| w2_obsidian.png | 256x128 |

## characters/

| file | size |
|---|---|
| amaranta.png | 188x260 |
| ash_golem.png | 309x304 |
| fire_elemental.png | 231x264 |
| goblin.png | 163x184 |
| heart_slime.png | 149x134 |
| hero_knight.png | 190x260 |
| hero_mage.png | 207x260 |
| hero_ranger.png | 200x260 |
| imp.png | 179x154 |
| jealous_gargoyle.png | 303x344 |
| malvarron.png | 288x304 |
| mushroom_man.png | 152x174 |
| npc_bard.png | 200x260 |
| npc_elder.png | 203x260 |
| npc_healer.png | 162x260 |
| npc_merchant.png | 200x260 |
| ogre_poet.png | 371x364 |
| skeleton.png | 246x224 |
| thorn_queen.png | 334x344 |
| wolf.png | 186x174 |

## props/

| file | size |
|---|---|
| barrel.png | 59x84 |
| brazier.png | 76x134 |
| bush.png | 120x94 |
| campfire.png | 95x94 |
| chest_closed.png | 87x84 |
| chest_open.png | 88x94 |
| crate.png | 66x74 |
| crystal.png | 126x144 |
| dead_tree.png | 252x284 |
| dungeon_entrance.png | 278x264 |
| fence.png | 104x94 |
| flowers.png | 60x54 |
| house_1.png | 279x344 |
| house_2.png | 259x364 |
| lava_rock.png | 117x114 |
| market_stall.png | 196x204 |
| mushrooms.png | 86x74 |
| obsidian_spire.png | 174x244 |
| rock_1.png | 101x84 |
| rock_2.png | 154x114 |
| ruins_pillar.png | 160x264 |
| skull_pile.png | 106x74 |
| stairs_down.png | 147x124 |
| torch.png | 44x114 |
| tree_oak_1.png | 260x304 |
| tree_oak_2.png | 298x304 |
| tree_pine.png | 211x324 |
| waypoint.png | 163x164 |
| well.png | 117x154 |

## portraits/

| file | size |
|---|---|
| amaranta.png | 256x256 |
| bard.png | 256x256 |
| elder.png | 256x256 |
| healer.png | 256x256 |
| hero_knight.png | 256x256 |
| hero_mage.png | 256x256 |
| hero_ranger.png | 256x256 |
| malvarron.png | 256x256 |
| merchant.png | 256x256 |

## ui/

| file | size |
|---|---|
| button.png | 300x80 |
| orb_frame.png | 300x300 |
| orb_health.png | 256x256 |
| orb_mana.png | 256x256 |
| panel_stone.png | 512x512 |
| parchment.png | 768x768 |
| slot.png | 64x64 |

## ui/icons/

| file | size |
|---|---|
| item_amulet.png | 64x64 |
| item_amulet_quest.png | 64x64 |
| item_armor.png | 64x64 |
| item_axe.png | 64x64 |
| item_belt.png | 64x64 |
| item_boots.png | 64x64 |
| item_bow.png | 64x64 |
| item_gloves.png | 64x64 |
| item_gold.png | 64x64 |
| item_helm.png | 64x64 |
| item_letter_page.png | 64x64 |
| item_mace.png | 64x64 |
| item_potion_health.png | 64x64 |
| item_potion_mana.png | 64x64 |
| item_ring.png | 64x64 |
| item_rose_bouquet.png | 64x64 |
| item_shield.png | 64x64 |
| item_staff.png | 64x64 |
| item_sword.png | 64x64 |
| item_wand.png | 64x64 |
| skill_armadura_escarcha.png | 64x64 |
| skill_aura_coraje.png | 64x64 |
| skill_bola_fuego.png | 64x64 |
| skill_carga_heroica.png | 64x64 |
| skill_escudo_radiante.png | 64x64 |
| skill_flecha_explosiva.png | 64x64 |
| skill_flecha_multiple.png | 64x64 |
| skill_golpe_valiente.png | 64x64 |
| skill_lluvia_flechas.png | 64x64 |
| skill_martillo_celestial.png | 64x64 |
| skill_meteoro.png | 64x64 |
| skill_nova_hielo.png | 64x64 |
| skill_paso_ligero.png | 64x64 |
| skill_rayo_encadenado.png | 64x64 |
| skill_serenata.png | 64x64 |
| skill_teletransporte.png | 64x64 |
| skill_torbellino.png | 64x64 |
| skill_trampa_espinas.png | 64x64 |

## bg/

| file | size |
|---|---|
| charselect.jpg | 1920x1080 |
| ending.jpg | 1920x1080 |
| title.jpg | 1920x1080 |

Notes: wall blocks (tiles/*_wall.png) are 256 wide, ~256-265 tall (shorter than the 320 requested; bottom aligned). Ground tiles are exact 256x128 diamonds.


## anim/ (animation sheets)

`anim/<key>.png` + `anim/<key>.json` for all 20 characters. 4x4 uniform grid, cell = frameWidth x frameHeight (varies per character, see json), feet aligned to cell bottom-center (4px pad), all frames of a character share one scale (character height ~= static sprite height). Frames: 0-3 walk_down (facing down-right), 4-7 walk_up (facing up-right), 8-11 attack_down (NPCs: talk/gesture), 12-13 idle, 14 hurt, 15 death. Flip X for left. Anim defs live in each json (`anims`). Regenerate: `python tools/art/anim_gen.py key` (raw to `_raw/anim/`), then `python tools/art/anim_sheet.py key`. Previews: `tools/art/previews/anim_<key>.gif` and `_sheet.png`. Cells are wide because attack FX and the death pose extend sideways; anchor is feet-centroid, so use origin (0.5, 1).

## fx/

- `levelup_angel.png` + `.json`: 6-frame horizontal strip, 192x192 frames, 12 fps.
- `cast_circle.png`: 512x512 white circle with luminance alpha, tint in game.
- `emotes.png` + `emotes.json`: 4x3 grid of 64x64 cells; json `frames` maps name to index (heart, sweat, exclamation, question, angry, music, sparkle, zzz, blush, broken_heart, dots, laugh).

## Audit

`python tools/art/audit.py [--fix]` scans characters/props/ui/icons for border-connected black or opaque backgrounds. Current result: 0 flagged (icons are rounded dark tiles by design, with transparent corners).


## WORLD REPAINT v2 (painterly oil style) - current art direction

Characters/anim/portraits/icons are unchanged (chibi). The WORLD (tiles, walls, props) was repainted in a painterly oil style (visible brush strokes, impasto, earthy palette with saturated accents) for a closer camera (~1.5-2x). Old versions are in `_raw/old/{tiles,props,ui}/`. Raws: `_raw/v2/`. Pipeline: `tools/art/jobs2.py` (prompts) -> `gen2.py "id,id" ...` -> `build2.py [tiles walls props atmo ui]`. Previews in `_raw/previews/v2/`.

- **Ground tiles are now 512x256 diamonds** (same filenames, 11 keys; scale old code by 2x or use displayWidth 256 for the old size). Seamless, verified with 6x6 iso montages.
- **Wall blocks are now 512 wide**: d1_wall 512x784, d2_wall 512x790, town_wall 512x768 (about 1.5x tile width tall; bottom diamond footprint 512x256 is at the bottom, anchor bottom-center).
- **Props** are about 1.6x their old pixel height (bottom-center anchored, 4px bottom pad). 17 NEW props: cliff_1, cliff_2, ruin_arch, broken_wall, bridge_wood, big_root, giant_mushroom, waterfall_rock, banner_festival, lantern_string, statue_heart, lava_pillar, arcane_obelisk, chains_hanging, cobweb_corner, stalagmite, bones_large.
- **atmo/** (RGBA, luminance->alpha): god_rays 1024x1024 (white, use ADD), fog_wisp_1/2 1024x512 (white, NORMAL/ADD low alpha), light_pool 512 (white glow, ADD, tint it), shadow_blob 512 (dark, NORMAL/MULTIPLY), paint_vignette 1920x1080 (dark brushy edges, transparent center, stretch to screen), paper_grain 512 (opaque gray tileable, use as OVERLAY/MULTIPLY at low alpha).
- **ui2/**: orb_life_small, orb_mana_small (160, painted glass orbs with gold rim), bar_frame 600x40 (transparent outside), bar_fill_red/gold/blue 600x24 (opaque brushy, crop with setCrop to show %), slot_round 64, panel_painted 512x512 (opaque, dark with thin gold rim inset ~14px: use as 9-slice with ~48px borders), button_painted 240x64, divider 512x32.

### tiles/ (v2)
| file | size |
|---|---|
| d1_floor.png | 512x256 |
| d1_wall.png | 512x784 |
| d2_floor.png | 512x256 |
| d2_wall.png | 512x790 |
| town_cobble.png | 512x256 |
| town_wall.png | 512x768 |
| w1_dirt.png | 512x256 |
| w1_forest_floor.png | 512x256 |
| w1_grass.png | 512x256 |
| w1_grass_flowers.png | 512x256 |
| w1_water.png | 512x256 |
| w2_ash.png | 512x256 |
| w2_lava.png | 512x256 |
| w2_obsidian.png | 512x256 |

### props/ (v2)
| file | size |
|---|---|
| arcane_obelisk.png | 328x424 |
| banner_festival.png | 312x404 |
| barrel.png | 102x132 |
| big_root.png | 272x264 |
| bones_large.png | 175x164 |
| brazier.png | 167x212 |
| bridge_wood.png | 206x204 |
| broken_wall.png | 230x224 |
| bush.png | 169x148 |
| campfire.png | 156x148 |
| chains_hanging.png | 283x324 |
| chest_closed.png | 136x132 |
| chest_open.png | 132x148 |
| cliff_1.png | 376x404 |
| cliff_2.png | 359x404 |
| cobweb_corner.png | 242x244 |
| crate.png | 107x116 |
| crystal.png | 223x228 |
| dead_tree.png | 438x452 |
| dungeon_entrance.png | 469x420 |
| fence.png | 148x148 |
| flowers.png | 90x84 |
| giant_mushroom.png | 345x364 |
| house_1.png | 579x548 |
| house_2.png | 525x580 |
| lantern_string.png | 284x264 |
| lava_pillar.png | 205x384 |
| lava_rock.png | 194x180 |
| market_stall.png | 312x324 |
| mushrooms.png | 112x116 |
| obsidian_spire.png | 358x388 |
| rock_1.png | 157x132 |
| rock_2.png | 181x180 |
| ruin_arch.png | 426x424 |
| ruins_pillar.png | 261x420 |
| skull_pile.png | 129x116 |
| stairs_down.png | 224x196 |
| stalagmite.png | 249x264 |
| statue_heart.png | 350x404 |
| torch.png | 82x180 |
| tree_oak_1.png | 464x484 |
| tree_oak_2.png | 632x484 |
| tree_pine.png | 385x516 |
| waterfall_rock.png | 402x404 |
| waypoint.png | 297x260 |
| well.png | 214x244 |

### atmo/
| file | size |
|---|---|
| fog_wisp_1.png | 1024x512 |
| fog_wisp_2.png | 1024x512 |
| god_rays.png | 1024x1024 |
| light_pool.png | 512x512 |
| paint_vignette.png | 1920x1080 |
| paper_grain.png | 512x512 |
| shadow_blob.png | 512x512 |

### ui2/
| file | size |
|---|---|
| bar_fill_blue.png | 600x24 |
| bar_fill_gold.png | 600x24 |
| bar_fill_red.png | 600x24 |
| bar_frame.png | 600x40 |
| button_painted.png | 240x64 |
| divider.png | 512x32 |
| orb_life_small.png | 160x160 |
| orb_mana_small.png | 160x160 |
| panel_painted.png | 512x512 |
| slot_round.png | 64x64 |
