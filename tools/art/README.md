# tools/art - regenerate the game art

Requires Python 3.11 + Pillow + numpy + scipy, and codex-cli with `image_generation` enabled.

- `jobs.py` - prompt definitions (one job = one raw image or a sheet of several sprites). Style prefix lives here.
- `gen.py` - `python gen.py "id1,id2" "id3" ...` runs one `codex exec -s workspace-write -` call per argument (prompt via stdin), 4 in parallel. Codex copies each generated PNG to `public/assets/gen/_raw/<cat>/<id>.png`; existing raws are skipped (delete a raw to regenerate it). Logs: `gen_<id>.log`.
- `chroma.py` - magenta key (handles real-alpha output too), despill, sheet splitting by connected components, fit to target height.
- `iso_tile.py` - seamless square texture -> exact 256x128 iso diamond (inverse affine map, with half-shift seam blend).
- `build.py [tiles walls chars props icons ui bg]` - raw -> final assets; contact sheets in `_raw/previews/`. UI sheet parts are saved to `_raw/ui_parts/` and mapped via `build.do_ui_parts({...})`; portraits via `build.do_portraits()`.
- `mkreadme.py` - rewrites `public/assets/gen/README.md`.

Sprite target heights are in `build.py` (CHARS / PROPS). Portraits attach the final character PNG with `-i` for consistency.

## v2 painterly world pipeline
- `jobs2.py` - painterly prompts (STYLE2) for tiles, walls, prop sheets (SHEETS: id -> cols, rows, [(key, target_height, desc)]), atmo, ui. Raws go to `_raw/v2/<cat>/`.
- `gen2.py` - same as gen.py but for jobs2 (`python gen2.py "a,b,c" "d,e"`; 4 codex processes in parallel; existing raws skipped).
- `build2.py [tiles walls props atmo ui]` - tiles -> 512x256 diamonds (+6x6 montages in `_raw/previews/v2/`), walls -> 512 wide, props sliced from sheets and fitted to heights (about 1.6x the v1 heights), atmo (luminance -> alpha), ui2.
- Characters are NOT part of v2 (still built by build.py / anim_*.py).
