# CLAUDE.md

Guidance for Claude Code (and people) working in this repository.

## What this is
The ArchangX company website, https://www.archangx.com: a plain static site (HTML + one CSS file), no build step,
no framework, no backend. Hosted on GitHub Pages; **every push to `main` goes live in 1-2 minutes**.

## Layout
- `site/`: everything that is published. One self-contained HTML file per page, plus `site/assets/style.css`
  (shared by every page), logos and icons in `site/assets/`, `CNAME` (`www.archangx.com`) and `.nojekyll`.
- `tools/check_site.py`: link checker that CI runs before deploying.
- `tools/fingerprint_assets.sh`: CI-only cache busting; adds `?v=<content hash>` to every `assets/...` URL in the
  published copy, so browsers fetch changed CSS and images without a cache clear. It rewrites files in place: don't
  run it on your working copy.
- `.github/workflows/deploy.yml`: runs the checker, fingerprints asset URLs, then publishes `site/` to GitHub Pages.
- `docs/`: ARCHITECTURE, DEPLOYMENT (DNS/HTTPS), OPERATIONS (update, roll back, troubleshoot), DECISIONS
  (design records D1-D7), and `docs/events/` (event material, e.g. the Luma pack for Summit 2027).

Pages: `index`, `guardian` (Seraphim Guardian landing), `wildfire` (Guardian Uriel), `guardian-aurora`, `technology-stack`,
`digital-twin`, `exhibitions`, `summit-2027`, `about`, `contact`. Product rules for Guardian: `docs/SERAPHIM_GUARDIAN.md`
and decision D8 (Guardian Aurora is conceptual and non-operational; readiness labels; no unverified performance claims).

## Commands
```bash
cd site && python -m http.server 8000   # preview at http://localhost:8000
python tools/check_site.py              # must report 0 problems before pushing
```
There are no tests, package manager or dependencies beyond Python 3 for the checker.

## Rules when editing
- **Header and footer are copied into every page.** A nav change (adding/renaming a page) must be made in the
  `<header class="site">` and `<footer class="site">` of *all* pages, kept identical, with `aria-current="page"`
  on the current page's nav link.
- A new page: copy an existing page, then update `<title>`, `<meta name="description">`, the `og:` tags and the
  `<link rel="canonical" href="https://www.archangx.com/<page>.html">`, add it to every nav, and add it to the
  page table in `README.md`.
- Styles go in `site/assets/style.css`; reuse existing classes (`wrap`, `block`, `head`, `cards`, `card`, `btn`,
  `eyebrow`, `two`, ...) rather than adding inline styles.
- No third-party fonts, scripts, analytics or embeds (decision D4). The one deliberate exception is the Summit
  registration form in `summit-2027.html`, which POSTs to FormSubmit (`formsubmit.co`) and rejects personal email
  domains. The contact form only opens a `mailto:` link; nothing is stored.
- Biography content on `about.html` must come only from information Shahin has provided (decision D6). Don't
  invent degrees, roles or claims.
- Reference assets as plain relative paths in double quotes (`href="assets/style.css"`, `url(emblem.png)`). Never
  add `?v=` version strings by hand; the deploy adds them.
- Line endings are LF (`.gitattributes`); keep files UTF-8.
- Run `python tools/check_site.py` after any change to links, images or page names. A failing check makes the
  deploy fail and the live site stays unchanged.

## Publishing and rollback
- Push to `main` = deploy to production. Use a feature branch (e.g. `feature/...`) for work that isn't ready and
  merge when it is.
- Roll back with `git revert <commit> && git push`.
- The repo is owned by the ArchangX GitHub organization (`ArchangX/archangx-website`). Domain DNS is at Squarespace (`www`
  CNAME to `archangx.github.io`); don't touch MX/TXT records, as Google
  Workspace email depends on them. See `docs/DEPLOYMENT.md`.

## History
The earlier FastAPI/GKE microservice version lives in git history (tag `pipeline-v1`); it's not used any more.
