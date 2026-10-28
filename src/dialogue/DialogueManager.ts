import { EventBus } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { CLASSES } from '../data/classes';
import type { Line } from '../data/quests';
import { handleNpcInteract } from './npcDialogue';
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
}
interface Job { lines: Line[]; opts: PlayOpts; }

const NEXT = '__next';
const END = '__end';

/**
 * Linear conversation engine on top of the UI contract:
 * emits 'dialogue:show' / 'dialogue:hide', listens to 'dialogue:choice'.
 */
class DialogueManagerImpl {
  private inited = false;
  private cur: (Job & { i: number }) | null = null;
  private pending: Job[] = [];
  private lastCombat = 0;
  private poll: number | undefined;

  get active(): boolean { return this.cur !== null; }

  init(): void {
    if (this.inited) return;
    this.inited = true;
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
    if (this.cur || !lines.length) return false;
    this.cur = { lines, opts, i: 0 };
    this.show();
    return true;
  }

  /** Play as soon as the screen is calm: no dialogue open and no combat for a few seconds. */
  queue(lines: Line[], opts: PlayOpts = {}): void {
    if (!lines.length) { opts.onDone?.(); return; }
    this.pending.push({ lines, opts });
    this.startPoll();
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
      this.cur = { ...job, i: 0 };
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
    const choices = last
      ? (c.opts.choices?.length ? c.opts.choices.map((ch, n) => ({ id: `c${n}`, text: ch.text })) : [{ id: END, text: 'Cerrar' }])
      : [{ id: NEXT, text: 'Continuar' }];
    EventBus.emit('dialogue:show', { speaker: sp.name, portrait: sp.portrait, text: fmt(line.text), choices });
  }

  private onChoice(id: string): void {
    const c = this.cur;
    if (!c) return;
    if (id === NEXT || (id === 'continue' && c.i < c.lines.length - 1)) { c.i++; this.show(); return; }
    let pick: EndChoice | undefined;
    if (id.startsWith('c')) pick = c.opts.choices?.[Number(id.slice(1))];
    this.cur = null;
    EventBus.emit('dialogue:hide');
    pick?.onPick?.();
    c.opts.onDone?.();
  }

  private abort(): void {
    if (this.cur) { this.cur = null; EventBus.emit('dialogue:hide'); }
  }
}

export const DialogueManager = new DialogueManagerImpl();