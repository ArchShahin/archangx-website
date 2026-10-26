"""The extractor service: consumes the previous stage's jobs, runs common.stages.extractor, hands them on."""
from common.stages import extractor
from common.worker import run

if __name__ == "__main__":
    run("extractor", extractor)
