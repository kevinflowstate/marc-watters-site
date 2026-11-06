from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/lesson-source-download.py"
SPEC = importlib.util.spec_from_file_location("lesson_download", SCRIPT)
download = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(download)


class VideoResponse(io.BytesIO):
    def __init__(self, body, url, declared=None):
        super().__init__(body)
        self.url = url
        self.headers = {"Content-Length": str(len(body) if declared is None else declared)}

    def geturl(self):
        return self.url


class LessonSourceDownloadTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cbb-source-check-")
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.source, self.receipt = self.dir / "source.mp4", self.dir / "source.receipt.json"
        self.media = (ROOT / "fixtures/lesson-publication/verified-synthetic.mp4").read_bytes()
        self.url = "https://media.example.test/lesson.mp4?token=PRIVATE-TEST-TOKEN"
        self.reference = {"source_ref": "fathom:synthetic-test-only", "url": self.url,
                          "expected_bytes": len(self.media), "expected_sha256": hashlib.sha256(self.media).hexdigest(),
                          "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}

    def response(self, request, **kwargs):
        self.assertEqual(request.full_url, self.url)
        return VideoResponse(self.media, self.url)

    def test_streams_real_fixture_to_private_untouched_source_with_no_url_in_receipt(self):
        result = download.download(self.reference, self.source, self.receipt, open_source=self.response)
        self.assertEqual(self.source.read_bytes(), self.media)
        self.assertEqual(self.source.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.receipt.stat().st_mode & 0o777, 0o600)
        self.assertEqual(result["status"], "source_downloaded_not_edited")
        self.assertAlmostEqual(result["duration_s"], 1)
        self.assertFalse(result["published"])
        self.assertNotIn("PRIVATE-TEST-TOKEN", self.receipt.read_text())
        with self.assertRaisesRegex(ValueError, "never replaced"):
            download.download(self.reference, self.source, self.receipt, open_source=self.response)
        self.assertEqual(self.source.read_bytes(), self.media)

    def test_expired_link_and_oversized_reference_stop_before_network_access(self):
        expired = {**self.reference, "expires_at": "2000-01-01T00:00:00Z"}
        with patch.object(download, "build_opener") as opener:
            with self.assertRaisesRegex(ValueError, "expired"):
                download.download(expired, self.source, self.receipt)
            with self.assertRaisesRegex(ValueError, "download limit"):
                download.download(self.reference, self.source, self.receipt, max_bytes=len(self.media) - 1)
            opener.assert_not_called()
        self.assertFalse(self.source.exists())

    def test_truncated_or_wrong_hash_never_saves_a_source_or_receipt(self):
        for response in (
            lambda *_args, **_kwargs: VideoResponse(self.media[:-5], self.url, declared=len(self.media)),
            lambda *_args, **_kwargs: VideoResponse(self.media, self.url),
        ):
            reference = {**self.reference, "expected_sha256": "0" * 64}
            with self.assertRaises(ValueError):
                download.download(reference, self.source, self.receipt, open_source=response)
            self.assertFalse(self.source.exists())
            self.assertFalse(self.receipt.exists())
            self.assertEqual(list(self.dir.glob(".cbb-source-*")), [])

    def test_rejects_unapproved_redirect_and_insecure_or_private_urls(self):
        for url in ("http://media.example.test/video.mp4", "https://127.0.0.1/video.mp4",
                    "https://localhost/video.mp4", "https://user:password@media.example.test/video.mp4"):
            with self.assertRaises(ValueError):
                download.download({**self.reference, "url": url}, self.source, self.receipt, open_source=self.response)
        with self.assertRaisesRegex(ValueError, "unapproved host"):
            download.download(self.reference, self.source, self.receipt,
                              open_source=lambda *_args, **_kwargs: VideoResponse(self.media, "https://other.example.test/video"))
        self.assertFalse(self.source.exists())

    def test_invalid_mp4_or_disk_shortage_never_produces_a_source(self):
        bad = b"not a video"
        with self.assertRaises(subprocess.CalledProcessError):
            download.download({"source_ref": "fathom:test", "url": self.url}, self.source, self.receipt,
                              open_source=lambda *_args, **_kwargs: VideoResponse(bad, self.url))
        with patch.object(download.shutil, "disk_usage") as disk:
            disk.return_value.free = len(self.media)
            with self.assertRaisesRegex(ValueError, "free disk"):
                download.download(self.reference, self.source, self.receipt, open_source=self.response)
        self.assertFalse(self.source.exists())
        self.assertFalse(self.receipt.exists())

    def test_cli_does_not_print_a_signed_url_when_provider_rejects_it(self):
        reference_path = self.dir / "reference.json"
        reference_path.write_text(json.dumps(self.reference))
        argv = [str(SCRIPT), "--reference", str(reference_path), "--source", str(self.source), "--receipt", str(self.receipt)]
        with patch.object(sys, "argv", argv), patch("urllib.request.build_opener") as opener:
            opener.return_value.open.side_effect = HTTPError(self.url, 403, "Denied", {}, None)
            stderr = io.StringIO()
            with patch.object(sys, "stderr", stderr), self.assertRaises(SystemExit):
                runpy.run_path(str(SCRIPT), run_name="__main__")
        self.assertIn("HTTP 403", stderr.getvalue())
        self.assertNotIn("PRIVATE-TEST-TOKEN", stderr.getvalue())
        self.assertNotIn("https://", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
