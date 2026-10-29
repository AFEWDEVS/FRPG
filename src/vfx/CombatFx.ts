import Phaser from 'phaser';
import { PALETTE, VFX_DEPTH, type Element, type VfxManager } from './VfxManager';

const FONT = 'Impact, "Arial Black", "Arial Narrow Bold", sans-serif';
const ADD = Phaser.BlendModes.ADD;
const GROUND = 0.7;

export type NumKind = 'dmg' | 'crit' | 'player' | 'miss' | 'heal' | 'dot';

interface NumPreset { size: number; color: string; stroke: string; th: number; h: number; dur: number; drift: number; pop: number }
const PRESETS: Record<NumKind, NumPreset> = {
  dmg: { size: 30, color: '#ffffff', stroke: '#1a1020', th: 7, h: 62, dur: 950, drift: 34, pop: 1.5 },
  crit: { size: 52, color: '#ffd23a', stroke: '#8a2a00', th: 10, h: 96, dur: 1250, drift: 26, pop: 1.8 },
  player: { size: 34, color: '#ff4a3a', stroke: '#2a0000', th: 8, h: 56, dur: 1000, drift: 30, pop: 1.5 },
  miss: { size: 24, color: '#8fd8ff', stroke: '#0a2a4a', th: 6, h: 48, dur: 850, drift: 20, pop: 1.3 },
  heal: { size: 32, color: '#6aff7a', stroke: '#063a10', th: 7, h: 60, dur: 1000, drift: 18, pop: 1.5 },
  dot: { size: 18, color: '#ffffff', stroke: '#1a1020', th: 5, h: 34, dur: 650, drift: 20, pop: 1.25 },
};

/** Ragnarok-flavored combat juice: damage numbers, shouts, cast circles, hit sparks, level up. Everything pooled or short-lived. */
export class CombatFx {
  private pool: Phaser.GameObjects.Text[] = [];
  private active = 0;
  private bursts: Phaser.GameObjects.Image[] = [];

  constructor(private v: VfxManager) { this.textures(); }
  private get scene(): Phaser.Scene { return this.v.scene; }

  private textures(): void {
    const sc = this.scene, tx = sc.textures;
    const mk = () => sc.make.graphics({ x: 0, y: 0 }, false);
    if (!tx.exists('fx_burst')) {
      const g = mk(), c = 128;
      for (let i = 0; i < 8; i++) { g.fillStyle(0xffffff, 0.1); g.fillCircle(c, c, 44 - i * 5); }
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4, len = i % 2 ? 84 : 124, w = 0.2;
        g.fillTriangle(c + Math.cos(a - w) * 16, c + Math.sin(a - w) * 16, c + Math.cos(a + w) * 16, c + Math.sin(a + w) * 16, c + Math.cos(a) * len, c + Math.sin(a) * len);
      }
      g.fillCircle(c, c, 12);
      g.generateTexture('fx_burst', 256, 256); g.destroy();
    }
    if (!tx.exists('fx_streak')) {
      const g = mk();
      for (let i = 0; i < 32; i++) { const t = i / 31, h = 2 + t * 10; g.fillStyle(0xffffff, t * t); g.fillRect(i * 4, 8 - h / 2, 4, h); }
      g.generateTexture('fx_streak', 128, 16); g.destroy();
    }
    if (!tx.exists('fx_shard')) {
      const g = mk();
      g.fillStyle(0xffffff, 1); g.fillTriangle(12, 0, 22, 28, 12, 56);
      g.fillStyle(0xbfe8ff, 0.85); g.fillTriangle(12, 0, 2, 28, 12, 56);
      g.generateTexture('fx_shard', 24, 56); g.destroy();
    }
    if (!tx.exists('fx_note')) {
      const g = mk();
      g.fillStyle(0xffffff, 1); g.fillEllipse(10, 38, 16, 12); g.fillRect(16, 6, 3, 33);
      g.fillTriangle(19, 6, 30, 20, 19, 24);
      g.generateTexture('fx_note', 32, 48); g.destroy();
    }
    if (!tx.exists('fx_hammer')) {
      const g = mk();
      g.fillStyle(0xd0d0d0, 1); g.fillRect(29, 20, 7, 42);
      g.fillStyle(0xffffff, 1); g.fillRect(8, 4, 48, 22);
      g.fillStyle(0xb8b8b8, 1); g.fillRect(8, 18, 48, 8);
      g.fillStyle(0xffffff, 1); g.fillRect(4, 8, 6, 14); g.fillRect(54, 8, 6, 14);
      g.generateTexture('fx_hammer', 64, 64); g.destroy();
    }
    if (!tx.exists('fx_wing')) {
      const g = mk(), bx = 8, by = 170;
      const lens = [110, 140, 165, 180, 185, 175, 160, 140, 115];
      for (const [wm, al] of [[1.0, 0.55], [0.6, 0.95]] as const) {
        for (let i = 0; i < lens.length; i++) {
          const a = ((-100 + i * 11.25) * Math.PI) / 180, L = lens[i] * (wm === 1 ? 1 : 0.92), w = 16 * wm + 4;
          const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
          g.fillStyle(0xffffff, al);
          g.fillPoints([{ x: bx, y: by }, { x: bx + dx * L * 0.45 + nx * w, y: by + dy * L * 0.45 + ny * w }, { x: bx + dx * L, y: by + dy * L }, { x: bx + dx * L * 0.5 - nx * w * 0.7, y: by + dy * L * 0.5 - ny * w * 0.7 }], true);
        }
      }
      g.generateTexture('fx_wing', 256, 200); g.destroy();
    }
    if (!tx.exists('fx_pillar')) {
      const ct = tx.createCanvas('fx_pillar', 64, 256);
      if (ct) {
        const ctx = ct.getContext();
        const hg = ctx.createLinearGradient(0, 0, 64, 0);
        hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.35, 'rgba(255,255,255,0.75)'); hg.addColorStop(0.5, 'rgba(255,255,255,1)'); hg.addColorStop(0.65, 'rgba(255,255,255,0.75)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, 64, 256);
        ctx.globalCompositeOperation = 'destination-in';
        const vg = ctx.createLinearGradient(0, 0, 0, 256);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(0.35, 'rgba(0,0,0,1)'); vg.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, 64, 256);
        ct.refresh();
      }
    }
  }

  // ------------------------------------------------------------ damage numbers

  private burst(x: number, y: number, tint: number, size: number): void {
    const img = this.bursts.pop() ?? this.scene.add.image(0, 0, 'fx_burst').setBlendMode(ADD).setDepth(VFX_DEPTH + 19);
    img.setPosition(x, y).setTint(tint).setVisible(true).setAlpha(1).setScale(size * 0.25).setRotation(Math.random());
    this.scene.tweens.add({ targets: img, scale: size, rotation: img.rotation + 0.9, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => { img.setVisible(false); this.bursts.push(img); } });
  }

  /** RO-style number: pops big, arcs up with a little drift, shrinks and fades. */
  number(text: string, x: number, y: number, o: { kind?: NumKind; color?: string; crit?: boolean; small?: boolean } = {}): void {
    if (this.active >= 70) return;
    const kind: NumKind = o.kind ?? (o.crit ? 'crit' : o.small ? 'dot' : 'dmg');
    const P = PRESETS[kind];
    let t = this.pool.pop();
    if (!t) t = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(VFX_DEPTH + 20).setShadow(0, 4, '#000000', 0, true, true);
    const color = kind === 'dmg' || kind === 'dot' ? o.color ?? P.color : P.color;
    t.setText(text).setFontSize(P.size).setColor(color).setStroke(P.stroke, P.th).setVisible(true).setAlpha(1).setPosition(x, y).setScale(0.3);
    if (kind === 'crit') { this.burst(x, y - 18, 0xffb030, 1.1); this.v.emit('stars', x, y - 18, 4, { tint: 0xffe680, scale: 0.2, speed: [80, 220], life: 500 }); }
    const drift = (Math.random() - 0.5) * 2 * P.drift;
    const st = { k: 0 };
    const tt = t;
    this.active++;
    this.scene.tweens.add({
      targets: st, k: 1, duration: P.dur, ease: 'Linear',
      onUpdate: () => {
        const k = st.k;
        const s = k < 0.1 ? 0.3 + (P.pop - 0.3) * (k / 0.1) : k < 0.22 ? P.pop - (P.pop - 1) * ((k - 0.1) / 0.12) : 1 - 0.4 * ((k - 0.22) / 0.78);
        tt.setScale(s).setPosition(x + drift * k, y - P.h * Math.sin(k * Math.PI * 0.62)).setAlpha(k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35);
      },
      onComplete: () => { tt.setVisible(false); this.active--; this.pool.push(tt); },
    });
  }

  /** Skill name shout above the caster, RO style. */
  shout(text: string, x: number, y: number, color = '#ffe9a0'): void {
    const t = this.scene.add.text(x, y, text, { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color, stroke: '#2a1030', strokeThickness: 7 })
      .setOrigin(0.5, 1).setDepth(VFX_DEPTH + 25).setShadow(0, 3, '#000000', 0, true, true).setScale(0.2);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 170, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, y: y - 26, alpha: 0, delay: 750, duration: 420, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  // ------------------------------------------------------------ casting

  /** Particles converging on a point (anticipation). */
  converge(x: number, y: number, el: Element, ms: number, r = 80): Phaser.Time.TimerEvent {
    const p = PALETTE[el], every = 40;
    return this.scene.time.addEvent({
      delay: every, repeat: Math.max(1, Math.floor(ms / every)),
      callback: () => {
        const a = Math.random() * Math.PI * 2, life = 320 + Math.random() * 120, sp = r / (life / 1000);
        const deg = ((a + Math.PI) * 180) / Math.PI;
        this.v.emit(Math.random() < 0.5 ? 'stars' : 'glow', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, 1, { tint: Math.random() < 0.5 ? p.core : p.mid, scale: 0.13 + Math.random() * 0.08, scaleEnd: 0.03, life, speed: [sp, sp], angle: [deg, deg], alpha: 0.95 });
      },
    });
  }

  /** Rotating ground magic circle + cast bar (+ optional ground target telegraph). Call .destroy() when the cast ends. */
  castFx(x: number, y: number, el: Element, ms: number, o: { ground?: { gx: number; gy: number; R: number; wx: number; wy: number } } = {}): { destroy: () => void } {
    const sc = this.scene, p = PALETTE[el];
    const parts: Phaser.GameObjects.GameObject[] = [];
    const tweens: Phaser.Tweens.Tween[] = [];
    const hasCc = sc.textures.exists('fx_cast_circle');
    const key = hasCc ? 'fx_cast_circle' : sc.textures.exists('vfx_magic_circle') ? 'vfx_magic_circle' : 'fx_ring';
    const km = hasCc ? 0.5 : 1; // cast_circle.png is 512px, the old circle 256px
    const circ = sc.add.image(x, y, key).setScale(0.1 * km, 0.05 * km).setTint(p.mid).setBlendMode(ADD).setAlpha(0.95).setDepth(GROUND);
    const inner = sc.add.image(x, y, key).setScale(0.05 * km, 0.025 * km).setTint(p.core).setBlendMode(ADD).setAlpha(0.7).setDepth(GROUND + 0.01);
    tweens.push(sc.tweens.add({ targets: circ, scaleX: 0.52 * km, scaleY: 0.26 * km, duration: 200, ease: 'Back.easeOut' }));
    tweens.push(sc.tweens.add({ targets: inner, scaleX: 0.3 * km, scaleY: 0.15 * km, duration: 240, ease: 'Back.easeOut' }));
    tweens.push(sc.tweens.add({ targets: circ, angle: 360, duration: 1500, repeat: -1 }));
    tweens.push(sc.tweens.add({ targets: inner, angle: -360, duration: 1100, repeat: -1 }));
    const bg = sc.add.rectangle(x, y - 128, 66, 10, 0x000000, 0.7).setStrokeStyle(2, 0xffffff, 0.7).setDepth(VFX_DEPTH + 30);
    const fill = sc.add.rectangle(x - 30, y - 128, 60, 5, p.mid).setOrigin(0, 0.5).setScale(0, 1).setDepth(VFX_DEPTH + 31);
    tweens.push(sc.tweens.add({ targets: fill, scaleX: 1, duration: ms, ease: 'Linear' }));
    parts.push(circ, inner, bg, fill);
    const conv = this.converge(x, y - 45, el, ms);
    let tele: { destroy: () => void } | null = null;
    if (o.ground) {
      tele = this.v.telegraphCircle(o.ground.gx, o.ground.gy, o.ground.R, ms + 60, p.mid);
      const gc = this.v.groundCircle(o.ground.wx, o.ground.wy, { scale: o.ground.R * 0.62, tint: p.mid, alpha: 0.85, spin: 1600 });
      if (gc) parts.push(gc);
    }
    let dead = false;
    return {
      destroy: () => {
        if (dead) return; dead = true;
        conv.remove(); tele?.destroy();
        for (const tw of tweens) tw.stop();
        sc.tweens.add({ targets: parts, alpha: 0, duration: 140, onComplete: () => parts.forEach((q) => q.destroy()) });
        this.v.flash(x, y - 40, { element: el, size: 110, ms: 140 });
      },
    };
  }

  // ------------------------------------------------------------ hits

  /** Comedic oriented hit sparks: directional sparks + pastel stars. `angle` = screen-space radians of travel. */
  hitSpark(x: number, y: number, angle: number, el: Element = 'physical', crit = false): void {
    const p = PALETTE[el], deg = (angle * 180) / Math.PI;
    this.v.emit('core', x, y, 1, { tint: p.core, scale: crit ? 0.9 : 0.45, scaleEnd: 0.1, life: 150 });
    this.v.emit('sparks', x, y, crit ? 12 : 6, { tint: p.core, scale: 0.17, speed: [170, crit ? 440 : 330], angle: [deg - 38, deg + 38], life: 420 });
    const pastel = [0xffe680, 0xff9ac8, 0xaee8ff, 0xc8ffb0];
    const n = crit ? 4 : 2;
    for (let i = 0; i < n; i++) this.v.emit('stars', x, y, 1, { tint: pastel[(Math.random() * pastel.length) | 0], scale: 0.16 + Math.random() * 0.1, speed: [50, 190], life: 520 });
    if (crit) this.v.emit('glow', x, y, 1, { tint: p.mid, scale: 1.5, scaleEnd: 0.4, life: 300, alpha: 0.8 });
  }

  /** Death pop: sparkles + a little soul that floats up. */
  deathPop(x: number, y: number, big = false): void {
    const cols = [0xffe680, 0xff9ac8, 0xaee8ff, 0xffffff];
    for (const c of cols) this.v.emit('stars', x, y, big ? 5 : 3, { tint: c, scale: 0.2, speed: [60, 240], life: 750 });
    this.v.emit('core', x, y, 1, { tint: 0xfff0c0, scale: 0.8, scaleEnd: 0.1, life: 200 });
    this.v.emit('hearts', x, y - 10, big ? 3 : 1, { tint: 0xdff4ff, scale: 0.16, scaleEnd: 0.1, life: 1700, alpha: 0.9, speed: [10, 30], angle: [265, 275] });
    this.v.emit('glow', x, y - 20, 1, { tint: 0xbfe8ff, scale: 0.7, scaleEnd: 0.2, life: 1300, alpha: 0.5, speed: [15, 30], angle: [270, 270] });
  }

  // ------------------------------------------------------------ element specials

  shards(x: number, y: number, el: Element, n: number, R: number, ms = 480): void {
    const p = PALETTE[el];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, tx = x + Math.cos(a) * R, ty = y + Math.sin(a) * R * 0.5;
      const rot = Math.atan2(ty - y, tx - x) + Math.PI / 2;
      const img = this.scene.add.image(x, y, 'fx_shard').setTint(i % 2 ? p.core : p.mid).setBlendMode(ADD).setDepth(VFX_DEPTH - 1).setRotation(rot).setScale(0.3, 0.3);
      const big = 0.7 + Math.random() * 0.5;
      this.scene.tweens.add({ targets: img, x: tx, y: ty, scaleX: big, scaleY: big, duration: ms, ease: 'Cubic.easeOut' });
      this.scene.tweens.add({ targets: img, alpha: 0, delay: ms * 0.9, duration: 500, onComplete: () => img.destroy() });
    }
  }

  implode(x: number, y: number, el: Element, ms = 260): void {
    const p = PALETTE[el];
    const ring = this.scene.add.image(x, y, 'fx_ring').setTint(p.mid).setBlendMode(ADD).setScale(1.2, 0.8).setAlpha(0).setDepth(VFX_DEPTH);
    this.scene.tweens.add({ targets: ring, scaleX: 0.05, scaleY: 0.05, alpha: 1, duration: ms, ease: 'Cubic.easeIn', onComplete: () => ring.destroy() });
    this.converge(x, y, el, ms, 100);
  }

  vines(x: number, y: number, color = 0x4aa83a, n = 7): void {
    const g = this.scene.add.graphics().setDepth(VFX_DEPTH - 3);
    const vs = Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + Math.random() * 0.5, len: 80 + Math.random() * 70, curl: (Math.random() - 0.5) * 2, ph: Math.random() * 6 }));
    const st = { k: 0 };
    this.scene.tweens.add({
      targets: st, k: 1, duration: 380, ease: 'Back.easeOut',
      onUpdate: () => {
        g.clear();
        for (const v of vs) {
          let px = x, py = y;
          for (let j = 1; j <= 10; j++) {
            const t = (j / 10) * st.k;
            const nx = x + Math.cos(v.a) * t * v.len * 0.45 + Math.sin(v.ph + t * 5) * v.curl * 14 * t;
            const ny = y + Math.sin(v.a) * t * v.len * 0.22 - t * v.len * 0.95;
            g.lineStyle(9 * (1 - t) + 2, color, 1); g.lineBetween(px, py, nx, ny);
            g.lineStyle(3 * (1 - t) + 1, 0xb8ff90, 0.8); g.lineBetween(px, py, nx, ny);
            px = nx; py = ny;
          }
          g.fillStyle(0xd8ff90, 1); g.fillCircle(px, py, 4);
        }
      },
      onComplete: () => this.scene.tweens.add({ targets: g, alpha: 0, delay: 420, duration: 300, onComplete: () => g.destroy() }),
    });
  }

  /** A musical note flying in a curve from a to b. */
  note(ax: number, ay: number, bx: number, by: number, tint = 0xff9ac8): void {
    const img = this.scene.add.image(ax, ay, 'fx_note').setTint(tint).setBlendMode(ADD).setDepth(VFX_DEPTH).setScale(0.6);
    const st = { k: 0 }, side = (Math.random() - 0.5) * 120, h = 60 + Math.random() * 60;
    this.scene.tweens.add({
      targets: st, k: 1, duration: 650 + Math.random() * 250, ease: 'Sine.easeInOut',
      onUpdate: () => {
        const k = st.k;
        img.setPosition(ax + (bx - ax) * k + Math.sin(k * 9) * 10 + side * Math.sin(k * Math.PI), ay + (by - ay) * k - h * Math.sin(k * Math.PI)).setRotation(Math.sin(k * 8) * 0.4).setAlpha(k > 0.85 ? (1 - k) / 0.15 : 1);
        if (Math.random() < 0.3) this.v.emit('glow', img.x, img.y, 1, { tint, scale: 0.2, scaleEnd: 0.02, life: 300, alpha: 0.6 });
      },
      onComplete: () => { img.destroy(); this.v.emit('hearts', bx, by, 2, { tint: 0xff6aae, scale: 0.12, life: 900, speed: [20, 60] }); },
    });
  }

  /** Pulsing tinted glow over a moving target (charm, buffs). */
  pulse(at: () => { x: number; y: number }, tint: number, ms: number): void {
    const p0 = at();
    const img = this.scene.add.image(p0.x, p0.y, 'vfx_light').setTint(tint).setBlendMode(ADD).setDepth(VFX_DEPTH - 4).setScale(0.8);
    const st = { k: 0 };
    this.scene.tweens.add({ targets: st, k: 1, duration: ms, onUpdate: () => { const q = at(); img.setPosition(q.x, q.y).setAlpha(0.35 + 0.35 * Math.sin(st.k * Math.PI * 6)).setScale(0.8 + 0.2 * Math.sin(st.k * Math.PI * 6)); }, onComplete: () => img.destroy() });
  }

  // ------------------------------------------------------------ level up

  levelUp(x: number, groundY: number, level: number): void {
    const sc = this.scene, v = this.v;
    const pil = sc.add.image(x, groundY, 'fx_pillar').setOrigin(0.5, 1).setTint(0xffe680).setBlendMode(ADD).setDepth(VFX_DEPTH - 5).setScale(3.4, 0.2).setAlpha(0.95);
    sc.tweens.add({ targets: pil, scaleY: 4.2, duration: 260, ease: 'Cubic.easeOut' });
    sc.tweens.add({ targets: pil, alpha: 0, scaleX: 1.6, delay: 900, duration: 1100, ease: 'Quad.easeIn', onComplete: () => pil.destroy() });
    const hy = groundY - 62;
    const useAngel = sc.textures.exists('fx_levelup_angel') && sc.anims.exists('levelup_angel');
    if (useAngel) {
      const ang = sc.add.sprite(x, groundY - 70, 'fx_levelup_angel').setScale(2.1).setBlendMode(ADD).setDepth(VFX_DEPTH - 4).setAlpha(0);
      ang.play('levelup_angel');
      sc.tweens.add({ targets: ang, alpha: 1, duration: 200 });
      sc.tweens.add({ targets: ang, y: ang.y - 40, alpha: 0, delay: 1000, duration: 700, onComplete: () => ang.destroy() });
    }
    for (const dir of useAngel ? [] : [-1, 1]) {
      const w = sc.add.image(x + dir * 8, hy, 'fx_wing').setOrigin(dir < 0 ? 1 - 8 / 256 : 8 / 256, 170 / 200).setFlipX(dir < 0).setBlendMode(ADD).setTint(0xfff0b0).setDepth(VFX_DEPTH - 4).setScale(0.1).setAlpha(0.95);
      sc.tweens.add({ targets: w, scaleX: 0.95, scaleY: 0.95, duration: 480, ease: 'Back.easeOut' });
      sc.tweens.add({ targets: w, scaleX: 0.7, yoyo: true, repeat: 2, delay: 520, duration: 220, ease: 'Sine.easeInOut' });
      sc.tweens.add({ targets: w, alpha: 0, y: hy - 30, delay: 1300, duration: 700, onComplete: () => w.destroy() });
    }
    const halo = sc.add.image(x, groundY - 125, 'fx_ring').setTint(0xffe680).setBlendMode(ADD).setDepth(VFX_DEPTH + 1).setScale(0.05, 0.02).setAlpha(1);
    sc.tweens.add({ targets: halo, scaleX: 0.3, scaleY: 0.1, duration: 350, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: halo, y: groundY - 145, alpha: 0, delay: 1200, duration: 800, onComplete: () => halo.destroy() });
    sc.time.addEvent({ delay: 70, repeat: 16, callback: () => {
      v.emit('stars', x + (Math.random() - 0.5) * 90, groundY - 10, 1, { tint: 0xffe680, scale: 0.2, scaleEnd: 0.02, speed: [90, 230], angle: [255, 285], life: 1100 });
      v.emit('glow', x + (Math.random() - 0.5) * 60, groundY, 1, { tint: 0xfff0b0, scale: 0.4, scaleEnd: 0.05, speed: [100, 200], angle: [265, 275], life: 1000, alpha: 0.7 });
    } });
    const ban = sc.add.text(x, groundY - 205, '¡NIVEL ARRIBA!', { fontFamily: FONT, fontStyle: 'bold', fontSize: '56px', color: '#ffe680', stroke: '#7a3a00', strokeThickness: 11 })
      .setOrigin(0.5, 1).setDepth(VFX_DEPTH + 40).setShadow(0, 5, '#000000', 0, true, true).setScale(0.2);
    const sub = sc.add.text(x, groundY - 200, 'Nivel ' + level, { fontFamily: FONT, fontStyle: 'bold', fontSize: '28px', color: '#ffffff', stroke: '#5a2a00', strokeThickness: 7 })
      .setOrigin(0.5, 0).setDepth(VFX_DEPTH + 40).setScale(0.2);
    sc.tweens.add({ targets: [ban, sub], scale: 1, duration: 300, ease: 'Back.easeOut' });
    sc.tweens.add({ targets: [ban, sub], alpha: 0, delay: 1700, duration: 600, onComplete: () => { ban.destroy(); sub.destroy(); } });
    sc.tweens.add({ targets: [ban, sub], y: '-=40', delay: 1700, duration: 600 });
    this.burst(x, groundY - 90, 0xffe680, 2.2);
  }
}