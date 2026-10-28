import Phaser from 'phaser';
import { IMAGE_MANIFEST, type ImageEntry } from './manifest';

type Ctx = CanvasRenderingContext2D;

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

const TILE_COLORS: Record<string, number> = {
  town_cobble: 0x7a7468, w1_grass: 0x3f7a3a, w1_grass_flowers: 0x4a8a44, w1_dirt: 0x7a5a38, w1_forest_floor: 0x2c5530,
  w1_water: 0x2a5a8a, d1_floor: 0x4a4650, w2_ash: 0x58504c, w2_lava: 0xd04a10, w2_obsidian: 0x241c34, d2_floor: 0x3a2e4c,
  d1_wall: 0x6a6270, d2_wall: 0x4c3a68, town_wall: 0x8a7a64,
};
const CHAR_COLORS: Record<string, number> = {
  hero_knight: 0xc0c8d8, hero_mage: 0x5a6adc, hero_ranger: 0x4aa05a, amaranta: 0xe070a8, npc_elder: 0xb0a090, npc_merchant: 0xc89a3a,
  npc_healer: 0xf0f0f0, npc_bard: 0xd05aa0, goblin: 0x5a9a3a, heart_slime: 0xe04a7a, wolf: 0x7a7a88, mushroom_man: 0xb0603a,
  thorn_queen: 0x3a8a4a, ogre_poet: 0x8a7a3a, imp: 0xc03a2a, skeleton: 0xd8d4c0, fire_elemental: 0xf06a1a, ash_golem: 0x6a6460,
  jealous_gargoyle: 0x5a6a7a, malvarron: 0x7a2aa0,
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function colorFor(key: string, table: Record<string, number>): number {
  return table[key] ?? ((hash(key) & 0xffffff) | 0x404040);
}

function diamond(ctx: Ctx, w: number, h: number, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2); ctx.lineTo(cx + w / 2, cy); ctx.lineTo(cx, cy + h / 2); ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

function drawTile(ctx: Ctx, key: string): void {
  const col = colorFor(key, TILE_COLORS);
  diamond(ctx, 256, 128, 128, 64);
  ctx.fillStyle = hex(col);
  ctx.fill();
  ctx.save();
  ctx.clip();
  const r = hash(key);
  for (let i = 0; i < 60; i++) {
    const x = (r * (i + 3) * 37) % 256, y = (r * (i + 5) * 17) % 128;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 10, 5);
  }
  ctx.restore();
  diamond(ctx, 254, 126, 128, 64);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawWall(ctx: Ctx, key: string): void {
  const col = colorFor(key, TILE_COLORS);
  const W = 256, H = 320, top = 192;
  const by = H - 64; // center y of the bottom diamond
  const face = (x: number, shade: string) => {
    ctx.fillStyle = hex(col);
    ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(128, H); ctx.lineTo(128, H - top); ctx.lineTo(x, by - top); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade; ctx.fill();
  };
  face(0, 'rgba(0,0,0,0.3)');
  face(W, 'rgba(255,255,255,0.1)');
  diamond(ctx, 256, 128, 128, by - top);
  ctx.fillStyle = hex(col); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
}

function drawCharacter(ctx: Ctx, key: string): void {
  const col = colorFor(key, CHAR_COLORS);
  const r = 55, top = 20, bottom = 250;
  ctx.beginPath();
  ctx.arc(128, top + r, r, Math.PI, 0);
  ctx.lineTo(128 + r, bottom - r);
  ctx.arc(128, bottom - r, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = hex(col); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(128 - r + 12, top + 30, 18, 120);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(150, top + 60, 9, 0, 7); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(153, top + 62, 4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 64px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
  const letter = key.replace(/^(hero_|npc_)/, '').charAt(0).toUpperCase();
  ctx.strokeText(letter, 128, 150);
  ctx.fillText(letter, 128, 150);
}

const PROP_SIZES: Record<string, [number, number]> = {
  house_1: [300, 300], house_2: [300, 300], market_stall: [200, 190], tree_oak_1: [200, 280], tree_oak_2: [200, 280], tree_pine: [160, 300],
  well: [120, 130], waypoint: [120, 190], dungeon_entrance: [220, 230], stairs_down: [130, 100], fence: [130, 90], campfire: [90, 80],
  torch: [50, 150], brazier: [70, 110], ruins_pillar: [90, 240], obsidian_spire: [90, 240], crystal: [90, 150], dead_tree: [150, 240],
};
const PROP_COLORS: Record<string, number> = {
  tree_oak_1: 0x2f7a30, tree_oak_2: 0x3a8a34, tree_pine: 0x1f5a3a, bush: 0x3f8a3a, flowers: 0xd860a0, mushrooms: 0xc84a3a,
  house_1: 0xa87a4a, house_2: 0x9a6a50, waypoint: 0x4ac0e0, dungeon_entrance: 0x504860, stairs_down: 0x6a6070, campfire: 0xf08a20,
  lava_rock: 0x7a2a10, crystal: 0xb06aff, obsidian_spire: 0x30284a, brazier: 0xf0a030, torch: 0xf0a030, chest_closed: 0x9a6a2a, chest_open: 0xaa7a3a,
};

function drawProp(ctx: Ctx, key: string, w: number, h: number): void {
  const col = colorFor(key, PROP_COLORS);
  ctx.fillStyle = hex(col);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  if (key.startsWith('tree') || key === 'bush') {
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(w / 2 - 10, h * 0.55, 20, h * 0.45);
    ctx.fillStyle = hex(col); ctx.beginPath(); ctx.ellipse(w / 2, h * 0.38, w * 0.46, h * 0.36, 0, 0, 7); ctx.fill(); ctx.stroke();
  } else if (key.startsWith('house') || key === 'market_stall' || key === 'dungeon_entrance') {
    ctx.fillRect(10, h * 0.35, w - 20, h * 0.65); ctx.strokeRect(10, h * 0.35, w - 20, h * 0.65);
    ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.moveTo(0, h * 0.4); ctx.lineTo(w / 2, 0); ctx.lineTo(w, h * 0.4); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (key === 'waypoint' || key === 'crystal' || key === 'obsidian_spire' || key === 'ruins_pillar') {
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w - 10, h * 0.85); ctx.lineTo(w / 2, h); ctx.lineTo(10, h * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(w / 2, h * 0.6, w * 0.45, h * 0.38, 0, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Georgia, serif'; ctx.textAlign = 'center';
  ctx.fillText(key.slice(0, 12), w / 2, h * 0.62);
}

function drawUi(ctx: Ctx, key: string, w: number, h: number): void {
  if (key === 'ui_orb_health' || key === 'ui_orb_mana') {
    const c = key === 'ui_orb_health' ? '#b01818' : '#1840b0';
    const g = ctx.createRadialGradient(w * 0.4, h * 0.35, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffffaa'); g.addColorStop(0.2, c); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, 7); ctx.fill();
  } else if (key === 'ui_orb_frame') {
    ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 6, 0, 7); ctx.stroke();
  } else {
    ctx.fillStyle = key === 'ui_parchment' ? '#d8c49a' : '#2a2622';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }
}

function drawIcon(ctx: Ctx, key: string, w: number): void {
  ctx.fillStyle = '#1c1816'; ctx.fillRect(0, 0, w, w);
  ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, w - 2);
  ctx.fillStyle = hex((hash(key) & 0xffffff) | 0x505050);
  ctx.beginPath(); ctx.arc(w / 2, w / 2, w * 0.3, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(w * 0.3) + 'px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(key.replace(/^icon_(item_|skill_)?/, '').charAt(0).toUpperCase(), w / 2, w / 2 + 2);
}

function drawBg(ctx: Ctx, key: string, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const base = key === 'bg_ending' ? ['#3a1a40', '#c85a70'] : key === 'bg_charselect' ? ['#10182a', '#2a1a20'] : ['#0a0610', '#3a1018'];
  g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const moons: [number, number, string][] = [[w * 0.7, h * 0.16, '#e8e0c8'], [w * 0.78, h * 0.1, '#a8c8e8']];
  ctx.globalAlpha = 0.85;
  for (const [x, r, c] of moons) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, h * 0.25, r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawVfx(ctx: Ctx, key: string, s: number): void {
  const c = s / 2;
  if (key === 'vfx_heart') {
    ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.moveTo(c, s * 0.85); ctx.bezierCurveTo(s * 0.05, s * 0.55, s * 0.1, s * 0.12, c, s * 0.33);
    ctx.bezierCurveTo(s * 0.9, s * 0.12, s * 0.95, s * 0.55, c, s * 0.85); ctx.fill();
  } else if (key === 'vfx_star') {
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.18 : s * 0.46;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  } else if (key === 'vfx_magic_circle') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(c, c, s * 0.45, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(c, c, s * 0.3, 0, 7); ctx.stroke();
  } else if (key === 'vfx_slash' || key === 'vfx_trace') {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, '#ffffff00'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g; ctx.fillRect(0, c - 6, s, 12);
  } else {
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ffffffaa'); g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  draw(tex.getContext());
  tex.refresh();
}

function placeholderFor(scene: Phaser.Scene, e: ImageEntry): void {
  const k = e.key;
  switch (e.category) {
    case 'tile': make(scene, k, 256, 128, (c) => drawTile(c, k)); break;
    case 'wall': make(scene, k, 256, 320, (c) => drawWall(c, k)); break;
    case 'char': make(scene, k, 256, 256, (c) => drawCharacter(c, k)); break;
    case 'portrait':
      make(scene, k, 256, 256, (c) => {
        drawBg(c, 'bg_x', 256, 256);
        c.fillStyle = hex(colorFor(k.replace('portrait_', ''), CHAR_COLORS));
        c.beginPath(); c.arc(128, 150, 80, 0, 7); c.fill();
      });
      break;
    case 'prop': {
      const [w, h] = PROP_SIZES[k] ?? [100, 100];
      make(scene, k, w, h, (c) => drawProp(c, k, w, h));
      break;
    }
    case 'ui': {
      const w = k.includes('orb') ? 192 : k === 'ui_slot' ? 64 : 256;
      const h = k === 'ui_button' ? 64 : w;
      make(scene, k, w, h, (c) => drawUi(c, k, w, h));
      break;
    }
    case 'icon': make(scene, k, 64, 64, (c) => drawIcon(c, k, 64)); break;
    case 'bg': make(scene, k, 960, 540, (c) => drawBg(c, k, 960, 540)); break;
    case 'vfx': make(scene, k, 64, 64, (c) => drawVfx(c, k, 64)); break;
  }
}

/** Create placeholder textures for every manifest image that is not loaded. Safe to call repeatedly. */
export function ensurePlaceholders(scene: Phaser.Scene): number {
  let n = 0;
  for (const e of IMAGE_MANIFEST) {
    if (scene.textures.exists(e.key)) continue;
    placeholderFor(scene, e);
    n++;
  }
  return n;
}

/** Soft radial gradient used to punch the light hole in the darkness overlay. */
export function ensureLightMask(scene: Phaser.Scene): void {
  if (scene.textures.exists('light_mask')) return;
  make(scene, 'light_mask', 512, 512, (ctx) => {
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
  });
}