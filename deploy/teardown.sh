#!/usr/bin/env bash
# Delete everything deploy/gcp.sh created (stops the cost). The database data is lost.
set -euo pipefail
PROJECT="${PROJECT:?set PROJECT}"; REGION="${REGION:-northamerica-northeast1}"; CLUSTER="${CLUSTER:-pipeline}"
gcloud config set project "$PROJECT" >/dev/null
gcloud container clusters delete "$CLUSTER" --region "$REGION" --quiet || true
gcloud compute addresses delete pipeline-ip --global --quiet || true
gcloud artifacts repositories delete pipeline --location "$REGION" --quiet || true
