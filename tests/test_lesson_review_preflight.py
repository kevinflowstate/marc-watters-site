import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/lesson-review-preflight.py"
SPEC = importlib.util.spec_from_file_location("lesson_preflight", SCRIPT)
preflight = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preflight)


class LessonReviewPreflightTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cbb-lesson-check-")
        self.addCleanup(self.temp.cleanup)
        self.dir = Path(self.temp.name)
        self.source, self.edited = self.dir / "source.mp4", self.dir / "edit/lesson-v1.mp4"
        self.edited.parent.mkdir()
        fixture = ROOT / "fixtures/lesson-publication/verified-synthetic.mp4"
        shutil.copyfile(fixture, self.source)
        shutil.copyfile(fixture, self.edited)
        self.plan_path, self.receipt_path = self.dir / "edit/plan.json", self.dir / "edit/lesson-v1.receipt.json"
        self.plan = {"schema_version": 1, "source_id": "fathom:synthetic-test-only",
                     "source_sha256": preflight.digest(self.source), "source_duration_seconds": 1,
                     "keep_ranges": [[0, 1]]}
        self.plan_path.write_text(json.dumps(self.plan))
        self.receipt = {"schema_version": 1, "status": "private_preview_not_published",
                        "source_id": self.plan["source_id"], "source_sha256": self.plan["source_sha256"],
                        "output_sha256": preflight.digest(self.edited),
                        "plan_sha256": preflight.digest(self.plan_path), "expected_duration_seconds": 1,
                        "actual_duration_seconds": 1, "keep_ranges": [[0, 1]]}
        self.receipt_path.write_text(json.dumps(self.receipt))

    def prepare(self, **kwargs):
        return preflight.prepare(self.source, self.edited, self.plan_path, self.receipt_path,
                                 "Synthetic fixture only", "A test summary.", "A test workbook.", **kwargs)

    def test_decodes_actual_video_and_audio_and_keeps_all_inputs_unchanged(self):
        before = {p: p.read_bytes() for p in (self.source, self.edited, self.plan_path, self.receipt_path)}
        result = self.prepare()
        self.assertEqual(result["status"], "private_review_ready")
        self.assertTrue(result["media"]["full_decode_passed"])
        self.assertTrue(result["portal_file_checks_passed"])
        self.assertIsNone(result["approval"])
        self.assertFalse(result["publication_enabled"])
        self.assertIn("Nothing has been uploaded, approved or published", result["body"])
        for p, content in before.items():
            self.assertEqual(p.read_bytes(), content)

    def test_a_changed_plan_or_receipt_cannot_borrow_the_prior_render_proof(self):
        self.plan["keep_ranges"] = [[0.1, 1]]
        self.plan_path.write_text(json.dumps(self.plan))
        with self.assertRaisesRegex(ValueError, "plan changed"):
            self.prepare()
        self.plan["keep_ranges"] = [[0, 1]]
        self.plan_path.write_text(json.dumps(self.plan))
        self.receipt["source_id"] = "fathom:a-different-recording"
        self.receipt_path.write_text(json.dumps(self.receipt))
        with self.assertRaisesRegex(ValueError, "references do not match"):
            self.prepare()

    def test_changed_video_and_fabricated_duration_are_rejected_before_decode(self):
        with self.edited.open("ab") as stream:
            stream.write(b"changed")
        with self.assertRaisesRegex(ValueError, "preview differs"):
            self.prepare()
        shutil.copyfile(self.source, self.edited)
        self.receipt["actual_duration_seconds"] = 10
        self.receipt_path.write_text(json.dumps(self.receipt))
        with self.assertRaisesRegex(ValueError, "duration do not agree"):
            self.prepare()

    def test_metadata_only_never_claims_playback_is_verified(self):
        result = self.prepare(decode=False)
        self.assertEqual(result["status"], "playback_check_needed")
        self.assertFalse(result["media"]["full_decode_passed"])
        self.assertFalse(result["portal_file_checks_passed"])
        self.assertIn("not been decoded", result["portal_blockers"][0])

    def test_larger_file_is_reviewable_but_handoff_stays_blocked(self):
        # Exercise the boundary without allocating a quarter-gigabyte fixture.
        with patch.object(preflight, "PORTAL_LIMIT_BYTES", self.edited.stat().st_size - 1):
            result = self.prepare()
        self.assertEqual(result["status"], "private_review_ready")
        self.assertFalse(result["portal_file_checks_passed"])
        self.assertIn("256 MiB", result["portal_blockers"][0])
        sql = (ROOT / "supabase/migrations/025_ops_lesson_publication.sql").read_text()
        self.assertIn(f"bytes<={preflight.PORTAL_LIMIT_BYTES}", sql)

    def test_complete_decode_failure_cannot_create_a_ready_pack(self):
        original_run = subprocess.run
        def fail_decode(command, **kwargs):
            if command[0] == "ffmpeg":
                raise subprocess.CalledProcessError(1, command, stderr="Corrupt packet")
            return original_run(command, **kwargs)
        with patch.object(preflight.subprocess, "run", side_effect=fail_decode):
            with self.assertRaises(subprocess.CalledProcessError):
                self.prepare()

    def test_cli_creates_private_pack_and_refuses_to_overwrite_it(self):
        summary, workbook, output = self.dir / "summary.md", self.dir / "workbook.md", self.dir / "edit/review.json"
        summary.write_text("## Summary\nTest only.")
        workbook.write_text("## Workbook\nTest question.")
        command = ["python3", str(SCRIPT), "--source", str(self.source), "--edited", str(self.edited),
                   "--plan", str(self.plan_path), "--receipt", str(self.receipt_path),
                   "--summary", str(summary), "--workbook", str(workbook), "--output", str(output),
                   "--title", "Synthetic test only"]
        subprocess.run(command, check=True, capture_output=True, text=True)
        original = output.read_bytes()
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        second = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(second.returncode, 0)
        self.assertEqual(output.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
