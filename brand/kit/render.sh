#!/bin/sh
# Rebuilds every SVG, then every PNG/ICO, from geometry.py. Needs Chrome (or any render_png.py backend).
set -e
cd "$(dirname "$0")"
R="${LOGO_SKILL:-$HOME/.claude/skills/logo-design}/scripts/render_png.py"
python3 build_kit.py
# Figma Community
python3 "$R" figma/icon.svg -o figma/icon-128.png --size 128
python3 "$R" figma/icon.svg -o figma/icon-256.png --size 256
# Web / PWA
python3 "$R" web/favicon.svg -o web/favicon-16.png --size 16
python3 "$R" web/favicon.svg -o web/favicon-32.png --size 32
python3 "$R" web/favicon.svg -o web/favicon-48.png --size 48
python3 "$R" web/favicon.svg --ico web/favicon.ico --ico-sizes 16 32 48
python3 "$R" figma/icon.svg -o web/apple-touch-icon.png --size 180
python3 "$R" figma/icon.svg -o web/icon-192.png --size 192
python3 "$R" figma/icon.svg -o web/icon-512.png --size 512
python3 "$R" figma/icon.svg -o web/maskable-512.png --size 512
# Logo PNGs (transparent)
for f in logo/autoflow-symbol-color logo/autoflow-symbol-on-dark logo/autoflow-symbol-black logo/autoflow-symbol-white; do
  python3 "$R" "$f.svg" -o "$f.png" --size 1024
done
for f in logo/autoflow-horizontal-color logo/autoflow-horizontal-on-dark logo/autoflow-horizontal-black logo/autoflow-horizontal-white; do
  python3 "$R" "$f.svg" -o "$f.png" --width 2400 --height 480
done
for f in logo/autoflow-stacked-color logo/autoflow-stacked-on-dark; do
  python3 "$R" "$f.svg" -o "$f.png" --width 1200 --height 1100
done
python3 "$R" sheets/construction.svg -o sheets/construction.png --width 1800 --height 768
python3 "$R" sheets/brand-sheet.html -o sheets/brand-sheet.png --width 1600 --height 2140
# Liquid Glass icon (Icon Composer style) and its flat layers
python3 glass.py
for a in light dark; do
  for s in 1024 512 256 128; do python3 "$R" glass/glass-icon-$a.svg -o glass/glass-icon-$a-$s.png --size $s; done
done
python3 "$R" glass/glass-symbol.svg -o glass/glass-symbol-1024.png --size 1024
cp glass/glass-icon-light-square.svg ../../publish/icon.svg
cp glass/glass-symbol.svg ../../publish/logo.svg
