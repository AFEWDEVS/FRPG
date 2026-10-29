import Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { NPC_COLORS, chatterFor } from '../data/npcs';
import { QuestManager } from '../quests/QuestManager';
import { FONT } from './widgets';

/**
 * RO-style emote bubbles + NPC chat bubbles, rendered in world space of the Game scene.
 *
 * Public API (also usable through the event bus):
 *   Emotes.emote(target, name)        -- target: 'player' | npc id | enemy id | enemy def id | 'thorn' | 'ogre' | 'gargoyle' | 'malvarron'
 *   EventBus.emit('emote:show', { target, name })
 *   EventBus.emit('npc:emote', { npcId, emote })
 * Names: heart sweat ! ? angry music sparkle zzz blush broken dots laugh
 * Uses public/assets/gen/fx/emotes.png + emotes.json ({ name: frameIndex }, 64x64 cells) when present; otherwise drawn glyphs.
 */
export type EmoteName = 'heart' | 'sweat' | '!' | '?' | 'angry' | 'music' | 'sparkle' | 'zzz' | 'blush' | 'broken' | 'dots' | 'laugh';

const FALLBACK: Record<string, { s: string; c: string; size: number }> = {
  heart: { s: '❤', c: '#ff4f78', size: 30 }, sweat: { s: '💧', c: '#5fb8ff', size: 28 }, '!': { s: '!', c: '#ff3030', size: 36 },
  '?': { s: '?', c: '#3070e0', size: 36 }, angry: { s: '💢', c: '#ff3030', size: 28 }, music: { s: '♪', c: '#30a060', size: 34 },
  sparkle: { s: '✦', c: '#ffc820', size: 32 }, zzz: { s: 'Zzz', c: '#6070b0', size: 20 }, blush: { s: '☺', c: '#ff7098', size: 34 },
  broken: { s: '💔', c: '#c02050', size: 28 }, dots: { s: '...', c: '#505050', size: 30 }, laugh: { s: '😂', c: '#e8a000', size: 28 },
};
const ALIAS: Record<string, string[]> = {
  '!': ['!', 'exclaim', 'exclamation', 'surprise'], '?': ['?', 'question'], sweat: ['sweat', 'drop'], angry: ['angry', 'anger'], heart: ['heart', 'love'],
  dots: ['dots', '...', 'ellipsis'], broken: ['broken', 'broken_heart', 'brokenheart'], music: ['music', 'note'], zzz: ['zzz', 'sleep'], laugh: ['laugh', 'lol'],
  blush: ['blush', 'shy'], sparkle: ['sparkle', 'star'],
};
const BOSS_ALIAS: Record<string, string> = { thorn: 'thorn_queen', ogre: 'ogre_poet', gargoyle: 'jealous_gargoyle' };

interface Ent { x: number; y: number; id?: string; sprite?: { displayHeight: number }; active?: boolean; dead?: boolean }
interface Live { target: Ent; c: Phaser.GameObjects.Container; off: number; key: string }

let tried = false;
let names: Record<string, number> | null = null;

export class Emotes {
  private live: Live[] = [];
  private chats: Live[] = [];
  private gs?: Phaser.Scene & Record<string, any>;
  private npcTimer = new Map<string, number>();
  private seen = new Map<string, { aggro: boolean; charm: boolean }>();
  private lowAt = 0;
  private unsub: (() => void)[] = [];
  static current?: Emotes;

  constructor(private host: Phaser.Scene) {
    Emotes.current = this;
    this.load();
    this.unsub.push(
      EventBus.on('emote:show', ({ target, name }) => this.emote(target, name)),
      EventBus.on('npc:emote', ({ npcId, emote }) => this.emote(npcId, emote)),
      EventBus.on('player:levelup', () => this.emote('player', 'sparkle')),
      EventBus.on('player:died', () => this.emote('player', 'broken')),
      EventBus.on('boss:engaged', ({ bossId }) => this.emote(bossId, 'angry')),
      EventBus.on('boss:defeated', ({ bossId }) => { this.emote(bossId, bossId === 'malvarron' ? 'broken' : 'dots'); this.emote('player', 'laugh'); }),
      EventBus.on('area:entered', () => this.clear()),
    );
    host.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.unsub.forEach((f) => f()); this.clear(); if (Emotes.current === this) Emotes.current = undefined; });
  }

  static emote(target: string, name: string): void { Emotes.current?.emote(target, name); }

  private load(): void {
    const tex = this.host.textures;
    if (tried || tex.exists('emotes')) return;
    tried = true;
    fetch('assets/gen/fx/emotes.json').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      names = (j.names ?? j.frames ?? j) as Record<string, number>;
      this.host.load.spritesheet('emotes', 'assets/gen/fx/emotes.png', { frameWidth: 64, frameHeight: 64 });
      this.host.load.once('complete', () => { if (!tex.exists('emotes')) names = null; });
      this.host.load.start();
    }).catch(() => { names = null; });
  }

  private frameFor(name: string): number | null {
    if (!names || !this.host.textures.exists('emotes')) return null;
    for (const a of ALIAS[name] ?? [name]) if (typeof names[a] === 'number') return names[a];
    return null;
  }

  private clear(): void {
    for (const l of [...this.live, ...this.chats]) { this.host.tweens.killTweensOf(l.c); l.c.destroy(); }
    this.live = []; this.chats = [];
    this.seen.clear(); this.npcTimer.clear();
  }

  private scene(): (Phaser.Scene & Record<string, any>) | undefined {
    const s = this.host.game.scene.getScene('Game') as (Phaser.Scene & Record<string, any>) | undefined;
    if (!s || !s.sys || !(s.sys.isActive() || s.sys.isPaused()) || !s['player']) return undefined;
    return s;
  }

  private resolve(id: string): Ent | undefined {
    const s = this.scene();
    if (!s) return undefined;
    if (id === 'player') return s['player'];
    const npc = (s['npcs'] as any[])?.find((n) => n.def?.id === id || n.id === id);
    if (npc) return npc;
    const def = BOSS_ALIAS[id] ?? id;
    return (s['enemies'] as any[])?.find((e) => !e.dead && (e.id === id || e.def?.id === def));
  }

  /** Show an emote bubble above a target. */
  emote(target: string, name: string): void {
    const s = this.scene();
    const ent = this.resolve(target);
    if (!s || !ent || (ent as Ent).active === false) return;
    const old = this.live.find((l) => l.target === ent);
    if (old) this.drop(old);
    const frame = this.frameFor(name);
    const c = s.add.container(ent.x, ent.y).setDepth(2_000_000);
    if (frame !== null) {
      c.add(s.add.image(0, -4, 'emotes', frame).setDisplaySize(52, 52));
    } else {
      const f = FALLBACK[name] ?? FALLBACK.dots;
      const t = s.add.text(0, -16, f.s, { fontFamily: FONT, fontSize: `${f.size}px`, fontStyle: 'bold', color: f.c }).setOrigin(0.5);
      const w = Math.max(48, t.width + 18), h = 46;
      const g = s.add.graphics();
      g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2 + 2, -h - 2 + 3, w, h, 14);
      g.fillStyle(0xffffff, 1).lineStyle(3, 0x303030, 1).fillRoundedRect(-w / 2, -h + 0, w, h, 14).strokeRoundedRect(-w / 2, -h + 0, w, h, 14);
      g.fillStyle(0xffffff, 1).fillTriangle(-7, -1, 7, -1, 0, 10).lineStyle(3, 0x303030, 1).beginPath().moveTo(-7, -1).lineTo(0, 10).lineTo(7, -1).strokePath();
      g.fillStyle(0xffffff, 1).fillRect(-6, -4, 12, 5);
      c.add([g, t]);
    }
    const hgt = ent.sprite?.displayHeight ?? 120;
    const l: Live = { target: ent, c, off: hgt + 36, key: name };
    this.live.push(l);
    c.setScale(0).setAlpha(1);
    const tw = this.host.tweens;
    tw.add({ targets: c, scale: { from: 0, to: 1.25 }, duration: 160, ease: 'Quad.easeOut', onComplete: () => tw.add({ targets: c, scale: 1, duration: 140, ease: 'Bounce.easeOut' }) });
    tw.add({ targets: l, off: l.off + 14, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', delay: 300 });
    tw.add({ targets: c, alpha: 0, delay: 1900, duration: 350, onComplete: () => this.drop(l) });
  }

  private drop(l: Live): void {
    this.host.tweens.killTweensOf(l.c);
    this.host.tweens.killTweensOf(l);
    l.c.destroy();
    this.live = this.live.filter((x) => x !== l);
  }

  /** RO-style chat bubble above an NPC (replaces the NPC's own bubble). */
  chat(n: Ent & { def: { id: string; name: string } }, _text?: string): void {
    const s = this.scene();
    if (!s) return;
    const lines = chatterFor(n.def.id, GameState.flags, QuestManager.completedCount());
    const text = lines[Math.floor(Math.random() * lines.length)];
    const old = this.chats.find((l) => l.target === n);
    if (old) this.dropChat(old);
    const nameC = NPC_COLORS[n.def.id] ?? '#d8b060';
    const t = s.add.text(0, 0, text, { fontFamily: FONT, fontSize: '15px', color: '#201408', align: 'center', wordWrap: { width: 240 } }).setOrigin(0.5, 1);
    const w = t.width + 24, h = t.height + 16;
    const g = s.add.graphics();
    g.fillStyle(0x000000, 0.22).fillRoundedRect(-w / 2 + 2, -h - 6 + 3, w, h, 12);
    g.fillStyle(0xffffff, 0.98).lineStyle(2.5, 0x2a2018, 1).fillRoundedRect(-w / 2, -h - 6, w, h, 12).strokeRoundedRect(-w / 2, -h - 6, w, h, 12);
    g.fillStyle(0xffffff, 1).fillTriangle(-8, -7, 8, -7, 0, 6).lineStyle(2.5, 0x2a2018, 1).beginPath().moveTo(-8, -7).lineTo(0, 6).lineTo(8, -7).strokePath();
    g.fillStyle(0xffffff, 1).fillRect(-7, -9, 14, 4);
    t.setY(-14);
    const nm = s.add.text(0, -h - 12, n.def.name, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: nameC, stroke: '#1a0c08', strokeThickness: 3 }).setOrigin(0.5, 1);
    const c = s.add.container(n.x, n.y, [g, t, nm]).setDepth(2_000_100).setScale(0.6).setAlpha(0);
    const l: Live = { target: n, c, off: (n.sprite?.displayHeight ?? 120) + 44, key: 'chat' };
    this.chats.push(l);
    const tw = this.host.tweens;
    tw.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    tw.add({ targets: c, alpha: 0, delay: 4200, duration: 450, onComplete: () => this.dropChat(l) });
  }

  private dropChat(l: Live): void {
    this.host.tweens.killTweensOf(l.c);
    l.c.destroy();
    this.chats = this.chats.filter((x) => x !== l);
  }

  update(dtMs: number): void {
    const s = this.scene();
    if (!s) { if (this.live.length || this.chats.length) this.clear(); return; }
    for (const l of this.live) l.c.setPosition(l.target.x, l.target.y - l.off);
    for (const l of this.chats) l.c.setPosition(l.target.x, l.target.y - l.off - (this.live.some((e) => e.target === l.target) ? 56 : 0));
    const pl = s['player'] as Ent & { gx: number; gy: number };
    // patch the NPCs' own chatter bubble
    const npcs = (s['npcs'] as any[]) ?? [];
    for (const n of npcs) {
      if (n.__rp) continue;
      n.__rp = true;
      n.say = (text: string) => this.chat(n, text);
    }
    // NPCs emote now and then when the player is close
    for (const n of npcs) {
      const id = n.def.id as string;
      const left = (this.npcTimer.get(id) ?? 3000 + Math.random() * 6000) - dtMs;
      if (left > 0) { this.npcTimer.set(id, left); continue; }
      this.npcTimer.set(id, 11000 + Math.random() * 9000);
      if (Math.hypot(pl.gx - n.gx, pl.gy - n.gy) > 8) continue;
      const pool = id === 'bard' ? ['music', 'music', 'sparkle'] : id === 'merchant' ? ['sparkle', 'dots', 'heart'] : id === 'healer' ? ['heart', 'sweat', 'dots'] : ['zzz', '?', 'dots'];
      this.emote(id, pool[Math.floor(Math.random() * pool.length)]);
    }
    // enemies: '!' on aggro, '?' when losing you, hearts when charmed
    let spawned = 0;
    for (const e of (s['enemies'] as any[]) ?? []) {
      if (e.dead || !e.id) { this.seen.delete(e.id); continue; }
      const prev = this.seen.get(e.id);
      const cur = { aggro: !!e.aggro, charm: !!e.charmed };
      this.seen.set(e.id, cur);
      if (!prev || Math.hypot(pl.gx - e.gx, pl.gy - e.gy) > 13 || spawned >= 2 || e.def?.boss) continue;
      if (cur.charm && !prev.charm) { this.emote(e.id, 'heart'); spawned++; }
      else if (cur.aggro && !prev.aggro && !cur.charm) { this.emote(e.id, '!'); spawned++; }
      else if (!cur.aggro && prev.aggro && !cur.charm) { this.emote(e.id, '?'); spawned++; }
    }
    // low health sweat
    this.lowAt -= dtMs;
    if (this.lowAt <= 0 && GameState.profile && GameState.maxLife > 0 && GameState.life / GameState.maxLife < 0.25 && GameState.life > 0) {
      this.lowAt = 5500;
      this.emote('player', 'sweat');
    }
  }
}