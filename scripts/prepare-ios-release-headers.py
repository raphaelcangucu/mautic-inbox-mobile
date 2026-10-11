"""Expose headers from the locked RN Release artifact before CocoaPods indexing.

RN 0.83 installs Debug headers, then swaps only the framework during archive.
Its Release framework has additional public Folly headers; indexing those before
the second pod install keeps clean archives independent of prior local builds.
"""
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile


def copy_headers(artifact: Path, destination: Path, prefix: str, required: tuple) -> int:
    files = {}
    with tarfile.open(artifact) as archive:
        for member in archive.getmembers():
            if not member.name.startswith(prefix) or member.isdir():
                continue
            relative = PurePosixPath(member.name[len(prefix):])
            if not member.isfile() or relative.is_absolute() or ".." in relative.parts:
                raise ValueError(f"Unsafe dependency header: {member.name}")
            files[str(relative)] = archive.extractfile(member).read()
    for header in required:
        if header not in files:
            raise ValueError(f"Release artifact is missing {header}")
    for relative, contents in files.items():
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        # CocoaPods marks cached dependency files read-only. Replace the entry
        # rather than trying to edit its contents in place.
        if target.exists() or target.is_symlink():
            target.unlink()
        target.write_bytes(contents)
    return len(files)


def prepare(workspace: Path) -> int:
    native = workspace / "node_modules/react-native"
    version = json.loads((native / "package.json").read_text())["version"]
    pods = workspace / "ios/Pods"
    count = copy_headers(
        pods / f"ReactNativeDependencies-artifacts/reactnative-dependencies-{version}-release.tar.gz",
        pods / "ReactNativeDependencies/Headers",
        "packages/react-native/third-party/ReactNativeDependencies.xcframework/Headers/",
        ("folly/dynamic.h", "folly/json/dynamic.h", "folly/folly-config.h"),
    )
    properties = dict(line.split("=", 1) for line in (native / "sdks/hermes-engine/version.properties").read_text().splitlines() if "=" in line)
    config = json.loads((workspace / "ios/Podfile.properties.json").read_text())
    key = "HERMES_V1_VERSION_NAME" if config.get("expo.useHermesV1") == "true" else "HERMES_VERSION_NAME"
    count += copy_headers(
        pods / f"hermes-engine-artifacts/hermes-ios-{properties[key]}-release.tar.gz",
        pods / "hermes-engine/destroot/include",
        "./destroot/include/",
        ("hermes/hermes.h", "hermes/Public/RuntimeConfig.h", "jsi/hermes.h"),
    )
    return count


if __name__ == "__main__":
    print(f"Prepared {prepare(Path(sys.argv[1]))} locked React Native and Hermes Release headers")
