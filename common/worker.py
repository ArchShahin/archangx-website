"""The loop every pipeline service runs: claim a job from the previous stage, process it, hand it on."""
import logging
import os
import signal
import socket
import time

from common import db

# stage -> (status it consumes, status while working, status it produces)
PIPELINE = {
    "profiler":  ("queued",    "profiling",  "profiled"),
    "collector": ("profiled",  "collecting", "collected"),
    "extractor": ("collected", "extracting", "extracted"),
    "insights":  ("extracted", "analyzing",  "analyzed"),
    "reporter":  ("analyzed",  "reporting",  "done"),
}

log = logging.getLogger("worker")
_stop = False


def _on_term(*_):
    global _stop
    _stop = True  # finish the current job, then exit (Kubernetes sends SIGTERM on scale-down)


def run(stage, process):
    """process(job: dict) -> dict (this stage's output). Raising marks the job failed."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    signal.signal(signal.SIGTERM, _on_term)
    consumes, working, produces = PIPELINE[stage]
    me = f"{stage}@{socket.gethostname()}:{os.getpid()}"
    idle = float(os.environ.get("POLL_SECONDS", "1"))
    log.info("%s started: %s -> %s", me, consumes, produces)
    while not _stop:
        job = db.claim(consumes, working, me)
        if job is None:
            time.sleep(idle)
            continue
        t0 = time.perf_counter()
        try:
            output = process(job)
        except Exception as exc:  # one bad job must not stop the service
            log.exception("job %s failed in %s", job["id"], stage)
            db.fail(job["id"], stage, repr(exc))
            continue
        seconds = time.perf_counter() - t0
        db.finish(job["id"], stage, output, seconds, produces)
        log.info("job %s %s in %.2fs", job["id"], produces, seconds)
    log.info("%s stopped", me)
