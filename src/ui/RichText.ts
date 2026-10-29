import Phaser from 'phaser';
import { FONT } from './widgets';

/** Inline markup: {shake}{wave}{red}{gold}{pink}{big} ... {/tag}. */
export interface RichOpts {
  size?: number; color?: string; width: number; align?: 'left' | 'center';
  stroke?: string; strokeW?: number; lineSpacing?: number; font?: string; bold?: boolean;
}

interface Ch {
  ch: string; t: Phaser.GameObjects.Text | null; bx: number; by: number; shake: boolean; wave: boolean; idx: number;
}

const COLORS: Record<string, string> = { red: '#d03020', gold: '#b87a00', pink: '#d0408a' };
const COLORS_DARK_BG: Record<string, string> = { red: '#ff6a50', gold: '#ffd24a', pink: '#ff8fc0' };

/** Strip the markup, returning the visible text. */
export function stripTags(s: string): string { return s.replace(/\{\/?(shake|wave|red|gold|pink|big)\}/g, ''); }

/**
 * Per-character text with wrapping, colours, shake / wave motion and a reveal counter (typewriter).
 * Built from Phaser.Text objects, one per glyph (lines are short, so this stays cheap).
 */
export class RichText {
  readonly c: Phaser.GameObjects.Container;
  chars: Ch[] = [];
  /** Plain visible characters in order (for per-char timing). */
  plain = '';
  height = 0;
  private shown = 0;
  private static meas?: Phaser.GameObjects.Text;
  private static cache = new Map<string, number>();

  constructor(private scene: Phaser.Scene, x: number, y: number, private o: RichOpts, private darkBg = false) {
    this.c = scene.add.container(x, y);
  }

  private width(ch: string, size: number): number {
    const key = `${ch}|${size}|${this.o.bold}`;
    let w = RichText.cache.get(key);
    if (w === undefined) {
      if (!RichText.meas || !RichText.meas.scene) RichText.meas = this.scene.add.text(-9999, -9999, '', {}).setVisible(false);
      const m = RichText.meas;
      m.setFont(`${this.o.bold ? 'bold ' : ''}${size}px ${this.o.font ?? FONT}`);
      m.setText(ch === ' ' ? 'i i' : ch);
      w = ch === ' ' ? m.width - (m.setText('ii'), m.width) : m.width;
      if (ch === ' ') w = Math.max(size * 0.28, w);
      RichText.cache.set(key, w);
    }
    return w;
  }

  /** Replace the content. All characters start hidden; use reveal(n). */
  set(markup: string): void {
    this.c.removeAll(true);
    this.chars = [];
    this.shown = 0;
    const base = this.o.size ?? 20;
    const pal = this.darkBg ? COLORS_DARK_BG : COLORS;
    // parse
    type Raw = { ch: string; color: string; size: number; shake: boolean; wave: boolean };
    const raw: Raw[] = [];
    const st = new Set<string>();
    const re = /\{(\/?)(shake|wave|red|gold|pink|big)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    const push = (txt: string) => {
      let color = this.o.color ?? '#2a1608';
      for (const k of st) if (pal[k]) color = pal[k];
      for (const ch of txt) raw.push({ ch, color, size: st.has('big') ? Math.round(base * 1.45) : base, shake: st.has('shake'), wave: st.has('wave') });
    };
    while ((m = re.exec(markup))) {
      push(markup.slice(last, m.index));
      if (m[1]) st.delete(m[2]); else st.add(m[2]);
      last = m.index + m[0].length;
    }
    push(markup.slice(last));
    this.plain = raw.map((r) => r.ch).join('');
    // words
    const words: Raw[][] = [];
    let cur: Raw[] = [];
    for (const r of raw) {
      if (r.ch === '\n') { if (cur.length) words.push(cur); words.push([r]); cur = []; continue; }
      cur.push(r);
      if (r.ch === ' ') { words.push(cur); cur = []; }
    }
    if (cur.length) words.push(cur);
    // layout
    const lines: { items: { r: Raw; x: number; i: number }[]; w: number; h: number }[] = [];
    let line = { items: [] as { r: Raw; x: number; i: number }[], w: 0, h: base };
    let idx = 0;
    for (const wd of words) {
      if (wd.length === 1 && wd[0].ch === '\n') { lines.push(line); line = { items: [], w: 0, h: base }; idx++; continue; }
      const ww = wd.reduce((a, r) => a + this.width(r.ch, r.size), 0);
      const trimmed = ww - (wd[wd.length - 1].ch === ' ' ? this.width(' ', wd[wd.length - 1].size) : 0);
      if (line.w + trimmed > this.o.width && line.items.length) { lines.push(line); line = { items: [], w: 0, h: base }; }
      for (const r of wd) {
        line.items.push({ r, x: line.w, i: idx++ });
        line.w += this.width(r.ch, r.size);
        line.h = Math.max(line.h, r.size);
      }
    }
    lines.push(line);
    let y = 0;
    const ls = this.o.lineSpacing ?? 6;
    for (const ln of lines) {
      const ox = this.o.align === 'center' ? (this.o.width - ln.w) / 2 : 0;
      const cy = y + ln.h * 0.62;
      for (const it of ln.items) {
        let t: Phaser.GameObjects.Text | null = null;
        if (it.r.ch !== ' ' && it.r.ch !== '\n') {
          t = this.scene.add.text(ox + it.x, cy, it.r.ch, {
            fontFamily: this.o.font ?? FONT, fontSize: `${it.r.size}px`, color: it.r.color, fontStyle: this.o.bold || it.r.size > base ? 'bold' : 'normal',
            stroke: this.o.stroke ?? '', strokeThickness: this.o.stroke ? (this.o.strokeW ?? 3) : 0,
          }).setOrigin(0, 0.5).setVisible(false);
          this.c.add(t);
        }
        this.chars.push({ ch: it.r.ch, t, bx: ox + it.x, by: cy, shake: it.r.shake, wave: it.r.wave, idx: it.i });
      }
      y += ln.h + ls;
    }
    this.height = y;
  }

  get length(): number { return this.chars.length; }

  reveal(n: number): void {
    n = Math.min(n, this.chars.length);
    for (let i = this.shown; i < n; i++) this.chars[i].t?.setVisible(true);
    for (let i = n; i < this.shown; i++) this.chars[i].t?.setVisible(false);
    this.shown = n;
  }

  /** Animate shake / wave characters. */
  update(timeMs: number): void {
    for (let i = 0; i < this.shown; i++) {
      const c = this.chars[i];
      if (!c.t || (!c.shake && !c.wave)) continue;
      let dx = 0, dy = 0;
      if (c.shake) { dx = (Math.random() - 0.5) * 3; dy = (Math.random() - 0.5) * 3; }
      if (c.wave) dy += Math.sin(timeMs / 140 + c.idx * 0.6) * 3.5;
      c.t.setPosition(c.bx + dx, c.by + dy);
    }
  }

  destroy(): void { this.c.destroy(); }
}