import os
import tempfile

# Before importing the app: a throwaway SQLite file and almost no simulated work.
os.environ["DATABASE_URL"] = "sqlite:///" + os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["WORK_MS"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from common import db  # noqa: E402
from common.stages import STAGES  # noqa: E402
from common.worker import PIPELINE  # noqa: E402
from services.gateway.main import app  # noqa: E402

client = TestClient(app)


def run_stage_once(stage):
    """What one worker iteration does, without the loop."""
    consumes, working, produces = PIPELINE[stage]
    job = db.claim(consumes, working, f"test-{stage}")
    assert job is not None, f"{stage} found nothing to claim"
    db.finish(job["id"], stage, STAGES[stage](job), 0.01, produces)
    return job["id"]


def test_job_goes_through_all_five_stages():
    r = client.post("/api/jobs", json={"input": "Mars base needs 4 domes. Mail lead@archangx.com today."})
    assert r.status_code == 201
    job_id = r.json()["id"]
    for stage in PIPELINE:
        assert run_stage_once(stage) == job_id
    job = client.get(f"/api/jobs/{job_id}").json()
    assert job["status"] == "done"
    assert set(job["timings"]) == set(PIPELINE)
    assert "1 email address" in job["results"]["reporter"]["summary"]
    assert job["results"]["extractor"]["numbers"] == [4.0]


def test_a_job_is_claimed_by_one_replica_only():
    job_id = db.create_job("one claim only")
    first = db.claim("queued", "profiling", "replica-a")
    second = db.claim("queued", "profiling", "replica-b")
    assert first["id"] == job_id
    assert second is None


def test_bad_input_fails_the_job_not_the_service():
    job_id = db.create_job("   ")
    job = db.claim("queued", "profiling", "test")
    try:
        STAGES["profiler"](job)
    except ValueError as exc:
        db.fail(job["id"], "profiler", repr(exc))
    assert db.get_job(job_id)["status"] == "failed"


def test_api_validation_and_health():
    assert client.post("/api/jobs", json={"input": ""}).status_code == 422
    assert client.get("/api/jobs/does-not-exist").status_code == 404
    assert client.get("/healthz").json() == {"ok": True}
    assert set(client.get("/api/stats").json()["stages"]) == set(PIPELINE)
