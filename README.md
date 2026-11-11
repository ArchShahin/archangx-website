# archangx.com

The ArchangX website: twelve static pages, hosted free on GitHub Pages, published by GitHub Actions on every push.
No servers, no third-party scripts or fonts. Summit tickets are sold through Stripe Payment Links (plain links to
Stripe-hosted checkout; see [`stripe/README.md`](stripe/README.md)).

| Page | File |
|---|---|
| Home: how it fits together (Seraphim Guardian on top of the Technology Stack ⇄ Digital Twin) | `site/index.html` |
| Seraphim Guardian: The Eternal Watch (product family landing page) | `site/guardian.html` |
| Guardian Uriel: wildfire intelligence | `site/wildfire.html` |
| Guardian Aurora: conceptual Arctic early-warning research module | `site/guardian-aurora.html` |
| Technology Stack of Space Data Centres | `site/technology-stack.html` |
| Digital Twin | `site/digital-twin.html` |
| Exhibitions, with booth reservations for Summit 2027 | `site/exhibitions.html` |
| Seraphim Summit 2027: programme, hackathon, free registration | `site/summit-2027.html` |
| Tickets: passes sold through Stripe Payment Links (cards generated from `site/data/summit-tickets.json`) | `site/summit-tickets.html` |
| Payment received (Stripe redirects here; noindex) | `site/summit-thanks.html` |
| About (Shahin Vakilinia) | `site/about.html` |
| Contact | `site/contact.html` |

Documentation: [architecture and diagrams](docs/ARCHITECTURE.md) · [deployment, DNS and HTTPS](docs/DEPLOYMENT.md) ·
[operations: update, roll back, troubleshoot](docs/OPERATIONS.md) · [design decisions](docs/DECISIONS.md) ·
[Seraphim Guardian product family](docs/SERAPHIM_GUARDIAN.md)

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
