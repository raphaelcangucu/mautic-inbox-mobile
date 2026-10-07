import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import json

spec = importlib.util.spec_from_file_location('product_assets', Path(__file__).resolve().parents[1] / 'package-ios-product-assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class VisualReviewGateTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.copy_path = self.root / 'fastlane/product-assets-ios/copy.json'
        self.copy_path.parent.mkdir(parents=True)
        self.copy_path.write_text('{}')
        self.records = [{'file': 'screenshots/pt-BR/01.png', 'sha256': 'image-hash'}]
        self.receipt = {'version': assets.CONFIG['version'], 'build': assets.BUILD,
                        'copySha256': assets.digest(self.copy_path),
                        'images': {r['file']: r['sha256'] for r in self.records}}
        self.patch = patch.object(assets, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def write_receipt(self):
        (self.copy_path.parent / f'reviewed-{assets.BUILD}.json').write_text(json.dumps(self.receipt))

    def test_exact_visual_review_accepted(self):
        self.write_receipt()
        self.assertTrue(assets.review_matches(self.records))

    def test_no_review_rejected(self):
        self.assertFalse(assets.review_matches(self.records))

    def test_changed_artwork_rejected(self):
        self.write_receipt()
        self.records[0]['sha256'] = 'changed-image'
        self.assertFalse(assets.review_matches(self.records))

    def test_changed_headline_rejected(self):
        self.write_receipt()
        self.copy_path.write_text('{"headline":"new"}')
        self.assertFalse(assets.review_matches(self.records))

    def test_other_build_or_version_rejected(self):
        for key in ['build', 'version']:
            with self.subTest(key=key):
                original = self.receipt[key]
                self.receipt[key] = 'different'
                self.write_receipt()
                self.assertFalse(assets.review_matches(self.records))
                self.receipt[key] = original

    def test_missing_image_rejected(self):
        self.write_receipt()
        self.assertFalse(assets.review_matches([]))
