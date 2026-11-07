# CLAUDE.md

Guidance for Claude Code in this repository. Keep it short; the detail lives in `docs/`.

## What this is

www.archangx.com: eight hand-written static HTML pages and one stylesheet, published to GitHub Pages by
GitHub Actions on every push to `main`. No build step, package manager, framework, server, or third-party
scripts or fonts.

- `site/`: the publish root. **Everything in it becomes public** once it reaches `main`. Nothing else is published.
- `tools/check_site.py`: link and file checker (Python 3, standard library only).
- `.github/workflows/deploy.yml`: runs the checker, uploads `site/`, then deploys to Pages. A failed check blocks
  the deploy and leaves the live site unchanged.
- `docs/`: [ARCHITECTURE](docs/ARCHITECTURE.md) (diagrams, site map) · [DEPLOYMENT](docs/DEPLOYMENT.md) (DNS, HTTPS) ·
  [OPERATIONS](docs/OPERATIONS.md) (edit, roll back, troubleshoot) · [DECISIONS](docs/DECISIONS.md) (D1–D6) ·
  `events/` (off-site event material, e.g. the Luma pack).

The GitHub repository is public. Never commit secrets, private contact details or unconfirmed plans.

## Commands

```bash
cd site && python -m http.server 8000   # preview at http://localhost:8000 (python3 on macOS/Linux)
python tools/check_site.py              # must end "0 problems" before you open a PR
```

There is nothing to install, build, lint or unit-test. If Python isn't available, say so; don't skip the check silently.

## Workflow: branch, PR, merge = deploy

- Work on a branch (`git switch -c <topic>`), never directly on `main`.
- Run the checker locally before pushing. CI checks only pushes to `main`, not PRs.
- Open a PR with `gh pr create`. **Merging to `main` publishes to www.archangx.com in 1–2 minutes.**
- Claude does not merge PRs or push to `main` unless the developer explicitly asks.
- Roll back with `git revert <sha>` in a new PR (pushed straight to `main` only if urgent). Never force-push `main`.
- Commit messages: one line, `Area: what changed`, for example
  `Summit registration: add phone number (required) and LinkedIn profile (optional)`.
- When hosting, DNS, the workflow or a design decision changes, update the matching `docs/` file in the same PR.

## Page anatomy (every page)

- `<head>`: charset, viewport, `<title>Page — ArchangX</title>` (em dash), meta description, `og:title` and
  `og:description` matching them, `og:image` = `https://www.archangx.com/assets/logo.png`,
  `<link rel="canonical" href="https://www.archangx.com/<file>.html">` (home: `https://www.archangx.com/`),
  then `assets/style.css`.
- `<header class="site">` and `<footer class="site">` are copied into all eight pages and **must stay identical**,
  except that the current page's header link carries `aria-current="page"`. A nav change means editing all eight
  files. Drift check (Bash) must print a single line with the count 8:
  `for f in site/*.html; do grep 'nav class="main"' "$f" | sed 's/ aria-current="page"//' | md5sum; done | sort | uniq -c`
- Body: `.wrap.page-hero` (`.crumbs`, `.eyebrow`, `h1` with a `.flame-text` span, lead `p`), then
  `section.block > .wrap` sections. Dark call-to-action bands use `section.block.night`.
- Footer year: keep both `<span class="year">2026</span>` and the one-line script that sets the current year.
- Wildfire and Technology Stack end with the same `.connected` strip; Digital Twin links back to both through its
  closing cards. Keep these cross-links in step when you rename or restructure any of the three pages.

## HTML / CSS / JS conventions

- Relative paths with no leading slash (`href="contact.html"`, `src="assets/logo.png"`). They work under
  `http.server` and on Pages.
- Double-quoted attributes only. The checker can't see single-quoted links.
- Reuse the components in `site/assets/style.css` before adding new ones: `.cards`/`.card` (`a.card` with `.more`
  for links), `.two`, `ul.ticks`, `.flow`, `.models`/`.model`, `.stack`/`.layer.l1`–`.l5`, `.fit`, `.connected`,
  `.btn`, `.btn.ghost`, `.tag`, `.eyebrow`, `.announce`, `form.contact`.
- Colours come from the `:root` variables (logo palette: wing greens, flame gradient). Don't add new hard-coded colours.
- One stylesheet. Put new rules under a comment naming the section or page. Avoid inline `style=""` except for
  one-off layout tweaks.
- JavaScript is vanilla, in an inline `<script>` on the page that needs it. No frameworks, modules or build.
- Accessibility: meaningful `alt` (`alt=""` on decorative emblems), `width`/`height` on images, labelled controls,
  `aria-label` on nav and on links without text. Leave the existing `:focus-visible` and `prefers-reduced-motion`
  rules in place.

## Hard rules (docs/DECISIONS.md)

1. **No third-party resources (D4).** No external fonts, CDN scripts or styles, analytics, trackers, cookies or
   embeds. All images are served from `site/assets/`. The only exception is the summit form's POST to FormSubmit.
   Ask before adding another.
2. **No backend (D1, D2).** If a feature needs a server, storage or logins, stop and raise it. Don't add one.
3. **Only verified facts (D6).** Never invent biography details, degrees, roles, photos, speaker or partner names,
   venues, dates, prices or performance figures. Name speakers only after they confirm. Write "to be announced"
   for anything not yet known.
4. **Content model (D5).** ML Wildfire Detection runs on the Technology Stack, which the Digital Twin models.
   New copy and diagrams keep that relationship.
5. **Hands off** `site/CNAME` (custom domain), `site/.nojekyll`, the Pages settings and the DNS records. The MX and
   TXT records carry Google Workspace email (see docs/DEPLOYMENT.md).

## Forms

- `contact.html` builds a `mailto:` in the visitor's own email app. Nothing is sent or stored.
- `summit-2027.html` has `<dialog id="register-dialog">`, which POSTs JSON to
  `https://formsubmit.co/ajax/shahin.vakilinia@archangx.com`.
  - Any `[data-open-register]` element opens it. The `#register` hash opens it on load. Browsers without
    `showModal` fall back to `mailto:`.
  - Client-side checks: required fields, a regex of personal email domains, the LinkedIn URL shape, at least one
    day, and a hidden `_honey` honeypot.
  - To add a field, add the input **and** its key in the JSON body of the submit handler.
  - **Submitting the form sends a real email to Shahin.** Don't send test registrations without asking.
  - The FormSubmit activation is tied to that address. A new address needs a new activation (FormSubmit sends a
    confirmation email on the first submission).
- The address appears in mailto links, the form script and the fallbacks. Search `site/` for `@archangx.com` when
  you change it.

## Adding a page

1. Copy the closest page and update the `<title>`, description, `og:*`, canonical, crumbs and content.
2. Add the page to the header and footer nav on **every** page. Only its own header link gets `aria-current="page"`.
3. Update the page table in `README.md` and the site map in `docs/ARCHITECTURE.md`.
4. Run the checker and the nav drift check.

## What the checker misses

It does not check anchors on other pages (`summit-2027.html#register` passes even if `id="register"` is gone),
external URLs, single-quoted attributes, or header and footer drift. Check those by hand when you touch them.

## Writing style

- Plain, short, concrete sentences.
- The British/Canadian spelling already on the site: centre, programme, colour, catalogue. "Space Data Center" is
  a programme name and keeps its spelling.
- En dash for ranges (`21–22 June 2027`), em dash in `<title>`, `·` as a separator.
- "ArchangX" in prose. "ARCHANGX" appears only in the header wordmark. "ArchAngX Corp." is the legal name in the footer.
- Files are LF (`.gitattributes`); PNGs are binary.
