"""Fails if the page links to a file that is not in site/ (run in CI before every deploy)."""
import re
import sys
from pathlib import Path

site = Path(__file__).resolve().parent.parent / "site"
html = (site / "index.html").read_text(encoding="utf-8")
refs = {r for r in re.findall(r'(?:src|href)="([^"#?:]+)"', html) if not r.startswith(("mailto", "http"))}
refs |= set(re.findall(r"url\(([^):]+)\)", html))
missing = sorted(r for r in refs if r not in ("/", "") and not (site / r.lstrip("/")).is_file())
ids = set(re.findall(r'id="([^"]+)"', html))
dead = sorted(a for a in set(re.findall(r'href="#([^"]+)"', html)) if a not in ids)
print(f"{len(refs)} local files referenced, {len(missing)} missing; {len(dead)} broken in-page links")
for m in missing + [f"#{d}" for d in dead]:
    print("  -", m)
sys.exit(1 if missing or dead else 0)
