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
