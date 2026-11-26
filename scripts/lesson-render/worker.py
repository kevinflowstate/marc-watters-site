"""Execute one portal-issued render. Only the job's private signed slots are available."""
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
from render_lesson import probe, sha256, validate_plan

def put(url, data, size, mime):
    request = urllib.request.Request(url, data=data, method="PUT", headers={
        "Content-Type": mime, "Content-Length": str(size), "x-upsert": "false",
    })
    with urllib.request.urlopen(request, timeout=300) as response:
        if response.status not in (200, 201):
            raise ValueError("Storage did not accept the full upload")

def decode(path):
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-xerror", "-i", str(path),
                    "-map", "0:v", "-map", "0:a", "-f", "null", "-"], check=True)

def main():
    os.umask(0o077)
    job = json.loads(Path("job.json").read_text())
    stage = "source download"
    try:
        source = Path("source.mp4")
        with urllib.request.urlopen(job["video"], timeout=120) as src, source.open("xb") as out:
            while chunk := src.read(1024 * 1024):
                out.write(chunk)
                if out.tell() > job["bytes"]:
                    raise ValueError("Source exceeded declared size")
        if source.stat().st_size != job["bytes"]:
            raise ValueError("Source byte count differs from Fathom")
        stage = "source decode and transcript alignment"
        duration, streams = probe(source)
        if streams != {"video", "audio"} or not 0 < job["transcript_end_s"] <= duration + 3:
            raise ValueError("Source duration does not cover the transcript")
        decode(source)
        stage = "edit plan and render"
        ranges = [[a, duration if b is None else b] for a, b in job["keep_ranges"]]
        plan = {"schema_version": 1, "source_id": str(job["recording_id"]), "source_sha256": sha256(source),
                "source_duration_seconds": duration, "keep_ranges": ranges}
        validate_plan(plan, duration)
        target = source
        if duration - sum(b - a for a, b in ranges) >= 180:
            Path("plan.json").write_text(json.dumps(plan))
            target = Path("edit.mp4")
            subprocess.run([sys.executable, "render_lesson.py", "--source", str(source),
                            "--plan", "plan.json", "--output", str(target)], check=True)
            stage = "edited video decode"
            decode(target)
        if target.stat().st_size > 4 * 1024 ** 3:
            raise ValueError("Edit exceeds portal size limit")
        result = {"ok": True, "recording_id": job["recording_id"], "bytes": target.stat().st_size,
                  "sha256": sha256(target), "duration_s": probe(target)[0], "original_s": duration}
        stage = "private media upload"
        with target.open("rb") as data:
            put(job["upload"], data, result["bytes"], "video/mp4")
    except Exception as error:
        # URLs and request data must never enter a receipt or provider log.
        result = {"ok": False, "stage": stage, "error": type(error).__name__}
    receipt = json.dumps(result).encode()
    put(job["receipt_url"], receipt, len(receipt), "application/json")
    if not result["ok"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
