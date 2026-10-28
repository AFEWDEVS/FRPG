# VFX technique references (Phaser 3, 2D)

Verified reachable at time of writing. No downloads required.

1. Phaser particle emitters (additive layering, blendMode ADD, scale/alpha/tint over lifetime, `emitZone`, `deathZone`):
   https://docs.phaser.io/phaser/concepts/gameobjects/particles
   Technique: stack 2-3 emitters per effect (core flash `light`/`flare`, sparks `spark`/`star`, smoke `smoke` with NORMAL blend), tint white textures per element, short lifespans, fast alpha falloff.
2. Phaser FX / PostFX pipelines (glow, bloom, displacement, custom fragment shaders for shockwave/ripple, screen-space distortion):
   https://docs.phaser.io/phaser/concepts/fx
   Technique: shockwave = custom PostFXPipeline sampling the render texture with a radial UV offset driven by a time uniform; or cheap fallback = expanding `circle`/`light` ring sprite, ADD blend, scale tween + alpha fade.
3. Official Phaser examples index (search "particles", "blend modes", "postfx", "camera shake"):
   https://phaser.io/examples
   and source repo: https://github.com/phaserjs/examples
4. Kenney Particle Pack (source of most textures here, CC0): https://kenney.nl/assets/particle-pack

Quick recipes: hit = flash (`flare`, 80ms) + radial `spark` burst + camera shake 60ms + 2-frame hitstop; explosion = `scorch` decal (NORMAL) + `fire`/`smoke` emitters + shockwave ring + screen flash; magic circle = `magic_circle` rotating, ADD, scaleY 0.5 for ground projection.