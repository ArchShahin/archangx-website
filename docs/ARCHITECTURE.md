# ArchangX website: architecture

**What it is.** www.archangx.com is a static website of eight pages, published by GitHub Actions to GitHub
Pages and served over HTTPS through GitHub's CDN. DNS stays with Squarespace (the domain registrar).
There is no server, no database, and no third-party script, font or tracker.

## 1. Request path: a visitor opens the site

```mermaid
flowchart LR
  V[Visitor's browser] -->|1. look up www.archangx.com| DNS[Squarespace DNS<br/>nsb1-4.squarespacedns.com]
  DNS -->|CNAME archshahin.github.io| GH[(GitHub Pages CDN<br/>185.199.108-111.153)]
  V -->|2. HTTPS request<br/>Let's Encrypt certificate| GH
  GH -->|3. static files:<br/>HTML, CSS, images| V
  B[archangx.com<br/>bare domain] -.->|A records to GitHub,<br/>301 redirect| GH
```

| Name | DNS record (Squarespace) | Result |
|---|---|---|
| `www.archangx.com` | `CNAME archshahin.github.io` | serves the site |
| `archangx.com` | `A 185.199.108.153`, `.109.153`, `.110.153`, `.111.153` | GitHub redirects to `https://www.archangx.com` |
| `@` MX / TXT | Google Workspace (`smtp.google.com`, SPF, DKIM) | email, unaffected by the website |

## 2. Publishing path: a change goes live

```mermaid
flowchart LR
  E[Edit site/*.html<br/>or site/assets/] --> C[git commit + push<br/>to main]
  C --> A[GitHub Actions<br/>.github/workflows/deploy.yml]
  A --> T{tools/check_site.py<br/>every link and file exists?}
  T -- no --> X[Run fails,<br/>live site unchanged]
  T -- yes --> F[tools/fingerprint_assets.sh<br/>assets/x.css → assets/x.css?v=hash]
  F --> U[Upload site/ as the<br/>Pages artifact]
  U --> D[deploy-pages:<br/>new version live in 1-2 min]
```

The check runs before every publish, so a broken link or a missing image stops the deploy instead of reaching
visitors. Concurrency is `cancel-in-progress`: if two pushes land close together, only the newest is published.

**Caching.** GitHub Pages serves every file with `Cache-Control: max-age=600`, which we cannot change. Without help,
a reload after a deploy shows the new HTML with the browser's cached old stylesheet. The fingerprint step adds a
content hash to every `assets/...` URL in the published copy, so a changed file gets a new URL and is fetched at
once. HTML itself can still be served from a visitor's cache for up to 10 minutes; a normal reload fetches the new
page. Nobody needs to clear their cache. The source files keep plain URLs (see [DECISIONS.md](DECISIONS.md), D7).

## 2b. Ticket sales path: a visitor buys a pass

```mermaid
flowchart LR
  C[stripe/catalogue.json<br/>names, prices, capacity] -->|node scripts/stripe/sync-catalogue.mjs<br/>STRIPE_API_KEY in the shell only| S[(Stripe: Products,<br/>Prices, Payment Links)]
  S -->|public URLs| J[site/data/summit-tickets.json]
  J -->|python tools/render_tickets.py| P[summit-tickets.html<br/>exhibitions.html#exhibit]
  V[Visitor] -->|Buy ticket: plain link| B[buy.stripe.com<br/>Stripe-hosted checkout]
  B -->|receipt email| V
  B -->|redirect| T[summit-thanks.html]
  S -->|node scripts/stripe/export-attendees.mjs| X[exports/attendees.csv<br/>git-ignored]
```

No code runs on our side at purchase time: the page links out, Stripe collects the payment, and the visitor is sent
back to the thank-you page. CI fails the deploy if the rendered cards no longer match `site/data/summit-tickets.json`
(see [DECISIONS.md](DECISIONS.md), D9, and [`stripe/README.md`](../stripe/README.md)).

## 3. Site map

```mermaid
flowchart TB
  H[index.html<br/>Home: how it fits together] --> G[guardian.html<br/>Seraphim Guardian]
  G --> W[wildfire.html<br/>Guardian Uriel]
  G --> AU[guardian-aurora.html<br/>Guardian Aurora]
  H --> S[technology-stack.html<br/>Technology Stack]
  H --> T[digital-twin.html<br/>Digital Twin]
  H --> X[exhibitions.html<br/>Exhibitions]
  H --> AB[about.html<br/>About]
  H --> CO[contact.html<br/>Contact]
  G <-->|runs on| S
  S <-->|modelled by| T
  T -->|protects the mission of| W
  AU --> T
  X --> SU[summit-2027.html<br/>Seraphim Summit 2027]
  SU --> TK[summit-tickets.html<br/>Tickets]
  TK -.->|Stripe checkout| TH[summit-thanks.html]
  X --> CO
  AB --> CO
```

The content model mirrors the company's own architecture: **Seraphim Guardian (Guardian Uriel) is the product on top**,
running on the **Technology Stack**, which the **Digital Twin** models. Those three pages cross-link through a
"Connected" strip, and the home page draws the same structure.

## 4. Repository layout

```
site/                      everything that is published
  index.html ... contact.html   the eight pages (plain HTML, shared header, nav and footer)
  assets/style.css         one stylesheet for all pages (brand palette and components)
  assets/logo.png          full logo, light backgrounds      (from Logo/Files/logo, 900 px)
  assets/logo-dark.png     full logo with white wordmark, dark backgrounds
  assets/emblem*.png       wings-and-flame emblem (section marks, header, watermarks)
  assets/favicon.ico, apple-touch-icon.png
  assets/sdc-io-*.jpg      SDC-IO architecture diagrams (Exhibitions slideshow)
  data/summit-tickets.json prices, status and Payment Link URLs (generated by the Stripe sync, committed)
  sitemap.xml, robots.txt  for search engines (the thank-you page is noindex)
  CNAME                    www.archangx.com (tells GitHub Pages the custom domain)
  .nojekyll                serve files as-is, no Jekyll processing
stripe/catalogue.json      what is sold (edited by hand); stripe/README.md explains the workflow
scripts/stripe/*.mjs       Stripe sync and attendee export (Node 18+, no packages, key from STRIPE_API_KEY)
tools/render_tickets.py    writes the ticket cards into the pages from site/data/summit-tickets.json
tools/check_site.py        link and file checker, run locally and in CI
tools/fingerprint_assets.sh   cache busting: adds ?v=<hash> to asset URLs, CI only
.github/workflows/deploy.yml   the publish pipeline
docs/                      this documentation
```

## 5. Components and their responsibilities

| Component | Responsibility | Owner / where to change it |
|---|---|---|
| Pages (`site/*.html`) | Content of each page | edit the HTML, push |
| Stylesheet (`site/assets/style.css`) | Look and layout of every page | edit, push |
| Contact form (`contact.html`) | Composes an email in the visitor's own mail app (`mailto:`); nothing is sent or stored by the site | inline script on the page |
| Link checker (`tools/check_site.py`) | Blocks a deploy with a broken link or missing file | Python, no dependencies |
| Asset fingerprinting (`tools/fingerprint_assets.sh`) | Gives changed CSS and images new URLs, so browsers never show stale styles | Bash, runs in CI only |
| GitHub Actions workflow | Check, package and publish on every push to `main` | `.github/workflows/deploy.yml` |
| GitHub Pages | Hosting, CDN, HTTPS certificate (Let's Encrypt), bare-domain redirect | repo Settings → Pages |
| Squarespace DNS | Points the domain at GitHub; keeps the Google Workspace email records | Squarespace → Domains → archangx.com → DNS |

## 6. Security and privacy

- No server-side code, database or user accounts: nothing to breach or patch on our side.
- No cookies, analytics, trackers, external fonts or scripts: no third party sees the visitors.
- The contact form never transmits data; it opens the visitor's own email app with a pre-filled message.
- Exception: the Seraphim Summit registration form (`summit-2027.html`) posts the registrant's details to
  FormSubmit (formsubmit.co), which emails them to shahin.vakilinia@archangx.com. Nothing is stored by the site;
  personal email domains are refused in the browser. The address was activated once via FormSubmit's confirmation email.
- HTTPS everywhere: Let's Encrypt certificate for `www.archangx.com` and `archangx.com`, renewed by GitHub;
  "Enforce HTTPS" is on, so `http://` redirects to `https://`.
- The domain is verified on the ArchShahin account, so no other GitHub account can publish under it.
- Publishing requires push access to `ArchShahin/archangx-website`; the workflow has only the `pages: write`
  and `id-token: write` permissions it needs.

## 7. Cost

US$0. GitHub Pages hosting, the CDN and the certificate are free for a public repository; the domain
registration (Squarespace, renews 2027-07-28) is the only cost.

See also: [DEPLOYMENT.md](DEPLOYMENT.md) (DNS, HTTPS, first-time setup), [OPERATIONS.md](OPERATIONS.md)
(updating content, troubleshooting, rollback), [DECISIONS.md](DECISIONS.md) (why this design).
