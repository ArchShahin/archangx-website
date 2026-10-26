"""Gateway: the web UI and the REST API. The only service exposed to the internet."""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from common import db
from common.worker import PIPELINE


@asynccontextmanager
async def lifespan(_app):
    db.engine()  # creates the table on first boot
    yield


app = FastAPI(title="ArchangX Pipeline", version="1.0.0", lifespan=lifespan)
STATIC = Path(__file__).parent / "static"


class JobIn(BaseModel):
    input: str = Field(min_length=1, max_length=20000)


@app.get("/healthz")
def healthz():
    db.status_counts()  # proves the database answers
    return {"ok": True}


@app.post("/api/jobs", status_code=201)
def submit(job: JobIn):
    return {"id": db.create_job(job.input)}


@app.get("/api/jobs")
def jobs(limit: int = 50):
    return db.list_jobs(min(max(limit, 1), 200))


@app.get("/api/jobs/{job_id}")
def job(job_id: str):
    found = db.get_job(job_id)
    if not found:
        raise HTTPException(404, "job not found")
    return found


@app.get("/api/stats")
def stats():
    done = [j for j in db.list_jobs(200) if j["status"] == "done"]
    avg = {s: round(sum(j["timings"].get(s, 0) for j in done) / len(done), 3) if done else None
           for s in PIPELINE}
    return {"counts": db.status_counts(), "avg_stage_seconds_last_200_done": avg, "stages": list(PIPELINE)}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")
