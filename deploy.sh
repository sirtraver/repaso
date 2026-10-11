#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 build.py "$@"
git add -A
git commit -m "Actualizar contenido $(date '+%Y-%m-%d %H:%M')" || echo "Sin cambios"
git push origin main
echo "Publicado: https://sirtraver.github.io/repaso/ (tarda ~1 min)"
