# Deployment: how www.archangx.com is set up

Everything below has been done once; this page records it so it can be checked or rebuilt.

## 1. GitHub repository and Pages

| Setting | Value |
|---|---|
| Repository | https://github.com/ArchShahin/archangx-website (public; Pages is free for public repos) |
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
| CNAME | `www` | `archshahin.github.io` | the website |
| A | `@` | `185.199.108.153` | bare domain → GitHub Pages |
| A | `@` | `185.199.109.153` | 〃 |
| A | `@` | `185.199.110.153` | 〃 |
| A | `@` | `185.199.111.153` | 〃 |
| MX | `@` | `smtp.google.com` (priority 1) | Google Workspace email, **do not remove** |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | email sender policy, **do not remove** |
| TXT | `google._domainkey` | `v=DKIM1; ...` | email signing, **do not remove** |
| TXT | `_github-pages-challenge-ArchShahin` | verification code from GitHub | proves the domain is ours on GitHub, **do not remove** |

The **Squarespace Domain Connect** preset (`_domainconnect`) can stay; it does not affect the site.

## 3. HTTPS certificate

GitHub Pages requests a Let's Encrypt certificate for `www.archangx.com` and `archangx.com` after DNS points to
GitHub. Usually 15-60 minutes.

**What happened on first setup (2026-10-26/27).** The certificate stayed at "authorization created" for about
18 hours. First the old Squarespace A records (4-hour TTL) were still cached; after they expired, the request
stayed stuck even though the Pages health check showed both domains valid and `is_https_eligible: true`.
What got it issued: verify the domain at **account** level (github.com/settings/pages → Add a domain → TXT
record `_github-pages-challenge-ArchShahin` in Squarespace → Verify), then remove and re-add the custom domain
once. The certificate was approved within a few hours of that re-add (issued 2026-10-27, expires 2027-01-25;
GitHub renews it automatically). Keep the verification TXT record: it also stops anyone else claiming the domain.
Lessons: verify the domain before pointing DNS at GitHub, and lower the TTL a few hours before changing records.
Don't remove and re-add repeatedly; each reset restarts the wait and can hit Let's Encrypt rate limits.

Check the state:
```bash
gh api repos/ArchShahin/archangx-website/pages --jq '{cert: .https_certificate.state, https_enforced}'
```
`approved` (or `issued`) is done; then enable **Enforce HTTPS** (Settings → Pages, or
`gh api -X PUT repos/ArchShahin/archangx-website/pages -F https_enforced=true`).

## 4. Rebuilding from scratch

1. Create a public repo, push this project, Settings → Pages → Source: GitHub Actions.
2. Set the custom domain `www.archangx.com`.
3. Apply the DNS records in section 2.
4. Push (or run the workflow), wait for the certificate, enable Enforce HTTPS.

## 5. Verification

```bash
nslookup -type=CNAME www.archangx.com nsb1.squarespacedns.com    # -> archshahin.github.io
curl -sI https://www.archangx.com | head -1                       # -> HTTP/2 200
curl -sI http://archangx.com | grep -i location                   # -> https://www.archangx.com/
python tools/check_site.py                                        # -> 0 problems
```
