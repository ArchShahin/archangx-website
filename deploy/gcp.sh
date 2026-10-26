#!/usr/bin/env bash
# Deploy the pipeline to GKE Autopilot. Safe to re-run: every step skips what already exists.
#
#   PROJECT=agile-airship-512819-u5 HOST=pipeline.archangx.com ./deploy/gcp.sh
#
# Needs: gcloud (logged in: `gcloud auth login`), kubectl, billing enabled on the project.
# Costs money while it runs (an Autopilot cluster + a load balancer); see README "Costs" and "Tear down".
set -euo pipefail
PROJECT="${PROJECT:?set PROJECT}"
REGION="${REGION:-northamerica-northeast1}"     # Montreal
CLUSTER="${CLUSTER:-pipeline}"
HOST="${HOST:?set HOST, e.g. pipeline.archangx.com}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M)}"
REPO=pipeline
IMAGE_PREFIX="$REGION-docker.pkg.dev/$PROJECT/$REPO"
cd "$(dirname "$0")/.."
gcloud config set project "$PROJECT" >/dev/null

echo "== 1/7 enable APIs"
gcloud services enable container.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com compute.googleapis.com

echo "== 2/7 image registry"
gcloud artifacts repositories describe "$REPO" --location "$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION"

echo "== 3/7 GKE Autopilot cluster (first time: ~10 min)"
gcloud container clusters describe "$CLUSTER" --region "$REGION" >/dev/null 2>&1 || \
  gcloud container clusters create-auto "$CLUSTER" --region "$REGION"
gcloud container clusters get-credentials "$CLUSTER" --region "$REGION"

echo "== 4/7 build the six images in Cloud Build (tag $TAG)"
gcloud builds submit --config deploy/cloudbuild.yaml --substitutions "_IMAGE_PREFIX=$IMAGE_PREFIX,_TAG=$TAG" .

echo "== 5/7 namespace and database password (random, created once, never written to disk)"
kubectl apply -f k8s/00-namespace.yaml
kubectl -n pipeline get secret pipeline-db >/dev/null 2>&1 || \
  kubectl -n pipeline create secret generic pipeline-db --from-literal=password="$(openssl rand -hex 24)"

echo "== 6/7 static IP for $HOST"
gcloud compute addresses describe pipeline-ip --global >/dev/null 2>&1 || \
  gcloud compute addresses create pipeline-ip --global
IP=$(gcloud compute addresses describe pipeline-ip --global --format 'value(address)')

echo "== 7/7 apply manifests"
for f in k8s/10-postgres.yaml k8s/20-services.yaml k8s/30-autoscaling.yaml k8s/40-ingress.yaml; do
  sed -e "s#__IMAGE_PREFIX__#$IMAGE_PREFIX#g" -e "s#__TAG__#$TAG#g" -e "s#__HOST__#$HOST#g" "$f" | kubectl apply -f -
done
kubectl -n pipeline rollout status deploy/gateway --timeout=10m

cat <<MSG

Deployed tag $TAG.
NEXT (once): at the DNS provider of ${HOST#*.}, add an A record:   $HOST  ->  $IP
Then the Google-managed certificate becomes Active (15-60 min after DNS resolves):
  kubectl -n pipeline describe managedcertificate pipeline-cert
Site: https://$HOST
MSG
