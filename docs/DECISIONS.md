# Design decisions

Short records of the choices behind the website, so they can be revisited deliberately.

## D1. A static site, not an application (2026-10-26)

**Context.** The first version was a FastAPI microservice pipeline (gateway, five workers, PostgreSQL) on GKE
Autopilot, kept in git history under the tag `pipeline-v1`. The goal turned out to be a company website.
**Decision.** Plain HTML and CSS, no backend.
**Why.** Nothing on the site needs a server: content changes by commit, and the contact form can compose an email
in the visitor's own mail app. A cluster would cost about US$110-150 a month and need upkeep for no benefit.
**Revisit when.** The site needs logins, stored submissions or dynamic data.

## D2. GitHub Pages, not Cloud Run or GKE (2026-10-26)

**Options.** GKE Autopilot (~US$110-150/month), Cloud Run with domain mapping (~US$0 but needs a GCP project,
service accounts and Workload Identity Federation), GitHub Pages (US$0, no cloud account).
**Decision.** GitHub Pages, published by GitHub Actions.
**Why.** Lowest cost and fewest moving parts; HTTPS, CDN and deploys are built in; the code and the hosting live in
one place. Trade-off: the repository must be public on a free GitHub account, which is fine for a public website.
**Revisit when.** The site needs server-side code (Cloud Run is the next step up; the setup is in git history at
commit `0717764`).

## D3. DNS stays at Squarespace (2026-10-26)

**Decision.** Keep Squarespace as registrar and DNS host; replace only the website records.
**Why.** The domain is registered there until 2027-07-28 and Google Workspace email depends on records already in
place there. Moving DNS would add risk to email for no gain.

## D4. No third-party resources on the pages (2026-10-26)

**Decision.** No external fonts, scripts, analytics or embeds; system font stacks; images served from the repo.
**Why.** Faster pages, no tracking of visitors, nothing that can break or change outside our control.

## D5. Content mirrors the company architecture (2026-10-26)

**Decision.** ML Wildfire Detection is presented as the application on top of the Technology Stack, which the
Digital Twin models; the three pages cross-link and the home page draws the same structure.
**Why.** That is how the work is actually built: the twin and the stack are designed as a pair, and detection
depends on both.

## D6. Biography only from verified sources (2026-10-26)

**Decision.** The About page states only what Shahin's own documents show (role, programme, areas of work).
**Why.** A public biography must be accurate. Degrees, prior roles, a photo or a LinkedIn link are added when
Shahin provides them.
**Update (2026-11-08).** Shahin provided his PhD, his prior roles (NVIDIA technologies at Nutrien, Architect of
Data Systems at Invest in Canada, satellite, risk management, Ericsson, Telus, Google Cloud Platform) and his
LinkedIn URL (linkedin.com/in/vakilinia). The About page uses those plus what the public profile shows (Concordia
University 2011-2015 and thesis topic, Telesat, GCP support as a Telus vendor, ETS). Exact titles and dates for the
other roles are still to be added from Shahin.
**Update (2026-11-08, later).** Shahin added: about three years with NVIDIA edge GPUs at Nutrien, Risk Model
Architect at EQ Bank, public-sector data architect (Invest in Canada), 5G and cloud data centre automation at
Ericsson, PwC, a bachelor's and master's in electrical and computer engineering, many published papers, the Frank
Gehry dream and being a proud Canadian. No public Google Scholar profile was found, so the page links a Scholar
search and ORCID 0000-0002-6281-9543 (the ID publication databases list for his papers).

## D7. Cache busting at deploy time, not in the source (2026-11-07)

**Context.** GitHub Pages serves every file with `Cache-Control: max-age=600`, and the headers can't be changed.
After the design refresh, visitors who reloaded saw the new pages with the old cached stylesheet until they did a
hard reload.
**Decision.** The deploy workflow runs `tools/fingerprint_assets.sh`, which appends a content hash to every
`assets/...` URL (`style.css?v=3f9a1c02be`) in the published copy. Source files keep plain URLs.
**Why.** A changed file gets a new URL, so browsers fetch it at once; an unchanged file keeps its URL and stays
cached. No manual version bumps to forget, and local preview is unaffected.
**Revisit when.** The site moves to a host that allows custom cache headers, or gains a build step.

## D8. Seraphim Guardian: honest readiness, Aurora stays conceptual (2026-11-08)

**Context.** The wildfire work became a product family, Seraphim Guardian (`guardian.html`), with Guardian Uriel
(wildfire intelligence, the former ML Wildfire Detection page at the same URL) and Guardian Aurora (Arctic early
warning). Brand language and diagrams: `docs/SERAPHIM_GUARDIAN.md`.
**Decision.** Every capability on the Guardian pages carries a readiness label: Designed (written down in the
research), Prototype (running in the digital twin on synthetic data) or Research target (not yet built). Guardian
Aurora is presented only as a conceptual, non-operational research module: no target tracking, interception
guidance, launch-location estimation or engagement functionality, no realistic trajectories in the twin, synthetic
data only, and no detection-performance claims without verified evidence. The spiritual names are described as a
posture (a constant watch), never as a technological capability.
**Why.** The pages are read by agencies, operators and investors. Overstating readiness or implying an operational
defence capability would damage credibility and could carry regulatory consequences.
**Revisit when.** Flight data or an approved programme changes a label or Aurora's status; change the page and this
record together.
