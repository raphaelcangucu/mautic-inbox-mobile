#!/usr/bin/env python3
"""Render localized publication assets from verified native captures; no API calls."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('product_assets', ROOT / 'scripts/package-ios-product-assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


def main():
    original = assets.load_original()
    assets.require(original['version'] == assets.CONFIG['version'] and
                   str(original['build']) == assets.BUILD,
                   'Capture the current native build before generating publication artwork')
    for image in original['images']:
        assets.require(image.get('realUI') is True and image.get('installedBuildVerified') == assets.BUILD and
                       image.get('dataMode') == 'clearly-labelled-demo' and
                       assets.digest(ROOT / image['sourceCapture']) == image['sourceSha256'],
                       'Native source provenance is missing or changed')
    with tempfile.TemporaryDirectory(prefix='mautic-product-assets-') as directory:
        executable = Path(directory) / 'renderer'
        subprocess.run(['swiftc', str(ROOT / 'scripts/ios-product-assets.swift'), '-o', str(executable)], check=True)
        for locale in assets.COPY:
            for device in ['iphone-medium', 'ipad-13', 'social', 'board']:
                subprocess.run([str(executable), str(ROOT), str(assets.OUT), locale, device], check=True)
    assets.main()


if __name__ == '__main__':
    main()
