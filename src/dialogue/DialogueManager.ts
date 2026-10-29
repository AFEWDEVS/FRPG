import type Phaser from 'phaser';
import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { CLASSES } from '../data/classes';
import type { ChoiceDef, Line } from '../data/quests';
import { makePotion, potionTier } from '../items/generate';
import { giveItem } from '../items/inventory';
import { handleNpcInteract } from './npcDialogue';
import { initBanter } from './bossBanter';
import { PIPO_LEVELUP } from './pipo';

export interface Speaker { name: string; portrait: string; }

export function speakerOf(who: string): Speaker {
  switch (who) {
    case 'hero': {
      const p = GameState.profile;
      return { name: p?.name ?? 'Héroe', portrait: p ? CLASSES[p.classId].portraitKey : 'portrait_hero_knight' };
    }
    case 'elder': return { name: 'Abuelo Tobías', portrait: 'portrait_elder' };
    case 'bard': return { name: 'Pipo', portrait: 'portrait_bard' };
    case 'merchant': return { name: 'Gertrudis', portrait: 'portrait_merchant' };
    case 'healer': return { name: 'Hermana Melisa', portrait: 'portrait_healer' };
    case 'amaranta': return { name: 'Lady Amaranta', portrait: 'portrait_amaranta' };
    case 'malvarron': return { name: 'Lord Malvarrón', portrait: 'portrait_malvarron' };
    case 'thorn': return { name: 'Reina Espinas', portrait: 'portrait_thorn_queen' };
    case 'ogre': return { name: 'Ogro Poeta', portrait: 'portrait_ogre_poet' };
    case 'gargoyle': return { name: 'Gárgola Celosa', portrait: 'portrait_jealous_gargoyle' };
    default: return { name: who, portrait: 'portrait_elder' };
  }
}

/** Replace {hero} with the player's name. */
export function fmt(text: string): string {
  return text.replace(/\{hero\}/g, GameState.profile?.name ?? 'Héroe');
}

export interface EndChoice { text: string; onPick?: () => void; }
export interface PlayOpts {
  /** Choices shown on the last line (default: a single "Cerrar" button). */
  choices?: EndChoice[];
  onDone?: () => void;
  /** Pause the Game scene while the conversation is on screen (boss banter). */
  freeze?: boolean;
}
interface Job { lines: Line[]; opts: PlayOpts; }

const NEXT = '__next';
const END = '__end';

/** Keep only lines that apply to this class / flag state. */
export function filterLines(lines: Line[]): Line[] {
  const cls = GameState.profile?.classId;
  const f = GameState.flags;
  return lines.filter((l) => (!l.cls || l.cls === cls) && (!l.ifFlag || !!f[l.ifFlag]) && (!l.notFlag || !f[l.notFlag]));
}

/** Apply the side effects of a chosen option (flags, gold, potion, buffs, toast). */
export function applyChoice(ch: ChoiceDef): void {
  const f = GameState.flags;
  if (ch.set) Object.assign(f, ch.set);
  if (ch.add) for (const [k, v] of Object.entries(ch.add)) f[k] = (Number(f[k]) || 0) + v;
  if (ch.gold) { GameState.addGold(ch.gold); EventBus.emit('ui:toast', { text: `+${ch.gold} oro`, color: '#ffd24a' }); }
  if (ch.item) {
    try { giveItem(makePotion(ch.item, potionTier(GameState.profile?.level ?? 1))); EventBus.emit('ui:toast', { text: `Recibes una poción de ${ch.item === 'health' ? 'vida' : 'maná'}`, color: '#9fe08a' }); } catch { /* ignore */ }
  }
  if (ch.buff) {
    const sc = DialogueManager.gameScene() as unknown as { combat?: Record<string, (...a: unknown[]) => void>; enemies?: { def: { boss?: boolean }; dead: boolean; maxHp: number }[] } | undefined;
    const cb = sc?.combat;
    try {
      if (ch.buff === 'haste') cb?.hastePlayer(1.3, 45000);
      else if (ch.buff === 'heal') cb?.healPlayer(Math.round(GameState.maxLife * 0.4));
      else if (ch.buff === 'slow') cb?.slowPlayer(0.75, 10000);
      else if (ch.buff === 'smite') {
        const boss = sc?.enemies?.find((e) => e.def.boss && !e.dead);
        if (boss) cb?.damageEnemy(boss, { amount: Math.round(boss.maxHp * 0.08), type: 'physical', silent: true });
      }
    } catch { /* ignore */ }
  }
  if (ch.toast) EventBus.emit('ui:toast', { text: ch.toast, color: '#ff9ec0' });
  GameState.save();
}

/**
 * Conversation engine on top of the UI contract: emits 'dialogue:show' / 'dialogue:hide',
 * listens to 'dialogue:choice'. Supports per-class lines, flag conditions, emotes and
 * mid-conversation choices (ChoiceDef) with replies and effects.
 */
class DialogueManagerImpl {
  private inited = false;
  private cur: (Job & { i: number; frozen?: boolean }) | null = null;
  private pending: Job[] = [];
  private lastCombat = 0;
  private poll: number | undefined;
  private game?: Phaser.Game;

  get active(): boolean { return this.cur !== null; }
  attach(game: Phaser.Game): void { this.game = game; }
  gameScene(): Phaser.Scene | undefined { return this.game?.scene.getScene('Game'); }

  init(): void {
    if (this.inited) return;
    this.inited = true;
    initBanter();
    EventBus.on('dialogue:choice', ({ id }) => this.onChoice(id));
    EventBus.on('npc:interact', ({ npcId }) => { if (!this.cur) handleNpcInteract(npcId); });
    EventBus.on('enemy:damaged', () => { this.lastCombat = performance.now(); });
    EventBus.on('area:leaving', () => this.abort());
    EventBus.on('player:levelup', ({ level }) => {
      if (level < 2) return;
      EventBus.emit('ui:toast', { text: `Pipo: "${PIPO_LEVELUP[level % PIPO_LEVELUP.length].replace('{lvl}', String(level))}"`, color: '#9ad0ff' });
    });
  }

  /** Play now (ignored if something is already on screen). */
  play(lines: Line[], opts: PlayOpts = {}): boolean {
    const ls = filterLines(lines);
    if (this.cur || !ls.length) return false;
    this.cur = { lines: ls, opts, i: 0 };
    this.freeze(true);
    this.show();
    return true;
  }

  /** Play as soon as the screen is calm: no dialogue open and no combat for a few seconds. */
  queue(lines: Line[], opts: PlayOpts = {}): void {
    if (!lines.length) { opts.onDone?.(); return; }
    this.pending.push({ lines, opts });
    this.startPoll();
  }

  private freeze(on: boolean): void {
    const c = this.cur;
    if (!c || !this.game) return;
    try {
      if (on && c.opts.freeze && !c.frozen && this.game.scene.isActive('Game')) { this.game.scene.pause('Game'); c.frozen = true; }
      else if (!on && c.frozen) { this.game.scene.resume('Game'); c.frozen = false; }
    } catch { /* ignore */ }
  }

  private startPoll(): void {
    if (this.poll !== undefined) return;
    let waited = 0;
    this.poll = window.setInterval(() => {
      waited += 500;
      if (!this.pending.length) { this.stopPoll(); return; }
      if (this.cur) return;
      const calm = performance.now() - this.lastCombat > 3000;
      if (!calm && waited < 25000) return;
      const job = this.pending.shift()!;
      waited = 0;
      const ls = filterLines(job.lines);
      if (!ls.length) { job.opts.onDone?.(); return; }
      this.cur = { ...job, lines: ls, i: 0 };
      this.freeze(true);
      this.show();
    }, 500);
  }
  private stopPoll(): void { if (this.poll !== undefined) { window.clearInterval(this.poll); this.poll = undefined; } }

  private show(): void {
    const c = this.cur;
    if (!c) return;
    const line = c.lines[c.i];
    const sp = speakerOf(line.who);
    const last = c.i >= c.lines.length - 1;
    const mid = line.choices?.filter((ch) => !ch.cls || ch.cls === GameState.profile?.classId);
    let choices: { id: string; text: string }[];
    if (mid?.length) choices = mid.map((ch, n) => ({ id: `m${c.lines[c.i].choices!.indexOf(ch)}`, text: fmt(ch.text) }));
    else if (last) choices = c.opts.choices?.length ? c.opts.choices.map((ch, n) => ({ id: `c${n}`, text: ch.text })) : [{ id: END, text: 'Cerrar' }];
    else choices = [{ id: NEXT, text: 'Continuar' }];
    if (line.emote) {
      if (line.who === 'hero') EventBus.emit('emote:show', { target: 'player', name: line.emote });
      else EventBus.emit('emote:show', { target: line.who, name: line.emote });
    }
    const t = fmt(line.text);
    EventBus.emit('dialogue:show', { speaker: sp.name, portrait: sp.portrait, text: t, choices, who: line.who, emphasis: /\{(shake|big)\}|!\s*(\{\/\w+\})*$/.test(t) });
  }

  private onChoice(id: string): void {
    const c = this.cur;
    if (!c) return;
    if (id === NEXT || (id === 'continue' && c.i < c.lines.length - 1)) { c.i++; this.show(); return; }
    if (id.startsWith('m')) {
      const ch = c.lines[c.i].choices?.[Number(id.slice(1))];
      if (ch) {
        applyChoice(ch);
        const reply = filterLines(ch.reply ?? []);
        c.lines.splice(c.i + 1, 0, ...reply);
      }
      if (c.i < c.lines.length - 1) { c.i++; this.show(); return; }
      this.finish(undefined);
      return;
    }
    let pick: EndChoice | undefined;
    if (id.startsWith('c')) pick = c.opts.choices?.[Number(id.slice(1))];
    this.finish(pick);
  }

  private finish(pick: EndChoice | undefined): void {
    const c = this.cur;
    if (!c) return;
    this.freeze(false);
    this.cur = null;
    EventBus.emit('dialogue:hide');
    pick?.onPick?.();
    c.opts.onDone?.();
  }

  /** Drop any running / queued conversation (scene changes). */
  reset(): void { this.pending = []; this.abort(); }

  private abort(): void {
    if (this.cur) { this.freeze(false); this.cur = null; EventBus.emit('dialogue:hide'); }
  }
}

export const DialogueManager = new DialogueManagerImpl();