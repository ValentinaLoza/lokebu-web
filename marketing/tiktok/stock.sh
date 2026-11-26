#!/usr/bin/env bash
# Descarga los clips de stock de Mixkit (licencia gratuita, uso comercial permitido)
# y los prepara para historias-stock.html: recorte vertical 9:16, 30 cps, WebM con todos los cuadros clave.
# Uso (desde la carpeta del proyecto): bash marketing/tiktok/stock.sh
# Después: node marketing/tiktok/generar.js stock
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p stock/originales
# id  inicio(s)  duración(s)  centro horizontal del encuadre (0 = izquierda, 1 = derecha)
while read -r id ss d cx; do
  [ -z "$id" ] && continue
  in="stock/originales/$id.mp4"; out="stock/$id.webm"
  [ -f "$in" ] || curl -sS -m 180 -o "$in" "https://assets.mixkit.co/videos/$id/$id-720.mp4"
  w=$(ffprobe -v error -show_entries stream=width -of csv=p=0 "$in" | head -1)
  if [ "$w" -gt 1000 ]; then
    x=$(python3 -c "print(max(0,min(1280-405,int($cx*1280-202))))")
    vf="crop=405:720:$x:0,scale=720:1280:flags=lanczos,fps=30"
  else
    vf="scale=720:1280,fps=30"
  fi
  ffmpeg -nostdin -v error -y -ss "$ss" -t "$d" -i "$in" -an -vf "$vf" \
    -c:v libvpx -g 1 -crf 6 -b:v 6M -deadline good -cpu-used 2 "$out"
  echo "✓ $id"
done <<'LISTA'
4373 4 3.2 0.5
223 2 3 0.56
205 6 2.6 0.58
39790 2 3.6 0.34
3428 5 2.6 0.5
8739 3 3.2 0.36
39815 0.3 2.4 0.5
36351 0.5 3.2 0.5
23976 6 3 0.6
22433 11 2.8 0.55
40102 6 3 0.62
27752 10 3.6 0.45
42270 2 3.2 0.56
46586 6 3.8 0.55
LISTA
