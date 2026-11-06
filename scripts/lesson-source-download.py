#!/usr/bin/env python3
"""Download an authorised lesson MP4 from a private signed reference; never share or edit it."""

import argparse
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

DEFAULT_MAX_BYTES = 4 * 1024 * 1024 * 1024


def checked_url(value, allowed_hosts=None):
    if not isinstance(value, str):
        raise ValueError("The source download URL is missing")
    parsed = urlsplit(value)
    if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.fragment or parsed.port not in (None, 443)):
        raise ValueError("Use an HTTPS download URL without embedded login details")
    host = parsed.hostname.lower()
    if host == "localhost" or host.endswith(".localhost"):
        raise ValueError("A local address cannot be the recording download source")
    try:
        if not ipaddress.ip_address(host).is_global:
            raise ValueError("A private address cannot be the recording download source")
    except ValueError as error:
        if str(error).startswith("A private"):
            raise
    if allowed_hosts is not None and host not in allowed_hosts:
        raise ValueError("The download redirected to an unapproved host")
    return host


class SameHostRedirects(HTTPRedirectHandler):
    def __init__(self, host):
        self.host = host

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        checked_url(newurl, {self.host})
        return super().redirect_request(request, fp, code, msg, headers, newurl)


def download(reference, source, receipt, *, max_bytes=DEFAULT_MAX_BYTES, open_source=None):
    source, receipt = source.expanduser().resolve(), receipt.expanduser().resolve()
    if source == receipt or source.exists() or receipt.exists():
        raise ValueError("Choose new source and receipt filenames; existing files are never replaced")
    if source.suffix.lower() != ".mp4":
        raise ValueError("Use an MP4 source filename")
    if not isinstance(reference, dict) or not isinstance(reference.get("source_ref"), str) or not reference["source_ref"].strip():
        raise ValueError("The actual source recording reference is required")
    host = checked_url(reference.get("url"))
    expected_bytes = reference.get("expected_bytes")
    if expected_bytes is not None and (type(expected_bytes) is not int or expected_bytes <= 0):
        raise ValueError("The supplied source size is invalid")
    if type(max_bytes) is not int or max_bytes <= 0 or expected_bytes is not None and expected_bytes > max_bytes:
        raise ValueError("The source exceeds the selected local download limit")
    expected_hash = reference.get("expected_sha256")
    if expected_hash is not None and (not isinstance(expected_hash, str) or len(expected_hash) != 64
                                      or any(c not in "0123456789abcdef" for c in expected_hash)):
        raise ValueError("Use an actual lowercase SHA-256 or omit the expected hash")
    if reference.get("expires_at"):
        expiry = datetime.fromisoformat(str(reference["expires_at"]).replace("Z", "+00:00"))
        if expiry.tzinfo is None or expiry <= datetime.now(timezone.utc):
            raise ValueError("The source download link has expired; request a fresh one")
    source.parent.mkdir(parents=True, exist_ok=True)
    receipt.parent.mkdir(parents=True, exist_ok=True)
    required_disk = (expected_bytes or max_bytes) * 3
    if shutil.disk_usage(source.parent).free < required_disk:
        raise ValueError("There is not enough free disk for the source and a conservative edit workspace")
    opener = open_source or build_opener(SameHostRedirects(host)).open
    request = Request(reference["url"], headers={"User-Agent": "CBB-Lesson-Download/1.0"})
    started = time.monotonic()
    with tempfile.TemporaryDirectory(prefix=".cbb-source-", dir=source.parent) as temp:
        candidate = Path(temp) / "recording.mp4"
        digest, total = hashlib.sha256(), 0
        with opener(request, timeout=60) as response:
            checked_url(response.geturl(), {host})
            declared = response.headers.get("Content-Length")
            if declared is not None and (not declared.isdigit() or int(declared) > max_bytes):
                raise ValueError("The recording response has an invalid or oversized file size")
            if expected_bytes is not None and declared is not None and int(declared) != expected_bytes:
                raise ValueError("The recording response size differs from its download reference")
            fd = os.open(candidate, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "wb") as stream:
                while chunk := response.read(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes or expected_bytes is not None and total > expected_bytes:
                        raise ValueError("The recording exceeded its permitted size during download")
                    if time.monotonic() - started > 1800:
                        raise ValueError("The recording download exceeded the thirty-minute local limit")
                    stream.write(chunk)
                    digest.update(chunk)
            if total <= 0 or declared is not None and total != int(declared) or expected_bytes is not None and total != expected_bytes:
                raise ValueError("The recording download was empty or incomplete")
        actual_hash = digest.hexdigest()
        if expected_hash is not None and actual_hash != expected_hash:
            raise ValueError("The source bytes do not match the supplied download hash")
        probed = subprocess.run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(candidate)],
                                check=True, capture_output=True, text=True, timeout=120)
        media = json.loads(probed.stdout)
        streams = {stream.get("codec_type") for stream in media["streams"]}
        duration = float(media["format"]["duration"])
        if not {"video", "audio"}.issubset(streams) or not 0 < duration <= 28800:
            raise ValueError("The downloaded source needs audio, video and a duration under eight hours")
        result = {"schema_version": 1, "status": "source_downloaded_not_edited", "source_ref": reference["source_ref"],
                  "source_filename": source.name, "bytes": total, "sha256": actual_hash, "duration_s": duration,
                  "downloaded_at": datetime.now(timezone.utc).isoformat(), "published": False}
        fd = os.open(receipt, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as stream:
            json.dump(result, stream, indent=2)
            stream.write("\n")
        try:
            os.link(candidate, source)
        except Exception:
            receipt.unlink()
            raise
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, type=Path, help="Private JSON containing the supported signed download URL")
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--receipt", required=True, type=Path)
    parser.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES)
    args = parser.parse_args()
    reference_path = args.reference.expanduser().resolve()
    if reference_path in (args.source.expanduser().resolve(), args.receipt.expanduser().resolve()):
        raise ValueError("The reference file must not be replaced")
    result = download(json.loads(reference_path.read_text()), args.source, args.receipt, max_bytes=args.max_bytes)
    print(json.dumps({"status": result["status"], "source": str(args.source), "bytes": result["bytes"],
                      "duration_s": result["duration_s"], "sha256": result["sha256"], "published": False}))


if __name__ == "__main__":
    try:
        main()
    except HTTPError as error:
        print(f"Source download failed: the provider returned HTTP {error.code}. No recording was saved.", file=sys.stderr)
        sys.exit(1)
    except URLError:
        print("Source download failed: the provider could not be reached securely. No recording was saved.", file=sys.stderr)
        sys.exit(1)
    except (ValueError, OSError, KeyError, subprocess.SubprocessError) as error:
        # Do not print raw provider exceptions or private signed query strings.
        message = "Downloaded media could not be read" if isinstance(error, subprocess.SubprocessError) else str(error)
        print(f"Source download failed: {message}", file=sys.stderr)
        sys.exit(1)
