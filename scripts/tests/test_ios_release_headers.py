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
        properties = package.parent / "sdks/hermes-engine/version.properties"
        properties.parent.mkdir(parents=True)
        properties.write_text("HERMES_VERSION_NAME=0.14.1\n")
        config = root / "ios/Podfile.properties.json"
        config.parent.mkdir(parents=True)
        config.write_text("{}")
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
        artifact = artifact.parent.parent / "hermes-engine-artifacts/hermes-ios-0.14.1-release.tar.gz"
        artifact.parent.mkdir(parents=True)
        with tarfile.open(artifact, "w:gz") as archive:
            for name in ["hermes/hermes.h", "hermes/Public/RuntimeConfig.h", "jsi/hermes.h"]:
                data = b"hermes release header"
                member = tarfile.TarInfo("./destroot/include/" + name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))

    def test_clean_workspace_exposes_release_headers_idempotently(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.fixture(root)
            self.assertEqual(module.prepare(root), 6)
            (root / "ios/Pods/ReactNativeDependencies/Headers/folly/dynamic.h").chmod(0o444)
            self.assertEqual(module.prepare(root), 6)
            self.assertEqual((root / "ios/Pods/hermes-engine/destroot/include/hermes/hermes.h").read_bytes(), b"hermes release header")
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
