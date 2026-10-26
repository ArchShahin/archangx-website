# archangx.com

The ArchangX website: seven static pages, hosted free on GitHub Pages, published by GitHub Actions on every push.
No servers, no third-party scripts or fonts.

| Page | File |
|---|---|
| Home: how it fits together (Wildfire AI on top of the Technology Stack ⇄ Digital Twin) | `site/index.html` |
| ML Wildfire Detection | `site/wildfire.html` |
| Technology Stack of Space Data Centres | `site/technology-stack.html` |
| Digital Twin | `site/digital-twin.html` |
| Exhibitions | `site/exhibitions.html` |
| About Shahin Vakilinia | `site/about.html` |
| Contact | `site/contact.html` |

Documentation: [architecture and diagrams](docs/ARCHITECTURE.md) · [deployment, DNS and HTTPS](docs/DEPLOYMENT.md) ·
[operations: update, roll back, troubleshoot](docs/OPERATIONS.md) · [design decisions](docs/DECISIONS.md)

## Edit the site
- Text: `site/<page>.html` · styles for every page: `site/assets/style.css`
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
