"""Shared job store. PostgreSQL in the cluster, SQLite for local runs and tests.

The jobs table is also the queue: each worker claims the oldest job in its input
status with one conditional UPDATE, so two replicas can never take the same job
(the loser's UPDATE matches no row). No broker, no external service.
"""
import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import (Column, DateTime, MetaData, String, Table, Text, create_engine, func, insert,
                        select, update)

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./pipeline.db")

metadata = MetaData()
jobs = Table(
    "jobs", metadata,
    Column("id", String(36), primary_key=True),
    Column("input", Text, nullable=False),
    Column("status", String(32), nullable=False, index=True),
    Column("results", Text, nullable=False, default="{}"),   # stage name -> output (JSON)
    Column("timings", Text, nullable=False, default="{}"),   # stage name -> seconds (JSON)
    Column("error", Text),
    Column("worker", String(128)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("updated_at", DateTime(timezone=True), nullable=False),
)

_engine = None


def engine():
    global _engine
    if _engine is None:
        kw = {"connect_args": {"check_same_thread": False}} if DATABASE_URL.startswith("sqlite") else \
             {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5}
        _engine = create_engine(DATABASE_URL, **kw)
        metadata.create_all(_engine)
    return _engine


def now():
    return datetime.now(timezone.utc)


def row_to_dict(row):
    d = dict(row._mapping)
    d["results"] = json.loads(d["results"] or "{}")
    d["timings"] = json.loads(d["timings"] or "{}")
    for k in ("created_at", "updated_at"):
        if d.get(k) is not None:
            d[k] = d[k].isoformat()
    return d


def create_job(text):
    job_id = str(uuid.uuid4())
    with engine().begin() as c:
        c.execute(insert(jobs).values(id=job_id, input=text, status="queued", results="{}", timings="{}",
                                      created_at=now(), updated_at=now()))
    return job_id


def get_job(job_id):
    with engine().connect() as c:
        row = c.execute(select(jobs).where(jobs.c.id == job_id)).first()
    return row_to_dict(row) if row else None


def list_jobs(limit=50):
    with engine().connect() as c:
        rows = c.execute(select(jobs).order_by(jobs.c.created_at.desc()).limit(limit)).all()
    return [row_to_dict(r) for r in rows]


def status_counts():
    with engine().connect() as c:
        rows = c.execute(select(jobs.c.status, func.count()).group_by(jobs.c.status)).all()
    return {s: n for s, n in rows}


def claim(from_status, to_status, worker):
    """Atomically move the oldest job in from_status to to_status; return it, or None."""
    with engine().begin() as c:
        job_id = c.execute(select(jobs.c.id).where(jobs.c.status == from_status)
                           .order_by(jobs.c.created_at).limit(1)).scalar()
        if job_id is None:
            return None
        # The status condition makes this the claim: a replica that read the same id loses here.
        res = c.execute(update(jobs).where(jobs.c.id == job_id, jobs.c.status == from_status)
                        .values(status=to_status, worker=worker, updated_at=now()))
        if res.rowcount != 1:
            return None
    return get_job(job_id)


def finish(job_id, stage, output, seconds, next_status):
    with engine().begin() as c:
        row = c.execute(select(jobs.c.results, jobs.c.timings).where(jobs.c.id == job_id)).first()
        results, timings = json.loads(row.results or "{}"), json.loads(row.timings or "{}")
        results[stage], timings[stage] = output, round(seconds, 3)
        c.execute(update(jobs).where(jobs.c.id == job_id)
                  .values(status=next_status, results=json.dumps(results), timings=json.dumps(timings),
                          updated_at=now()))


def fail(job_id, stage, error):
    with engine().begin() as c:
        c.execute(update(jobs).where(jobs.c.id == job_id)
                  .values(status="failed", error=f"{stage}: {error}"[:2000], updated_at=now()))
