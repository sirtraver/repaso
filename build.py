#!/usr/bin/env python3
"""Copia los JSON de estudio a data/ y genera data/index.json.
Si no hay apuntes reales, incluye el tema de ejemplo (ejemplo/). Usa --ejemplo para forzarlo."""
import json, shutil, sys, time, re
from pathlib import Path
ROOT = Path(__file__).resolve().parent
SRC = Path("/workspace/hub/projects/01-cetys/estudio")
DATA = ROOT / "data"
shutil.rmtree(DATA, ignore_errors=True); DATA.mkdir()
files = sorted(SRC.glob("*/tema-*.json")) if SRC.exists() else []
real = bool(files)
if not real or "--ejemplo" in sys.argv:
    files += sorted((ROOT / "ejemplo").glob("tema-*.json"))
subjects = {}
for f in files:
    try: d = json.loads(f.read_text(encoding="utf-8"))
    except Exception as e: print("ERROR", f, e); continue
    asig = d.get("asignatura") or f.parent.name
    slug = re.sub(r"[^a-z0-9]+", "-", f.parent.name.lower()).strip("-") or "x"
    out = DATA / slug / f.name; out.parent.mkdir(exist_ok=True)
    shutil.copy(f, out)
    s = subjects.setdefault(slug, {"asignatura": asig, "slug": slug, "temas": []})
    s["temas"].append({"tema": d.get("tema"), "titulo": d.get("titulo", f.stem), "file": f"data/{slug}/{f.name}",
        "tarjetas": len(d.get("tarjetas", [])), "ejemplo": bool(d.get("ejemplo"))})
for s in subjects.values(): s["temas"].sort(key=lambda t: int(t["tema"]) if str(t["tema"]).isdigit() else 999)
for ex in (SRC / "examenes.json", ROOT / "examenes.json"):
    if ex.exists(): shutil.copy(ex, DATA / "examenes.json"); break
version = time.strftime("%Y%m%d%H%M%S")
idx = {"version": version, "real": real, "asignaturas": sorted(subjects.values(), key=lambda s: s["asignatura"])}
(DATA / "index.json").write_text(json.dumps(idx, ensure_ascii=False, indent=1), encoding="utf-8")
sw = ROOT / "sw.js"; sw.write_text(re.sub(r"const V = '[^']*'", f"const V = '{version}'", sw.read_text()))
print(f"{len(files)} temas, {len(subjects)} asignaturas, versión {version}")
