"""The profiler service: consumes the previous stage's jobs, runs common.stages.profiler, hands them on."""
from common.stages import profiler
from common.worker import run

if __name__ == "__main__":
    run("profiler", profiler)
