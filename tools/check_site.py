"""Fails if any page links to a file or page that does not exist (run in CI before every deploy).

Checks every site/*.html: local src/href targets (pages, images, styles), url(...) in the
stylesheet, and #anchors within the same page. External links and mailto: are skipped.
"""
import re
import sys
from pathlib import Path

site = Path(__file__).resolve().parent.parent / "site"
problems, checked = [], 0
pages = sorted(site.glob("*.html"))
for page in pages:
    html = page.read_text(encoding="utf-8")
    ids = set(re.findall(r'id="([^"]+)"', html))
    for ref in re.findall(r'(?:src|href)="([^"]+)"', html):
        if ref.startswith(("http:", "https:", "mailto:", "tel:")):
            continue
        checked += 1
        path, _, anchor = ref.partition("#")
        if path and not (site / path).is_file():
            problems.append(f"{page.name}: missing {path}")
        elif not path and anchor and anchor not in ids:
            problems.append(f"{page.name}: no element with id '{anchor}'")
css = site / "assets" / "style.css"
for ref in re.findall(r"url\(([^)]+)\)", css.read_text(encoding="utf-8")):
    checked += 1
    if not (css.parent / ref.strip("'\"")).is_file():
        problems.append(f"style.css: missing {ref}")
print(f"{len(pages)} pages, {checked} local links checked, {len(problems)} problems")
for p in problems:
    print("  -", p)
sys.exit(1 if problems else 0)
