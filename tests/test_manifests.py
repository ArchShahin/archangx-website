import glob

import yaml


def test_every_manifest_parses_and_names_its_kind():
    kinds = []
    for f in sorted(glob.glob("k8s/*.yaml")) + ["deploy/cloudbuild.yaml"]:
        for doc in yaml.safe_load_all(open(f, encoding="utf-8")):
            if doc and "kind" in doc:
                kinds.append(doc["kind"])
    for needed in ("Namespace", "StatefulSet", "Deployment", "HorizontalPodAutoscaler", "Ingress", "ManagedCertificate"):
        assert needed in kinds, needed
    assert kinds.count("Deployment") == 6
