#!/usr/bin/env python3
"""Audit actual signed AAB bytes; no production database or device needed."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import struct
import subprocess
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ANDROID = '{http://schemas.android.com/apk/res/android}'


def elf_load_alignments(data):
    if data[:4] != b'\x7fELF' or data[5] not in (1, 2):
        raise ValueError('Invalid ELF library')
    endian = '<' if data[5] == 1 else '>'
    if data[4] == 2:
        phoff = struct.unpack_from(endian + 'Q', data, 32)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 54)
        alignment_offset, alignment_type = 48, 'Q'
    elif data[4] == 1:
        phoff = struct.unpack_from(endian + 'I', data, 28)[0]
        size, count = struct.unpack_from(endian + 'HH', data, 42)
        alignment_offset, alignment_type = 28, 'I'
    else:
        raise ValueError('Unknown ELF class')
    result = []
    for i in range(count):
        offset = phoff + i * size
        if struct.unpack_from(endian + 'I', data, offset)[0] == 1:
            result.append(struct.unpack_from(endian + alignment_type, data, offset + alignment_offset)[0])
    if not result:
        raise ValueError('ELF has no loadable segments')
    return result


def metadata_check():
    for locale in ('pt-BR', 'en-US', 'es-ES'):
        folder = ROOT / 'fastlane/android-metadata' / locale
        for name, limit in (('title', 30), ('short_description', 80), ('full_description', 4000)):
            text = (folder / f'{name}.txt').read_text().strip()
            if not text or len(text) > limit:
                raise ValueError(f'{locale}/{name}: invalid Play listing length')
    print('Android listing text lengths passed for all three languages.')


def png_info(path):
    data = path.read_bytes()
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise ValueError(f'Not a PNG: {path}')
    width, height, depth, color = struct.unpack_from('>IIBB', data, 16)
    offset = 8
    transparent = color in (4, 6)
    while offset + 12 <= len(data):
        length = struct.unpack_from('>I', data, offset)[0]
        kind = data[offset + 4:offset + 8]
        transparent |= kind == b'tRNS'
        offset += length + 12
        if offset > len(data):
            raise ValueError(f'Truncated PNG: {path}')
        if kind == b'IEND':
            break
    return width, height, depth, color, transparent


def assets_check():
    """Reject stale, missing or substituted native captures before Supply upload."""
    metadata_check()
    config = json.loads((ROOT / 'app.json').read_text())['expo']
    report = json.loads((ROOT / 'artifacts/publication/android/store-asset-manifest.json').read_text())
    aab = ROOT / f'artifacts/publication/android/Mautic-Inbox-{config["version"]}-{config["android"]["versionCode"]}.aab'
    if report.get('package') != config['android']['package'] or report.get('versionCode') != config['android']['versionCode']:
        raise ValueError('Screenshot provenance has the wrong Android build')
    if report.get('aabSha256') != hashlib.sha256(aab.read_bytes()).hexdigest():
        raise ValueError('Screenshot provenance does not match the actual signed bundle')
    if report.get('captureType') != 'physical-android-native' or report.get('dataMode') != 'demo':
        raise ValueError('Native physical Android screenshot evidence is required')
    if report.get('visuallyReviewed') is not True or report.get('device', {}).get('versionCode') != config['android']['versionCode']:
        raise ValueError('Store images require visual review of the installed Android build')
    expected = set()
    for locale in ('pt-BR', 'en-US', 'es-ES'):
        folder = Path('fastlane/android-metadata') / locale / 'images'
        expected.update({str(folder / 'icon.png'), str(folder / 'featureGraphic.png')})
        expected.update(str(folder / 'phoneScreenshots' / (name + '.png')) for name in
                        ('01-conversas', '02-chat', '03-comentarios', '04-assistente', '05-conexoes'))
    entries = report['assets']
    if {x['path'] for x in entries} != expected or len(entries) != len(expected):
        raise ValueError('Store asset set must contain exactly the approved assets for all three languages')
    for entry in entries:
        path = (ROOT / entry['path']).resolve(strict=True)
        if not path.is_relative_to(ROOT) or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('Store asset changed after visual review')
        width, height, depth, color, transparent = png_info(path)
        required = (512, 512) if path.name == 'icon.png' else (1024, 500) if path.name == 'featureGraphic.png' else (1080, 1920)
        icon = path.name == 'icon.png'
        if (width, height) != required or depth != 8 or color != (6 if icon else 2) or (transparent and not icon):
            raise ValueError(f'Unexpected dimensions or alpha: {path}')
        if icon and path.stat().st_size > 1024 * 1024:
            raise ValueError('Google Play icon exceeds 1024KB')
        if 'phoneScreenshots' in path.parts:
            source = (ROOT / entry['nativeSource']).resolve(strict=True)
            if not source.is_relative_to(ROOT / f'artifacts/publication/android-store-captures-{config["android"]["versionCode"]}'):
                raise ValueError('Native screenshot source must belong to the captured Android build')
            if hashlib.sha256(source.read_bytes()).hexdigest() != entry['nativeSourceSha256'] or png_info(source)[:2] != (1080, 2400):
                raise ValueError('Native screenshot source changed')
    print('Android store assets passed: 15 physical-device screenshots and 6 localized branding assets, matched to the signed AAB.')


def audit(aab):
    config = json.loads((ROOT / 'app.json').read_text())['expo']
    jar = Path(os.environ['BUNDLETOOL_JAR']).resolve(strict=True)
    tools = Path(os.environ.get('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home')) / 'bin'
    def capture(args, env=None):
        return subprocess.check_output([str(x) for x in args], env=env, stderr=subprocess.STDOUT)
    capture([tools / 'java', '-jar', jar, 'validate', f'--bundle={aab}'])
    manifest = capture([tools / 'java', '-jar', jar, 'dump', 'manifest', f'--bundle={aab}', '--module=base'])
    xml = ET.fromstring(manifest)
    app = xml.find('application')
    sdk = xml.find('uses-sdk')
    if xml.get('package') != config['android']['package']:
        raise ValueError('Wrong Android package')
    if int(xml.get(ANDROID + 'versionCode')) != config['android']['versionCode'] or xml.get(ANDROID + 'versionName') != config['version']:
        raise ValueError('Wrong Android version')
    if sdk is None or int(sdk.get(ANDROID + 'targetSdkVersion', '0')) < 36:
        raise ValueError('Play target SDK must be at least 36')
    if app is None or app.get(ANDROID + 'debuggable', 'false') != 'false' or app.get(ANDROID + 'allowBackup') != 'false':
        raise ValueError('Unexpected debug or backup configuration')
    if app.get(ANDROID + 'usesCleartextTraffic', 'false') != 'false':
        raise ValueError('Cleartext traffic must be disabled in the release manifest')
    permissions = sorted(x.get(ANDROID + 'name') for x in xml.findall('uses-permission'))
    if 'android.permission.SYSTEM_ALERT_WINDOW' in permissions:
        raise ValueError('Developer overlay permission must not be shipped to Google Play')
    if 'android.permission.ACTIVITY_RECOGNITION' in permissions:
        raise ValueError('Unused pedometer permission must not be shipped to Google Play')
    if any(p.startswith('android.permission.FOREGROUND_SERVICE') for p in permissions):
        raise ValueError('Unused foreground-service permissions must not be shipped to Google Play')
    if any(s.get(ANDROID + 'name') == 'expo.modules.audio.service.AudioControlsService'
           for s in app.findall('service')):
        raise ValueError('Unused background audio service must not be shipped to Google Play')
    verified = capture([tools / 'jarsigner', '-J-Duser.language=en', '-verify', aab]).decode()
    if 'jar verified.' not in verified:
        raise ValueError('Bundle signature not verified')
    spec = importlib.util.spec_from_file_location('android_release', ROOT / 'scripts/android-release.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    env = module.signing_environment()
    # Keep the DER certificate alone; signing passwords never enter arguments.
    cert = subprocess.check_output([str(tools / 'keytool'), '-exportcert', '-keystore', env['MAUTIC_UPLOAD_STORE'],
                                   '-alias', env['MAUTIC_UPLOAD_ALIAS'], '-storepass:env', 'MAUTIC_UPLOAD_STORE_PASSWORD'], env=env, stderr=subprocess.DEVNULL)
    expected = hashlib.sha256(cert).hexdigest().upper()
    printed = capture([tools / 'keytool', '-J-Duser.language=en', '-printcert', '-jarfile', aab]).decode()
    fingerprints = [x.replace(':', '').upper() for x in re.findall(r'SHA256:\s*([A-Fa-f0-9:]+)', printed)]
    if fingerprints != [expected] or 'Android Debug' in printed:
        raise ValueError('Bundle signer does not match the private upload key')
    libraries = []
    with zipfile.ZipFile(aab) as bundle:
        for path in bundle.namelist():
            if path.endswith('.so') and ('/lib/arm64-v8a/' in path or '/lib/x86_64/' in path):
                alignments = elf_load_alignments(bundle.read(path))
                if any(x < 16384 or x % 16384 for x in alignments):
                    raise ValueError(f'Native library does not support 16KB pages: {path}: {alignments}')
                libraries.append({'path': path, 'loadAlignment': min(alignments)})
        abis = sorted({x.split('/lib/')[1].split('/')[0] for x in bundle.namelist() if '/lib/' in x and x.endswith('.so')})
    if not libraries or 'arm64-v8a' not in abis:
        raise ValueError('Missing audited 64-bit native libraries')
    bundle_config = json.loads(capture([tools / 'java', '-jar', jar, 'dump', 'config', f'--bundle={aab}']))
    alignment = bundle_config.get('optimizations', {}).get('uncompressNativeLibraries', {}).get('alignment')
    if alignment != 'PAGE_ALIGNMENT_16K':
        raise ValueError(f'Bundle native ZIP alignment is not 16KB: {alignment}')
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'package': config['android']['package'],
              'version': config['version'], 'versionCode': config['android']['versionCode'],
              'aab': str(aab), 'aabSha256': hashlib.sha256(aab.read_bytes()).hexdigest(),
              'signerSha256': expected, 'targetSdk': int(sdk.get(ANDROID + 'targetSdkVersion')),
              'minSdk': int(sdk.get(ANDROID + 'minSdkVersion')), 'debuggable': False,
              'allowBackup': False, 'cleartextTraffic': False, 'abis': abis,
              'nativeZipAlignment': alignment, 'nativeLibraries': libraries,
              'permissions': permissions,
              'bundletoolValidated': True, 'uploadedToPlay': False, 'deviceValidated': False}
    output = aab.parent / (aab.stem + '-audit.json')
    output.write_text(json.dumps(report, indent=2) + '\n')
    (aab.parent / (aab.stem + '-manifest.xml')).write_bytes(manifest)
    print(f'AAB audit passed: SDK {report["targetSdk"]}, upload signature, {len(libraries)} native libraries with 16KB alignment.\n{output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aab', type=Path)
    parser.add_argument('--metadata', action='store_true')
    parser.add_argument('--assets', action='store_true')
    args = parser.parse_args()
    if args.metadata:
        metadata_check()
    if args.assets:
        assets_check()
    if args.aab:
        audit(args.aab.resolve(strict=True))
    if not args.metadata and not args.aab and not args.assets:
        parser.error('Choose --metadata, --assets or --aab')
