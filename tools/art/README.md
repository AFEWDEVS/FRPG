# tools/art - regenerate the game art

Requires Python 3.11 + Pillow + numpy + scipy, and codex-cli with `image_generation` enabled.

- `jobs.py` - prompt definitions (one job = one raw image or a sheet of several sprites). Style prefix lives here.
- `gen.py` - `python gen.py "id1,id2" "id3" ...` runs one `codex exec -s workspace-write -` call per argument (prompt via stdin), 4 in parallel. Codex copies each generated PNG to `public/assets/gen/_raw/<cat>/<id>.png`; existing raws are skipped (delete a raw to regenerate it). Logs: `gen_<id>.log`.
- `chroma.py` - magenta key (handles real-alpha output too), despill, sheet splitting by connected components, fit to target height.
- `iso_tile.py` - seamless square texture -> exact 256x128 iso diamond (inverse affine map, with half-shift seam blend).
- `build.py [tiles walls chars props icons ui bg]` - raw -> final assets; contact sheets in `_raw/previews/`. UI sheet parts are saved to `_raw/ui_parts/` and mapped via `build.do_ui_parts({...})`; portraits via `build.do_portraits()`.
- `mkreadme.py` - rewrites `public/assets/gen/README.md`.

Sprite target heights are in `build.py` (CHARS / PROPS). Portraits attach the final character PNG with `-i` for consistency.
