"""Unit checks for publication gates; no Apple, Mautic, signing or database access."""
import copy
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'release_preflight', Path(__file__).resolve().parents[1] / 'release_preflight.py')
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class SubmissionEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='inbox-release-gate-test-')
        self.addCleanup(self.directory.cleanup)
        self.video = Path(self.directory.name) / 'video-fixture'
        self.video.write_bytes(b'unit fixture; not a real validation video')
        self.app = {'version': '1.0.0', 'ios': {'buildNumber': '21'}}
        self.report = {
            'version': '1.0.0', 'build': '21', 'ipaSha256': 'ipa-fixture',
            'physicalVideo': str(self.video),
            'physicalVideoSha256': hashlib.sha256(self.video.read_bytes()).hexdigest(),
            **dict.fromkeys(preflight.RELEASE_FACTS, True),
        }

    def check(self, report):
        preflight.submission_evidence(report, 'ipa-fixture', self.app)

    def test_complete_record_passes_structural_gate(self):
        # This tests the gate, not the truth of real-world release evidence.
        self.check(self.report)

    def test_every_required_fact_is_mandatory(self):
        for fact in preflight.RELEASE_FACTS:
            with self.subTest(fact=fact):
                report = copy.deepcopy(self.report)
                del report[fact]
                with self.assertRaisesRegex(SystemExit, fact):
                    self.check(report)

    def test_apns_acceptance_cannot_replace_visible_push(self):
        self.report['pushDisplayedAppClosed'] = False
        self.report['physicalPushApnsAccepted'] = True
        with self.assertRaisesRegex(SystemExit, 'pushDisplayedAppClosed'):
            self.check(self.report)

    def test_string_true_is_not_verified_evidence(self):
        self.report['physicalQrShareValidated'] = 'true'
        with self.assertRaisesRegex(SystemExit, 'physicalQrShareValidated'):
            self.check(self.report)

    def test_previous_build_is_rejected(self):
        self.report['build'] = '17'
        with self.assertRaisesRegex(SystemExit, 'another build'):
            self.check(self.report)

    def test_different_ipa_is_rejected(self):
        self.report['ipaSha256'] = 'other-ipa'
        with self.assertRaisesRegex(SystemExit, 'another build'):
            self.check(self.report)

    def test_video_changed_after_validation_is_rejected(self):
        self.video.write_bytes(b'changed fixture')
        with self.assertRaisesRegex(SystemExit, 'checksum'):
            self.check(self.report)

    def test_missing_video_is_rejected(self):
        self.video.unlink()
        with self.assertRaisesRegex(SystemExit, 'video is missing'):
            self.check(self.report)

    def test_missing_video_checksum_is_rejected(self):
        del self.report['physicalVideoSha256']
        with self.assertRaisesRegex(SystemExit, 'checksum'):
            self.check(self.report)


if __name__ == '__main__':
    unittest.main()
