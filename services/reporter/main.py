"""The reporter service: consumes the previous stage's jobs, runs common.stages.reporter, hands them on."""
from common.stages import reporter
from common.worker import run

if __name__ == "__main__":
    run("reporter", reporter)
