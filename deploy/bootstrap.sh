#!/usr/bin/env bash
# ONE-TIME setup so every push to GitHub deploys the website to Cloud Run.
#
#   PROJECT=<gcp-project-id> GITHUB_REPO=<owner>/<repo> bash deploy/bootstrap.sh
#
# Creates: the APIs, an image registry (keeps only the 5 newest images), a runtime account with no
# permissions, and a deploy-only account that ONLY the given GitHub repository can use, through
# Workload Identity Federation (no key file anywhere). Safe to re-run.
set -euo pipefail
PROJECT="${PROJECT:?set PROJECT}"
GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO=owner/repo}"
REGION=us-east1
DEPLOYER="github-deployer@$PROJECT.iam.gserviceaccount.com"
RUNTIME="site-runtime@$PROJECT.iam.gserviceaccount.com"
POOL=github
gcloud config set project "$PROJECT" >/dev/null
NUMBER=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')

echo "== 1/5 APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

echo "== 2/5 image registry (cleanup: keep the 5 newest images)"
gcloud artifacts repositories describe site --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create site --repository-format docker --location "$REGION"
cat > /tmp/cleanup.json <<'JSON'
[{"name": "keep-5-newest", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 5}},
 {"name": "delete-older", "action": {"type": "Delete"}, "condition": {"tagState": "any", "olderThan": "1d"}}]
JSON
gcloud artifacts repositories set-cleanup-policies site --location "$REGION" --policy /tmp/cleanup.json --no-dry-run --quiet >/dev/null

echo "== 3/5 service accounts"
gcloud iam service-accounts describe "$RUNTIME" >/dev/null 2>&1 || \
  gcloud iam service-accounts create site-runtime --display-name "Website runtime (no permissions)"
gcloud iam service-accounts describe "$DEPLOYER" >/dev/null 2>&1 || \
  gcloud iam service-accounts create github-deployer --display-name "GitHub Actions deployer"

echo "== 4/5 deployer may: push images, deploy the Cloud Run service, run it as the runtime account"
gcloud artifacts repositories add-iam-policy-binding site --location "$REGION" \
  --member "serviceAccount:$DEPLOYER" --role roles/artifactregistry.writer --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$DEPLOYER" \
  --role roles/run.admin --condition None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME" --member "serviceAccount:$DEPLOYER" \
  --role roles/iam.serviceAccountUser --quiet >/dev/null

echo "== 5/5 trust GitHub, only for $GITHUB_REPO"
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe github --location global --workload-identity-pool "$POOL" \
  >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --location global --workload-identity-pool "$POOL" \
    --issuer-uri https://token.actions.githubusercontent.com \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition "assertion.repository == '$GITHUB_REPO'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER" --role roles/iam.workloadIdentityUser --quiet \
  --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null

cat <<MSG

Done. GitHub repository variables (identifiers, not secrets):
  GCP_PROJECT       $PROJECT
  GCP_WIF_PROVIDER  projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/providers/github
  GCP_SA_EMAIL      $DEPLOYER
MSG
