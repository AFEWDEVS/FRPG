import type Phaser from 'phaser';

export interface Typer { complete(): void; readonly done: boolean; stop(): void; }

/** Reveals `full` in `target` one character at a time. Click-to-complete via complete(). */
export function typewriter(scene: Phaser.Scene, target: Phaser.GameObjects.Text, full: string, msPerChar = 22, onDone?: () => void): Typer {
  let i = 0;
  let done = false;
  target.setText('');
  const finish = () => {
    if (done) return;
    done = true;
    ev.remove(false);
    target.setText(full);
    onDone?.();
  };
  const ev = scene.time.addEvent({
    delay: msPerChar, loop: true,
    callback: () => {
      i++;
      target.setText(full.slice(0, i));
      if (i >= full.length) finish();
    },
  });
  return { complete: finish, get done() { return done; }, stop: () => { done = true; ev.remove(false); } };
}