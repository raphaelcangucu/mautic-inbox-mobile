"""Expose headers from the locked RN Release artifact before CocoaPods indexing.

RN 0.83 installs Debug headers, then swaps only the framework during archive.
Its Release framework has additional public Folly headers; indexing those before
the second pod install keeps clean archives independent of prior local builds.
"""
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile


def prepare(workspace: Path) -> int:
    version = json.loads((workspace / "node_modules/react-native/package.json").read_text())["version"]
    pods = workspace / "ios/Pods"
    artifact = pods / f"ReactNativeDependencies-artifacts/reactnative-dependencies-{version}-release.tar.gz"
    destination = pods / "ReactNativeDependencies/Headers"
    prefix = "packages/react-native/third-party/ReactNativeDependencies.xcframework/Headers/"
    files = {}
    with tarfile.open(artifact) as archive:
        for member in archive.getmembers():
            if not member.name.startswith(prefix) or member.isdir():
                continue
            relative = PurePosixPath(member.name[len(prefix):])
            if not member.isfile() or relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Unsafe dependency header: {member.name}")
            files[str(relative)] = archive.extractfile(member).read()
    for required in ("folly/dynamic.h", "folly/json/dynamic.h", "folly/folly-config.h"):
        if required not in files:
            raise ValueError(f"Release artifact is missing {required}")
    for relative, contents in files.items():
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(contents)
    return len(files)


if __name__ == "__main__":
    print(f"Prepared {prepare(Path(sys.argv[1]))} locked React Native Release headers")
