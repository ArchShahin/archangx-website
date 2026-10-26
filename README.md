# archangx.com

The ArchangX website: one page, four sections (ML Wildfire Detection, Technology Stack of Space Data Centres,
Digital Twin, Exhibitions), served by nginx on Google Cloud Run. No database, no third-party scripts or fonts.

## Edit the site
Everything visitors see is in `site/index.html` (text and styles) and `site/assets/` (logos, icons).
Preview locally: `cd site && python -m http.server 8000`, then open http://localhost:8000.
`python tools/check_site.py` checks that every linked file and in-page link exists.

## Publish
Commit and push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) checks the page, builds the container,
and deploys it to Cloud Run (`archangx-site`, region `us-east1`). Live in about 2 minutes.

GitHub signs in to Google Cloud with Workload Identity Federation: no key is stored, and only this repository can
use the deploy-only service account. One-time setup: `PROJECT=<id> GITHUB_REPO=<owner>/<repo> bash deploy/bootstrap.sh`,
then set the three repository variables it prints (`GCP_PROJECT`, `GCP_WIF_PROVIDER`, `GCP_SA_EMAIL`).

## Domain
`www.archangx.com` is mapped to the Cloud Run service (free domain mapping, no load balancer). DNS stays at
Squarespace: `www` is a CNAME to `ghs.googlehosted.com`; the bare `archangx.com` forwards to `www`.

## Cost
Cloud Run scales to zero when nobody visits (min 0, max 2 instances, 128 MiB, CPU only while serving), so a
company site normally stays inside the free tier (2 million requests a month). The registry keeps only the
5 newest images. Typical total: close to US$0 a month.

The earlier microservice pipeline is kept in git history under the tag `pipeline-v1`.
