"""Generate animation sheets via codex, attaching the static sprite as reference.
usage: python anim_gen.py key[,key2] ...   (each arg = one codex call, 4 parallel). Env SPLIT=1 -> two 2x4 sheets (suffix _a/_b).
Raw output: public/assets/gen/_raw/anim/<key>.png (delete to regenerate)."""
import subprocess, sys, os, shutil, concurrent.futures as cf
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "public", "assets", "gen")

ATK = {
 "hero_knight": "sword slash: raise sword back, big forward slash with motion arc, impact with spark, recover",
 "hero_mage": "staff cast: pull staff back, thrust staff forward with glowing orb, magic burst at tip, recover",
 "hero_ranger": "bow: draw arrow back, full draw aim, release arrow with string vibrating, recover",
 "amaranta": "gesture: hand on chest, extend hand offering a rose, sweet smile, wave",
 "npc_elder": "talk gesture: raise one finger lecturing, both hands open, nod, hand on beard",
 "npc_merchant": "talk gesture: rub hands, hold out wares, spread arms welcoming, count coins",
 "npc_healer": "talk gesture: hands clasped in prayer, raise hands with soft glow, bless gesture, bow",
 "npc_bard": "play instrument: strum, swing, flourish, bow",
 "goblin": "claw/stab: crouch back with weapon raised, lunge forward stab, impact, recover",
 "heart_slime": "slam: squash and stretch, leap up, slam down flattened, wobble recover",
 "wolf": "bite: crouch back, lunge with open jaws, bite impact, recover",
 "mushroom_man": "slam: lean back with cap raised, headbutt/slam forward releasing spores, impact, recover",
 "thorn_queen": "cast: gather thorny vines, lash vines forward, impact, recover",
 "ogre_poet": "slam: raise huge club/fist overhead, slam down, impact shockwave, recover",
 "imp": "claw: wings up crouch, dive claw swipe, impact, recover",
 "skeleton": "slash: raise rusty weapon back, slash forward, impact, recover",
 "fire_elemental": "burst: contract flames, thrust fire forward, fire blast impact, recover",
 "ash_golem": "slam: raise both fists overhead, slam down, impact with ash cloud, recover",
 "jealous_gargoyle": "claw: wings spread crouch, swipe claws forward, impact, recover",
 "malvarron": "dark cast: raise arms gathering dark energy, thrust forward, impact burst, recover",
}
NPC = {"amaranta", "npc_elder", "npc_merchant", "npc_healer", "npc_bard"}

HEAD = ("Using the attached reference image, create a 2D sprite animation sheet of THE SAME character: identical design, colors, outfit, proportions "
        "and art style as the reference (Ragnarok Online style chibi 2D sprite, isometric 3/4 view, clean dark outlines, soft shading). "
        "Pure flat magenta #FF00FF background, wide magenta gaps between all frames, no text, no grid lines, no shadows on the ground, each frame fully separate and not touching others. "
        "All frames same scale, character the same size in every frame, feet roughly on the same baseline per row.")


def prompt(key, part=None):
    atk = ATK[key]
    rows = {
        0: "ROW 0: walk cycle facing DOWN-RIGHT (toward the camera, diagonal), 4 frames: contact pose (legs apart, arms swinging opposite), passing pose (legs together, body slightly raised), contact pose with opposite leg forward, passing pose. Clear leg and arm swing.",
        1: "ROW 1: walk cycle facing UP-RIGHT (back view diagonal, we see the character's back), 4 frames: contact, passing, opposite contact, passing. Clear leg and arm swing.",
        2: "ROW 2: attack facing DOWN-RIGHT, 4 frames (anticipation, swing/action, impact, recover): " + atk + ".",
        3: "ROW 3: idle breathe frame A (relaxed standing, facing down-right), idle frame B (slightly lower breath/shift), hurt (recoil, flinch backwards, eyes shut), death (collapsed on the ground lying down).",
    }
    if key in NPC:
        rows[2] = "ROW 2: talking gesture / emote facing DOWN-RIGHT, 4 frames: " + atk + "."
    if part is None:
        return HEAD + " Layout: exactly 4 columns x 4 rows = 16 frames, one image, rows top to bottom:\n" + "\n".join(rows[i] for i in range(4))
    r = (0, 1) if part == "a" else (2, 3)
    return HEAD + " Layout: exactly 4 columns x 2 rows = 8 frames, one image, rows top to bottom:\n" + "\n".join(rows[i].replace("ROW %d" % i, "ROW %d" % (i - r[0])) for i in r)


def run(key):
    split = os.environ.get("SPLIT") == "1"
    parts = ["a", "b"] if split else [None]
    ref = os.path.join(GEN, "characters", key + ".png")
    lines = ["Use your built-in image generation tool %d time(s), using the attached reference image as the exact character identity. After generation, copy the generated PNG unchanged to the destination path. Reply only with saved paths." % len(parts)]
    outs = []
    for k, p in enumerate(parts, 1):
        dest = os.path.join(GEN, "_raw", "anim", key + ("_" + p if p else "") + ".png").replace("\\", "/")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        outs.append(dest)
        lines.append(f"\nIMAGE {k} -> save to {dest}\nPrompt: {prompt(key, p)}")
    cmd = [shutil.which("codex.cmd") or "codex", "exec", "--skip-git-repo-check", "-s", "workspace-write", "-i", ref, "-"]
    r = subprocess.run(cmd, input="\n".join(lines), capture_output=True, text=True, cwd=ROOT, encoding="utf-8", errors="replace")
    open(os.path.join(ROOT, "tools", "art", "gen_anim_%s.log" % key), "w", encoding="utf-8").write((r.stdout or "")[-3000:] + (r.stderr or "")[-2000:])
    return key, [os.path.exists(o) for o in outs]


if __name__ == "__main__":
    keys = [k for a in sys.argv[1:] for k in a.split(",")]
    with cf.ThreadPoolExecutor(4) as ex:
        for k, s in ex.map(run, keys):
            print(k, s, flush=True)
