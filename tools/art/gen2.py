"""Run codex image generation jobs. usage: python gen.py "a,b,c" "d,e" ...  (each arg = one codex call; 4 run in parallel)"""
import subprocess, sys, os, concurrent.futures as cf
from jobs2 import jobs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def run(batch):
    ids = [i for i in batch if not os.path.exists(os.path.join(ROOT, jobs[i]["out"]))]
    if not ids:
        return batch, "skip"
    lines = ["Use your built-in image generation tool %d separate times (one fresh generation per image below, do not reuse images). "
             "After each generation, copy the generated PNG file unchanged to the exact destination path given (create folders if needed). "
             "Do not modify the images. Reply only with the list of saved paths." % len(ids)]
    imgs = []
    for k, i in enumerate(ids, 1):
        j = jobs[i]
        dest = os.path.join(ROOT, j["out"]).replace("\\", "/")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        lines.append(f"\nIMAGE {k} -> save to {dest}\nPrompt: {j['prompt']}")
        imgs += [os.path.join(ROOT, x) for x in j["images"]]
    cmd = [__import__("shutil").which("codex.cmd") or "codex", "exec", "--skip-git-repo-check", "-s", "workspace-write"]
    for x in imgs:
        cmd += ["-i", x]
    cmd += ["-"]
    r = subprocess.run(cmd, input="\n".join(lines), capture_output=True, text=True, shell=False, cwd=ROOT, encoding="utf-8", errors="replace")
    open(os.path.join(ROOT, "tools", "art", "gen2_%s.log" % batch[0]), "w", encoding="utf-8").write((r.stdout or "")[-3000:] + (r.stderr or "")[-2000:])
    return batch, "ok" if r.returncode == 0 else "fail " + r.stderr[-300:]


if __name__ == "__main__":
    batches = [a.split(",") for a in sys.argv[1:]]
    with cf.ThreadPoolExecutor(4) as ex:
        for b, s in ex.map(run, batches):
            print(b, s, flush=True)
    missing = [i for b in batches for i in b if not os.path.exists(os.path.join(ROOT, jobs[i]["out"]))]
    print("MISSING:", missing)