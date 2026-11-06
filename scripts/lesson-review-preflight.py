#!/usr/bin/env python3
"""Check a local lesson edit and prepare a private review pack; never upload or publish."""

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys

PORTAL_LIMIT_BYTES = 256 * 1024 * 1024
MAX_DURATION_SECONDS = 8 * 60 * 60


def digest(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def probe(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        check=True, capture_output=True, text=True, timeout=120,
    )
    data = json.loads(result.stdout)
    duration = float(data["format"]["duration"])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("The recording has no usable duration")
    types = {stream.get("codec_type") for stream in data["streams"]}
    if not {"video", "audio"}.issubset(types):
        raise ValueError("The recording must contain both video and audio")
    if any(sum(stream.get("codec_type") == kind for stream in data["streams"]) > 1
           for kind in ("video", "audio")):
        raise ValueError("Multiple video/audio tracks need an explicit track-preserving review")
    return duration


def keep_ranges(plan, duration):
    ranges = plan.get("keep_ranges")
    if not isinstance(ranges, list) or not 1 <= len(ranges) <= 100:
        raise ValueError("The edit plan needs 1–100 kept ranges")
    previous = 0.0
    for pair in ranges:
        if (not isinstance(pair, list) or len(pair) != 2
                or any(type(v) not in (float, int) or not math.isfinite(v) for v in pair)):
            raise ValueError("The edit plan contains an invalid time range")
        start, end = pair
        if start < previous or start < 0 or end <= start or end > duration or end - start < 0.1:
            raise ValueError("The edit plan ranges overlap or fall outside the source")
        previous = end
    return ranges


def removed_ranges(ranges, duration):
    removed = []
    previous = 0.0
    for start, end in ranges:
        if start > previous:
            removed.append([previous, start])
        previous = end
    if previous < duration:
        removed.append([previous, duration])
    return removed


def timestamp(seconds):
    seconds = round(seconds)
    hours, rest = divmod(seconds, 3600)
    minutes, seconds = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes}:{seconds:02d}"


def prepare(source, edited, plan_path, receipt_path, title, summary, workbook, decode=True):
    paths = [p.expanduser().resolve() for p in (source, edited, plan_path, receipt_path)]
    source, edited, plan_path, receipt_path = paths
    if len(set(paths)) != len(paths) or any(not p.is_file() for p in paths):
        raise ValueError("Use separate existing source, edited video, plan and receipt files")
    if edited.suffix.lower() != ".mp4":
        raise ValueError("The private preview must be an MP4 file")
    if not title.strip() or len(title) > 300:
        raise ValueError("Give the lesson a clear title")
    if not summary.strip() or not workbook.strip():
        raise ValueError("Add the source-grounded summary and draft workbook before review")
    if len(summary) > 50000 or len(workbook) > 100000:
        raise ValueError("The summary or workbook exceeds the portal handoff limit")
    plan_bytes = plan_path.read_bytes()
    plan = json.loads(plan_bytes)
    receipt = json.loads(receipt_path.read_text())
    if plan.get("schema_version") != 1 or receipt.get("schema_version") != 1:
        raise ValueError("Use the supported version 1 edit plan and render receipt")
    if receipt.get("status") != "private_preview_not_published":
        raise ValueError("The render receipt must describe a private, unpublished preview")
    source_id = plan.get("source_id")
    if not isinstance(source_id, str) or not source_id.strip() or len(source_id) > 500:
        raise ValueError("The actual source recording reference is missing")
    source_hash, edited_hash = digest(source), digest(edited)
    source_seconds, edited_seconds = probe(source), probe(edited)
    ranges = keep_ranges(plan, source_seconds)
    expected = sum(end - start for start, end in ranges)
    pairs = (
        (plan.get("source_sha256"), source_hash, "The source differs from the edit plan"),
        (receipt.get("source_sha256"), source_hash, "The source differs from the render receipt"),
        (receipt.get("output_sha256"), edited_hash, "The preview differs from the render receipt"),
        (receipt.get("plan_sha256"), hashlib.sha256(plan_bytes).hexdigest(), "The edit plan changed after rendering"),
        (receipt.get("source_id"), source_id, "The recording references do not match"),
        (receipt.get("keep_ranges"), ranges, "The rendered cut ranges do not match the edit plan"),
    )
    for actual, wanted, message in pairs:
        if actual != wanted:
            raise ValueError(message)
    numeric_checks = (
        (plan.get("source_duration_seconds"), source_seconds),
        (receipt.get("expected_duration_seconds"), expected),
        (receipt.get("actual_duration_seconds"), edited_seconds),
        (expected, edited_seconds),
    )
    for supplied, actual in numeric_checks:
        if type(supplied) not in (int, float) or not math.isfinite(supplied) or abs(supplied - actual) > 0.5:
            raise ValueError("The source, cut plan and rendered duration do not agree")
    if decode:
        subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-i", str(edited),
             "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"],
            check=True, capture_output=True, text=True, timeout=1800,
        )
    if digest(source) != source_hash or digest(edited) != edited_hash or plan_path.read_bytes() != plan_bytes:
        raise ValueError("A source, plan or preview file changed during the check")
    size = edited.stat().st_size
    portal_blockers = []
    if size > PORTAL_LIMIT_BYTES:
        portal_blockers.append("This preview is larger than the portal’s current 256 MiB limit. Keep it for private review; a larger-file handoff or an explicitly agreed smaller export is needed.")
    if edited_seconds > MAX_DURATION_SECONDS:
        portal_blockers.append("This preview exceeds the portal’s current eight-hour limit.")
    if not decode:
        portal_blockers.append("The full video and audio have not been decoded yet. Run this check without --metadata-only before handing it over.")
    removed = removed_ranges(ranges, source_seconds)
    changes = [f"- Removed {timestamp(start)}–{timestamp(end)} from the original." for start, end in removed]
    if not changes:
        changes = ["- The full source is retained. No sections were removed."]
    lines = [
        "## Lesson edit ready to check" if decode else "## Lesson file check — playback check still needed",
        f"Original: {timestamp(source_seconds)}. Edited preview: {timestamp(edited_seconds)}.",
        "", "## Changes made", *changes, "", "## Eimear’s review",
        "- Watch the opening, ending and each join. Check that the teaching and useful questions are complete.",
        "- Read the lesson summary and draft workbook.",
        "- Confirm the exact version and destination before anything is added to Training.",
        "", "## Still needed", *[f"- {item}" for item in portal_blockers],
        "- Store this exact MP4 privately and verify its bytes in the portal.",
        "- Record Eimear’s decision and the agreed Training module.",
        "", "This is a private review pack. Nothing has been uploaded, approved or published.",
    ]
    return {
        "schema_version": 1, "title": title.strip(), "source_ref": source_id,
        "status": "private_review_ready" if decode else "playback_check_needed",
        "summary_md": summary, "workbook_md": workbook, "body": "\n".join(lines),
        "source": {"filename": source.name, "sha256": source_hash, "duration_s": source_seconds},
        "media": {"filename": edited.name, "sha256": edited_hash, "bytes": size,
                  "duration_s": edited_seconds, "full_decode_passed": decode},
        "edit": {"plan_sha256": hashlib.sha256(plan_bytes).hexdigest(), "keep_ranges": ranges,
                 "removed_ranges": removed},
        "portal_file_checks_passed": not portal_blockers, "portal_blockers": portal_blockers,
        "approval": None, "publication_enabled": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "edited", "plan", "receipt", "summary", "workbook", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--title", required=True)
    parser.add_argument("--metadata-only", action="store_true", help="Faster preliminary check; cannot mark playback verified")
    args = parser.parse_args()
    output = args.output.expanduser().resolve()
    if output.exists() or output in [getattr(args, name).expanduser().resolve() for name in ("source", "edited", "plan", "receipt", "summary", "workbook")]:
        raise ValueError("Choose a new review-pack filename; existing files are never replaced")
    result = prepare(args.source, args.edited, args.plan, args.receipt, args.title,
                     args.summary.read_text(), args.workbook.read_text(), not args.metadata_only)
    output.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False)
        stream.write("\n")
    print(json.dumps({"status": result["status"], "portal_file_checks_passed": result["portal_file_checks_passed"],
                      "output": str(output), "published": False}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
        print(f"Lesson check failed: {error}", file=sys.stderr)
        sys.exit(1)
