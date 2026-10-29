import { SKILLS } from '../data/skills';

/** Asset contract. Every key -> path (relative to site root). Missing files get procedural placeholders. */
export type ImageCategory = 'tile' | 'wall' | 'prop' | 'char' | 'portrait' | 'ui' | 'icon' | 'bg' | 'vfx';

export interface ImageEntry { key: string; path: string; category: ImageCategory; }
export interface AudioEntry { key: string; urls: string[]; kind: 'music' | 'sfx'; }

const G = 'assets/gen';
const list = (s: string) => s.split(/\s+/).filter(Boolean);

const imgs: ImageEntry[] = [];
const add = (keys: string[], dir: string, category: ImageCategory, ext = 'png', prefix = '') => {
  for (const k of keys) imgs.push({ key: prefix + k, path: `${G}/${dir}/${k}.${ext}`, category });
};

add(list('town_cobble w1_grass w1_grass_flowers w1_dirt w1_forest_floor w1_water d1_floor w2_ash w2_lava w2_obsidian d2_floor'), 'tiles', 'tile');
add(list('d1_wall d2_wall town_wall'), 'tiles', 'wall');
export const PROP_KEYS = list(
  'tree_oak_1 tree_oak_2 tree_pine bush rock_1 rock_2 mushrooms flowers fence house_1 house_2 well market_stall campfire chest_closed chest_open barrel crate waypoint dungeon_entrance stairs_down dead_tree lava_rock crystal obsidian_spire skull_pile brazier torch ruins_pillar',
);
add(PROP_KEYS, 'props', 'prop');
export const CHAR_KEYS = list(
  'hero_knight hero_mage hero_ranger amaranta npc_elder npc_merchant npc_healer npc_bard goblin heart_slime wolf mushroom_man thorn_queen ogre_poet imp skeleton fire_elemental ash_golem jealous_gargoyle malvarron',
);
add(CHAR_KEYS, 'characters', 'char');
// Portrait texture keys are prefixed "portrait_" (file: portraits/<key>.png)
add(list('hero_knight hero_mage hero_ranger amaranta elder merchant healer bard malvarron thorn_queen ogre_poet jealous_gargoyle'), 'portraits', 'portrait', 'png', 'portrait_');
// UI textures: key = "ui_" + file name
add(list('panel_stone orb_health orb_mana orb_frame button parchment slot'), 'ui', 'ui', 'png', 'ui_');
add(SKILLS.map((s) => `skill_${s.id}`), 'ui/icons', 'icon', 'png', 'icon_');
add(list('sword axe mace staff wand bow shield helm armor gloves boots belt ring amulet potion_health potion_mana gold letter_page rose_bouquet amulet_quest').map((k) => `item_${k}`), 'ui/icons', 'icon', 'png', 'icon_');
add(list('title charselect ending'), 'bg', 'bg', 'jpg', 'bg_');
export const VFX_KEYS = list('spark flare smoke fire magic_circle star heart light trace slash scorch twirl');
for (const k of VFX_KEYS) imgs.push({ key: `vfx_${k}`, path: `assets/vfx/${k}.png`, category: 'vfx' });

export const IMAGE_MANIFEST: ImageEntry[] = imgs;

const A = 'assets/audio';
const both = (dir: string, k: string) => [`${A}/${dir}/${k}.ogg`, `${A}/${dir}/${k}.mp3`];
export const MUSIC_KEYS = list('title town world1 dungeon1 world2 dungeon2 boss ending');
export const SFX_KEYS = list(
  'ui_click ui_hover ui_open ui_close footstep_grass footstep_stone sword_swing sword_hit arrow_shoot arrow_hit fireball_cast fire_explosion ice_cast ice_shatter lightning heal buff levelup quest_complete item_pickup gold_pickup potion_drink chest_open enemy_hit enemy_death player_hurt player_death portal boss_roar equip heart_sparkle drop_item',
);
export const AUDIO_MANIFEST: AudioEntry[] = [
  ...MUSIC_KEYS.map((k): AudioEntry => ({ key: `music_${k}`, urls: both('music', k), kind: 'music' })),
  ...SFX_KEYS.map((k): AudioEntry => ({ key: `sfx_${k}`, urls: both('sfx', k), kind: 'sfx' })),
];

/** Optional character animation sheets: <ANIM_DIR>/<charKey>.json + .png (see src/anim/CharacterAnimator.ts). */
export const ANIM_DIR = `${G}/anim`;
