import Phaser from 'phaser';
import type { CharacterAnimator } from '../anim/CharacterAnimator';

const easeOutBack = (x: number) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

/**
 * Procedural animation layered over a static sprite or a CharacterAnimator sheet: breathing, walk bob + lean,
 * squash and stretch, hit recoil + flash, attack lunge, spawn pop, death collapse with soul wisps.
 * Sprite origin must be (0.5, 1) at container (0,0).
 */
export class ProcAnim {
  private walkPhase = 0;
  private idlePhase = Math.random() * 6;
  private lastHalf = 0;
  private mv = 0;
  private flashUntil = 0;
  private lunge = { x: 0, y: 0, t: 0, dur: 1 };
  private recoil = { x: 0, y: 0, t: 0, dur: 1 };
  private spring = { x: 1, y: 1 };
  private spawnT = 1e9;
  private spawnDur = 380;
  private leftSign = 1;
  private deathTween?: Phaser.Tweens.Tween;
  dying = false;
  animator?: CharacterAnimator;
  /** Called twice per walk cycle (each footfall). */
  onStep?: () => void;
  /** Tint re-applied after a hit flash (champions). */
  baseTint?: number;

  constructor(
    private sprite: Phaser.GameObjects.Image,
    private shadow: Phaser.GameObjects.Ellipse,
    private baseScale: number,
  ) {}

  setAnimator(a: CharacterAnimator): void {
    this.animator = a;
    this.sprite.setScale(this.baseScale * a.scaleMul);
  }

  setFacingLeft(left: boolean): void { this.sprite.setFlipX(left); this.leftSign = left ? -1 : 1; }
  setFacingUp(up: boolean): void { if (this.animator) this.animator.up = up; }

  flash(ms = 90): void {
    if (this.dying) return;
    this.flashUntil = this.sprite.scene.time.now + ms;
    this.sprite.setTintFill(0xffffff);
    this.recoil = { x: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 4), y: -2, t: 140, dur: 140 };
    this.spring.x = 1.1; this.spring.y = 0.88;
    this.animator?.playHurt(ms + 140);
  }

  /** Squash & stretch pulse (landing, dash start...). */
  squash(sx: number, sy: number): void { this.spring.x = sx; this.spring.y = sy; }

  /** Quick lunge toward a screen-space direction (attacks). Also starts the attack sheet animation. */
  attackLunge(dx: number, dy: number, dur = 160, animMs: number | false = Math.max(dur, 280)): void {
    const l = Math.hypot(dx, dy) || 1;
    this.lunge = { x: (dx / l) * 14, y: (dy / l) * 7, t: dur, dur };
    this.spring.x = 0.9; this.spring.y = 1.12;
    if (this.animator && animMs !== false) {
      if (Math.abs(dy) > 0.01) this.animator.up = dy < 0;
      if (Math.abs(dx) > 0.01) this.setFacingLeft(dx < 0);
      this.animator.playAttack(animMs);
    }
  }

  /** Pop-in with optional dust puffs. */
  spawnIn(dust = false): void {
    this.spawnT = 0;
    if (!dust) return;
    const c = this.sprite.parentContainer;
    if (!c) return;
    const sc = this.sprite.scene;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random();
      const p = sc.add.image(c.x, c.y - 6, 'vfx_smoke').setDepth(c.depth + 1).setAlpha(0.55).setScale(0.12 + Math.random() * 0.08).setTint(0xcfc2a8);
      sc.tweens.add({ targets: p, x: c.x + Math.cos(a) * 46, y: c.y - 6 + Math.sin(a) * 22 - 10, alpha: 0, scale: p.scale * 2.2, duration: 520, ease: 'Quad.easeOut', onComplete: () => p.destroy() });
    }
  }

  /** Death: flash, collapse, soul wisps, fade. persist keeps the corpse (player) instead of fading. */
  die(persist: boolean, onDone?: () => void): void {
    if (this.dying) return;
    this.dying = true;
    const s = this.sprite, sh = this.shadow, sc = s.scene;
    const c = s.parentContainer;
    this.animator?.playDeath();
    const a0 = s.alpha, sh0 = sh.alpha;
    const dir = this.leftSign;
    const sx0 = s.scaleX, sy0 = s.scaleY, ox = s.x, oy = s.y;
    s.setTintFill(0xffffff);
    if (c && !persist) {
      const cols = [0xbfe8ff, 0xffffff, 0xffe9a8, 0xd9c2ff];
      for (let i = 0; i < 6; i++) {
        const w = sc.add.image(c.x + (Math.random() - 0.5) * 36, c.y - 30 - Math.random() * 50, 'vfx_flare').setDepth(900000)
          .setBlendMode(Phaser.BlendModes.ADD).setScale(0.12 + Math.random() * 0.14).setAlpha(0).setTint(cols[i % 4]);
        sc.tweens.add({ targets: w, y: w.y - 70 - Math.random() * 60, x: w.x + (Math.random() - 0.5) * 50, alpha: { from: 0.9, to: 0 }, scale: w.scale * 0.4, duration: 900 + Math.random() * 500, delay: 120 + i * 70, ease: 'Sine.easeOut', onComplete: () => w.destroy() });
      }
    }
    const proxy = { t: 0 };
    this.deathTween = sc.tweens.add({
      targets: proxy, t: 1, duration: persist ? 520 : 760, ease: 'Linear',
      onUpdate: () => {
        if (!s.active) return;
        const t = proxy.t;
        if (t > 0.14) s.clearTint();
        const e = Math.min(1, t / 0.5); const q = 1 - (1 - e) * (1 - e);
        const sheet = !!this.animator;
        s.setScale(sx0 * (sheet ? 1 : 1 + 0.22 * q), sy0 * (sheet ? 1 - 0.08 * q : 1 - 0.62 * q));
        s.setRotation(sheet ? 0 : dir * 1.25 * q);
        s.setPosition(ox, oy + (sheet ? 0 : 6 * q));
        const fade = persist ? 1 : 1 - Phaser.Math.Clamp((t - 0.45) / 0.55, 0, 1);
        s.setAlpha(a0 * fade); sh.setAlpha(sh0 * fade);
      },
      onComplete: () => { onDone?.(); },
    });
  }

  revive(): void {
    if (!this.dying) return;
    this.deathTween?.stop();
    this.dying = false;
    this.sprite.clearTint();
    if (this.baseTint !== undefined) this.sprite.setTint(this.baseTint);
    this.sprite.setRotation(0).setAlpha(1);
    this.shadow.setAlpha(1);
    this.animator?.revive();
    this.spawnT = 0;
  }

  update(dtMs: number, moving: boolean, speedFactor = 1): void {
    if (this.dying) return;
    const s = this.sprite;
    const dt = dtMs / 1000;
    const A = this.animator;
    A?.update(dtMs, moving, speedFactor);
    if (this.flashUntil && s.scene.time.now > this.flashUntil) { this.flashUntil = 0; s.clearTint(); if (this.baseTint !== undefined) s.setTint(this.baseTint); }
    this.mv += ((moving ? 1 : 0) - this.mv) * Math.min(1, dt * 14);
    const mv = this.mv;
    const k = A ? 0.3 : 1;
    if (moving) {
      this.walkPhase += dt * 9 * speedFactor;
      const half = Math.floor(this.walkPhase / Math.PI);
      if (half !== this.lastHalf) { this.lastHalf = half; this.onStep?.(); }
    }
    const w = Math.abs(Math.sin(this.walkPhase));
    const bob = -w * 6.5 * mv * k;
    let sy = 1 - 0.06 * w * mv * k + 0.02 * mv * k;
    let sx = 1 + 0.06 * w * mv * k - 0.02 * mv * k;
    const rot = this.leftSign * (0.05 + 0.03 * Math.sin(this.walkPhase)) * mv * (A ? 0 : 1);
    this.idlePhase += dt * 2.2;
    const b = Math.sin(this.idlePhase) * (1 - mv) * (A ? 0.4 : 1);
    sy += 0.02 * b; sx -= 0.012 * b;
    const sp = this.spring, r = Math.min(1, dt * 11);
    sp.x += (1 - sp.x) * r; sp.y += (1 - sp.y) * r;
    sx *= sp.x; sy *= sp.y;
    if (this.spawnT < this.spawnDur) {
      this.spawnT += dtMs;
      const p = Math.min(1, this.spawnT / this.spawnDur), e = easeOutBack(p);
      sy *= Math.max(0.01, e); sx *= 0.55 + 0.45 * Math.max(0, e);
    }
    let ox = 0, oy = 0;
    if (this.lunge.t > 0) {
      this.lunge.t -= dtMs;
      const p = Math.max(0, this.lunge.t) / this.lunge.dur;
      const f = Math.sin(p * Math.PI);
      ox = this.lunge.x * f; oy = this.lunge.y * f;
    }
    if (this.recoil.t > 0) {
      this.recoil.t -= dtMs;
      const f = Math.max(0, this.recoil.t) / this.recoil.dur;
      ox += this.recoil.x * f; oy += this.recoil.y * f;
    }
    const bs = this.baseScale * (A?.scaleMul ?? 1);
    s.setPosition(ox, bob + oy);
    s.setScale(bs * sx, bs * sy);
    s.setRotation(rot);
    const lift = Math.min(1, Math.abs(bob) / 6.5);
    const sq = 1 + (sp.x - 1) * 0.5;
    this.shadow.setScale((1 - lift * 0.2) * sq, (1 - lift * 0.2) * sq);
    this.shadow.setAlpha(1 - lift * 0.2);
  }
}