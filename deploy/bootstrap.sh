#!/usr/bin/env bash
# ONE-TIME setup for automatic deploys from GitHub Actions. Run it in Cloud Shell as the project owner:
#
#   git clone https://github.com/<owner>/<repo>.git && cd <repo>
#   GITHUB_REPO=<owner>/<repo> HOST=www.archangx.com bash deploy/bootstrap.sh
#
# It creates what every deploy reuses (APIs, image registry, Autopilot cluster, static IP, database
# password) and lets ONLY that GitHub repository deploy, without any stored key: GitHub's short-lived
# OIDC token is exchanged for a deploy-only service account (Workload Identity Federation).
# Safe to re-run: each step skips what already exists.
set -euo pipefail
PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
GITHUB_REPO="${GITHUB_REPO:?set GITHUB_REPO=owner/repo}"
HOST="${HOST:?set HOST, e.g. www.archangx.com}"
REGION="${REGION:-northamerica-northeast1}"
CLUSTER="${CLUSTER:-pipeline}"
SA_NAME=github-deployer
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
POOL=github
NUMBER=$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')
gcloud config set project "$PROJECT" >/dev/null
cd "$(dirname "$0")/.."

echo "== 1/7 enable APIs (project $PROJECT)"
gcloud services enable container.googleapis.com artifactregistry.googleapis.com compute.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

echo "== 2/7 image registry"
gcloud artifacts repositories describe pipeline --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create pipeline --repository-format docker --location "$REGION"

echo "== 3/7 GKE Autopilot cluster (first time: about 10 min)"
gcloud container clusters describe "$CLUSTER" --region "$REGION" >/dev/null 2>&1 || \
  gcloud container clusters create-auto "$CLUSTER" --region "$REGION"
gcloud container clusters get-credentials "$CLUSTER" --region "$REGION"

echo "== 4/7 namespace and database password (random, created once, stored only in the cluster)"
kubectl apply -f k8s/00-namespace.yaml
kubectl -n pipeline get secret pipeline-db >/dev/null 2>&1 || \
  kubectl -n pipeline create secret generic pipeline-db --from-literal=password="$(openssl rand -hex 24)"

echo "== 5/7 static IP for $HOST"
gcloud compute addresses describe pipeline-ip --global >/dev/null 2>&1 || \
  gcloud compute addresses create pipeline-ip --global
IP=$(gcloud compute addresses describe pipeline-ip --global --format 'value(address)')
DNS_HOST=$([ "$(echo "$HOST" | tr -cd . | wc -c)" -le 1 ] && echo "@" || echo "${HOST%%.*}")  # @ = the bare domain

echo "== 6/7 deploy-only service account: push images, update the cluster, nothing else"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" --display-name "GitHub Actions deployer"
for role in roles/artifactregistry.writer roles/container.developer; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$role" \
    --condition None --quiet >/dev/null
done

echo "== 7/7 trust GitHub, but only the repository $GITHUB_REPO"
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe github --location global --workload-identity-pool "$POOL" \
  >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc github --location global --workload-identity-pool "$POOL" \
    --issuer-uri https://token.actions.githubusercontent.com \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$GITHUB_REPO'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --role roles/iam.workloadIdentityUser --quiet \
  --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null

cat <<MSG

Done. In GitHub: $GITHUB_REPO -> Settings -> Secrets and variables -> Actions -> Variables tab -> New repository variable:
  GCP_PROJECT       $PROJECT
  GCP_WIF_PROVIDER  projects/$NUMBER/locations/global/workloadIdentityPools/$POOL/providers/github
  GCP_SA_EMAIL      $SA
  HOST              $HOST
(They are identifiers, not secrets.) Then every push to main deploys; or run it now from the Actions tab.

DNS (once), at Squarespace -> Domains -> archangx.com -> DNS settings:
  host $DNS_HOST : type A -> $IP     (replace any existing CNAME/A for that host)
HTTPS turns on 15-60 min after the name resolves:  kubectl -n pipeline describe managedcertificate pipeline-cert
MSG
