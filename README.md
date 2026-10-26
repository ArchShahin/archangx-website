# archangx.com

The ArchangX website: one page, four sections (ML Wildfire Detection, Technology Stack of Space Data Centres,
Digital Twin, Exhibitions). Static files only, hosted free on GitHub Pages. No servers, no third-party scripts or fonts.

## Edit the site
- Text and styles: `site/index.html`
- Logos and icons: `site/assets/`
- Preview locally: `cd site && python -m http.server 8000`, then open http://localhost:8000
- Check links: `python tools/check_site.py`

## Publish
Commit and push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) checks the page and publishes `site/`
to GitHub Pages; the change is live on https://www.archangx.com in 1-2 minutes.

## Domain
`site/CNAME` holds `www.archangx.com`. DNS stays at Squarespace: `www` is a CNAME to `archshahin.github.io`,
and the bare `archangx.com` forwards to `https://www.archangx.com`. HTTPS is issued by GitHub automatically.

## Cost
US$0: GitHub Pages hosting is free for public repositories.

Earlier versions (microservice pipeline on GKE, Cloud Run setup) are in the git history; the pipeline is tagged `pipeline-v1`.
