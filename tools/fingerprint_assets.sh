#!/usr/bin/env bash
# Adds a content hash to every asset URL in the copy of the site being published, for example
# assets/style.css -> assets/style.css?v=3f9a1c02be. When a stylesheet or image changes, its URL changes,
# so browsers fetch the new file as soon as they load the new page, instead of reusing a cached copy
# (GitHub Pages serves every file with Cache-Control: max-age=600, and we cannot change that).
#
# Runs in CI (.github/workflows/deploy.yml) after the link check, on the checkout that gets published.
# It rewrites files in place, so don't run it on your working copy; to try it, copy site/ somewhere first:
#   cp -r site /tmp/site-test && bash tools/fingerprint_assets.sh /tmp/site-test
set -euo pipefail

site="${1:?usage: bash tools/fingerprint_assets.sh <site-dir>}"
assets="$site/assets"
hash() { sha256sum "$1" | cut -c1-10; }
regex_escape() { printf '%s' "$1" | sed 's/[][\.*^$/]/\\&/g'; }

# 1. url(...) inside the stylesheet first, so the stylesheet's own hash also changes when an image it uses changes.
for f in "$assets"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f"); [ "$name" = style.css ] && continue
  sed -i "s/url(\(['\"]\{0,1\}\)$(regex_escape "$name")\1)/url(\1$name?v=$(hash "$f")\1)/g" "$assets/style.css"
done

# 2. src="assets/..." and href="assets/..." in every page. Absolute URLs (og:image) are left alone.
for f in "$assets"/*; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  sed -i "s/\"assets\/$(regex_escape "$name")\"/\"assets\/$name?v=$(hash "$f")\"/g" "$site"/*.html
done

echo "Fingerprinted $(cat "$site"/*.html "$assets/style.css" | grep -o '?v=[0-9a-f]\{10\}' | wc -l | tr -d ' ') asset references"
