"""The collector service: consumes the previous stage's jobs, runs common.stages.collector, hands them on."""
from common.stages import collector
from common.worker import run

if __name__ == "__main__":
    run("collector", collector)
