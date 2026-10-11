import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("release_headers", Path(__file__).parents[1] / "prepare-ios-release-headers.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseHeadersTest(unittest.TestCase):
    def fixture(self, root, extra=(), omit=()):
        package = root / "node_modules/react-native/package.json"
        package.parent.mkdir(parents=True)
        package.write_text(json.dumps({"version": "0.83.10"}))
        artifact = root / "ios/Pods/ReactNativeDependencies-artifacts/reactnative-dependencies-0.83.10-release.tar.gz"
        artifact.parent.mkdir(parents=True)
        with tarfile.open(artifact, "w:gz") as archive:
            for name in ["folly/dynamic.h", "folly/json/dynamic.h", "folly/folly-config.h", *extra]:
                if name in omit:
                    continue
                data = b"release header"
                member = tarfile.TarInfo("packages/react-native/third-party/ReactNativeDependencies.xcframework/Headers/" + name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))

    def test_clean_workspace_exposes_release_headers_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            self.assertEqual(module.prepare(root), 3)
            (root / "ios/Pods/ReactNativeDependencies/Headers/folly/dynamic.h").chmod(0o444)
            self.assertEqual(module.prepare(root), 3)
            self.assertEqual((root / "ios/Pods/ReactNativeDependencies/Headers/folly/dynamic.h").read_bytes(), b"release header")

    def test_rejects_incomplete_artifact_before_writing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, omit=("folly/dynamic.h",))
            with self.assertRaises(ValueError):
                module.prepare(root)
            self.assertFalse((root / "ios/Pods/ReactNativeDependencies/Headers").exists())

    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root, extra=("../outside.h",))
            with self.assertRaises(ValueError):
                module.prepare(root)


if __name__ == "__main__":
    unittest.main()
