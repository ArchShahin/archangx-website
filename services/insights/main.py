"""The insights service: consumes the previous stage's jobs, runs common.stages.insights, hands them on."""
from common.stages import insights
from common.worker import run

if __name__ == "__main__":
    run("insights", insights)
