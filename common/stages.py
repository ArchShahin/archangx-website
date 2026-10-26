"""What each stage does. Self-contained: no network calls, no third-party services.

Each stage reads the job's input and the earlier stages' outputs and returns its own
output (stored under results[stage]). WORK_MS adds deterministic CPU work per stage,
so the pipeline can be load-tested like a real one.
"""
import hashlib
import os
import re
from collections import Counter

WORK_MS = float(os.environ.get("WORK_MS", "200"))
STOPWORDS = {"the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "with", "at", "by"}


def burn(ms=None):
    """Busy-loop for about `ms` milliseconds of CPU (hashing), standing in for real work."""
    import time
    end = time.perf_counter() + (WORK_MS if ms is None else ms) / 1000
    h = b"pipeline"
    while time.perf_counter() < end:
        h = hashlib.sha256(h).digest()
    return h.hex()[:12]


def profiler(job):
    text = job["input"].strip()
    if not text:
        raise ValueError("empty input")
    words = re.findall(r"[\w'-]+", text)
    burn()
    return {"chars": len(text), "words": len(words), "lines": text.count("\n") + 1,
            "ascii_ratio": round(sum(c.isascii() for c in text) / len(text), 3)}


def collector(job):
    """Builds the 'documents' the later stages read: the sentences of the input."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", job["input"]) if s.strip()]
    docs = [{"id": i + 1, "text": s, "checksum": hashlib.md5(s.encode()).hexdigest()[:8]}
            for i, s in enumerate(sentences)]
    burn(WORK_MS * 2)  # the heaviest stage, as the collector is in the real system
    return {"documents": docs, "count": len(docs)}


def extractor(job):
    docs = job["results"]["collector"]["documents"]
    words = [w.lower() for d in docs for w in re.findall(r"[A-Za-z][\w'-]+", d["text"])]
    numbers = [float(n) for d in docs for n in re.findall(r"-?\d+(?:\.\d+)?", d["text"])]
    burn()
    return {"top_words": Counter(w for w in words if w not in STOPWORDS).most_common(5),
            "numbers": numbers[:50], "emails": sorted({m for d in docs
                                                        for m in re.findall(r"[\w.+-]+@[\w-]+\.[\w.]+", d["text"])})}


def insights(job):
    prof, ext = job["results"]["profiler"], job["results"]["extractor"]
    found = []
    if prof["words"] < 5:
        found.append({"severity": "yellow", "text": "Very short input: fewer than 5 words."})
    if ext["top_words"]:
        w, n = ext["top_words"][0]
        found.append({"severity": "green", "text": f"Main topic word: '{w}' ({n} times)."})
    if ext["numbers"]:
        found.append({"severity": "green", "text": f"{len(ext['numbers'])} numbers, total {sum(ext['numbers']):g}."})
    if ext["emails"]:
        found.append({"severity": "red", "text": f"Contains {len(ext['emails'])} email address(es)."})
    burn()
    return {"insights": found}


def reporter(job):
    r = job["results"]
    lines = [f"Report for job {job['id']}",
             f"{r['profiler']['words']} words, {r['collector']['count']} document(s).", ""]
    lines += [f"[{i['severity']}] {i['text']}" for i in r["insights"]["insights"]] or ["No insights."]
    burn(WORK_MS / 2)
    return {"summary": "\n".join(lines)}


STAGES = {"profiler": profiler, "collector": collector, "extractor": extractor,
          "insights": insights, "reporter": reporter}
