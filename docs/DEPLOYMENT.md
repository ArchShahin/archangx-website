# Deployment: how www.archangx.com is set up

Everything below has been done once; this page records it so it can be checked or rebuilt.

## 1. GitHub repository and Pages

| Setting | Value |
|---|---|
| Repository | https://github.com/ArchangX/archangx-website (public; Pages is free for public repos). Owned by the **ArchangX organization** since 2026-11-08; it was `ArchShahin/archangx-website` before, and GitHub redirects the old URL. |
| Pages source | **GitHub Actions** (Settings → Pages → Build and deployment) |
| Custom domain | `www.archangx.com` (also in `site/CNAME`) |
| Enforce HTTPS | on (certificate issued 2026-10-27) |
| Workflow | `.github/workflows/deploy.yml`, runs on every push to `main` and on demand (Actions → deploy → Run workflow) |

## 2. DNS at Squarespace

Squarespace → Domains → archangx.com → DNS → DNS Settings.

1. The **Squarespace Defaults** preset (A records to 198.185.159.x / 198.49.23.x, `www` CNAME to
   `ext-sq.squarespace.com`, and an `HTTPS` record) was **deleted**; it pointed at the expired Squarespace site.
2. **Custom records** now hold:

| Type | Name | Data | Purpose |
|---|---|---|---|
| CNAME | `www` | `archangx.github.io` | the website |
| A | `@` | `185.199.108.153` | bare domain → GitHub Pages |
| A | `@` | `185.199.109.153` | 〃 |
| A | `@` | `185.199.110.153` | 〃 |
| A | `@` | `185.199.111.153` | 〃 |
| MX | `@` | `smtp.google.com` (priority 1) | Google Workspace email, **do not remove** |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | email sender policy, **do not remove** |
| TXT | `google._domainkey` | `v=DKIM1; ...` | email signing, **do not remove** |
| TXT | `_github-pages-challenge-ArchangX` | verification code from GitHub (organization settings) | proves the domain is ours on GitHub, **do not remove** |
| TXT | `_github-pages-challenge-ArchShahin` | the old personal-account verification code | harmless; can be deleted once the organization's verification is complete |

The `www` CNAME must name the **owner** of the repository: `archangx.github.io` for the organization. The old
`archshahin.github.io` value stops working after a transfer.

The **Squarespace Domain Connect** preset (`_domainconnect`) can stay; it does not affect the site.

## 3. HTTPS certificate

GitHub Pages requests a Let's Encrypt certificate for `www.archangx.com` and `archangx.com` after DNS points to
GitHub. Usually 15-60 minutes.

**What happened on first setup (2026-10-26/27).** The certificate stayed at "authorization created" for about
18 hours. First the old Squarespace A records (4-hour TTL) were still cached; after they expired, the request
stayed stuck even though the Pages health check showed both domains valid and `is_https_eligible: true`.
What got it issued: verify the domain at **account** level (then github.com/settings/pages, now the organization's
Settings → Pages → Verified domains → Add a domain → TXT record `_github-pages-challenge-<owner>` in Squarespace →
Verify), then remove and re-add the custom domain once. The certificate was approved within a few hours of that re-add (issued 2026-10-27, expires 2027-01-25;
GitHub renews it automatically). Keep the verification TXT record: it also stops anyone else claiming the domain.
Lessons: verify the domain before pointing DNS at GitHub, and lower the TTL a few hours before changing records.
Don't remove and re-add repeatedly; each reset restarts the wait and can hit Let's Encrypt rate limits.

Check the state:
```bash
gh api repos/ArchangX/archangx-website/pages --jq '{cert: .https_certificate.state, https_enforced}'
```
`approved` (or `issued`) is done; then enable **Enforce HTTPS** (Settings → Pages, or
`gh api -X PUT repos/ArchangX/archangx-website/pages -F https_enforced=true`).

## 4. Rebuilding from scratch

1. Create a public repo, push this project, Settings → Pages → Source: GitHub Actions.
2. Set the custom domain `www.archangx.com`.
3. Apply the DNS records in section 2.
4. Push (or run the workflow), wait for the certificate, enable Enforce HTTPS.

## 5. Transferring the repository to another owner (done 2026-11-08, ArchShahin → ArchangX organization)

A transfer keeps the code, branches and Actions history but **resets GitHub Pages**: the source falls back to
"Deploy from a branch" (`main`, root), the custom domain is dropped, and GitHub's own Jekyll job publishes the
repository root (the README became the home page at `archangx.github.io/archangx-website/`). Meanwhile
`www.archangx.com` answers GitHub's 404 "Site not found" and the `deploy` workflow still runs green but feeds nothing.
A domain verified on the old owner also blocks the new owner from claiming it. To recover, in this order:

1. **Move the domain verification.** Old owner: github.com/settings/pages → Verified domains → remove
   `archangx.com`. New owner: organization Settings → Pages → Verified domains → Add `archangx.com`, create the
   TXT record `_github-pages-challenge-ArchangX` it shows in Squarespace, Verify.
2. **DNS.** Squarespace → change the `www` CNAME data to `archangx.github.io`. The A, MX and TXT records stay.
3. **Repository Settings → Pages.** Build and deployment → Source: **GitHub Actions**. Custom domain:
   `www.archangx.com` → Save (wait for the DNS check to pass). Tick **Enforce HTTPS** once the certificate is issued.
4. **Redeploy.** Actions → deploy → Run workflow (or push to `main`). The run must end in "Deploy to GitHub Pages"
   from `actions/deploy-pages`, not in a "pages build and deployment" run.
5. Update the `origin` URL on every clone: `git remote set-url origin https://github.com/ArchangX/archangx-website.git`.

## 6. Verification

```bash
nslookup -type=CNAME www.archangx.com nsb1.squarespacedns.com    # -> archangx.github.io
curl -sI https://www.archangx.com | head -1                       # -> HTTP/2 200
curl -sI http://archangx.com | grep -i location                   # -> https://www.archangx.com/
python tools/check_site.py                                        # -> 0 problems
```
