#!/usr/bin/env python3
"""Read-only release checks. Never opens a Mautic database or exposes signing keys."""
import argparse
import datetime as dt
import hashlib
import json
import plistlib
import re
import struct
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# These are release requirements, not proxies such as APNs acceptance or a
# successful simulator build. Keep them aligned with META-PUBLICACAO-IOS.md.
RELEASE_FACTS = (
    'physicalDeviceValidated',
    'i18nValidated',
    'restrictedCacheValidated',
    'pushDisplayedAppClosed',
    'pushTapOpenedCorrectConversation',
    'physicalReceivedImageValidated',
    'physicalContactStartValidated',
    'physicalQrShareValidated',
    'instagramPublicReplyConfirmed',
    'webchatBidirectionalConfirmed',
    'assistantValidated',
    'privacyDeclarationsReviewed',
    'storeMetadataComplete',
    'reviewAccessValidated',
    'contentRightsConfirmed',
)


def require(ok, message):
    if not ok:
        raise SystemExit(message)


def submission_evidence(report, digest, app):
    require(report.get('ipaSha256') == digest and report.get('version') == app['version']
            and str(report.get('build')) == str(app['ios']['buildNumber']),
            'Evidence belongs to another build')
    for fact in RELEASE_FACTS:
        require(report.get(fact) is True, 'Release validation pending: ' + fact)
    video = Path(report.get('physicalVideo', ''))
    require(video.is_file(), 'Physical validation video is missing')
    require(hashlib.sha256(video.read_bytes()).hexdigest() == report.get('physicalVideoSha256'),
            'Physical validation video changed or its checksum is missing')


def source():
    app = json.loads((ROOT / 'app.json').read_text())['expo']
    version = json.loads((ROOT / 'package.json').read_text())['version']
    require(app['version'] == version, 'Package and Expo versions disagree')
    require(re.fullmatch(r'\d+\.\d+\.\d+', version), 'Invalid release version')
    require(app['ios']['appleTeamId'] == 'SB6QYUH97U', 'Wrong Apple team')
    require(app['ios']['bundleIdentifier'] == 'com.distributionmachine.mauticinbox.demo', 'Unexpected app identity')
    require(str(app['ios']['buildNumber']).isdigit(), 'Invalid build number')
    return app


def listing(app):
    locales = ['pt-BR', 'en-US', 'es-ES']
    for locale in locales:
        metadata = ROOT / 'fastlane/metadata' / locale
        for name, maximum in [('name', 30), ('subtitle', 30), ('keywords', 100), ('description', 4000)]:
            text = (metadata / (name + '.txt')).read_text().strip()
            require(0 < len(text) <= maximum, f'Invalid metadata: {locale}/{name}')
        for name in ['support_url', 'privacy_url']:
            require((metadata / (name + '.txt')).read_text().strip().startswith('https://'), f'Missing {locale}/{name}')
    manifest_path = ROOT / 'fastlane/screenshots/manifest.json'
    require(manifest_path.is_file(), 'Real screenshot manifest is missing')
    manifest = json.loads(manifest_path.read_text())
    require(manifest['version'] == app['version'] and str(manifest['build']) == str(app['ios']['buildNumber']), 'Screenshots belong to another build')
    classes = set()
    counts = {}
    for item in manifest['images']:
        path = ROOT / item['file']
        require(path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], 'Screenshot changed after validation')
        raw = path.read_bytes()
        require(raw[:8] == b'\x89PNG\r\n\x1a\n', 'Only verified PNG assets are accepted')
        width, height = struct.unpack('>II', raw[16:24])
        require(raw[25] in [0, 2], 'Screenshot must be opaque RGB or grayscale')
        offset = 8
        while offset < len(raw):
            length = struct.unpack('>I', raw[offset:offset + 4])[0]
            require(raw[offset + 4:offset + 8] != b'tRNS', 'Screenshot contains transparency')
            offset += length + 12
        valid = {'iphone-medium': {(1179, 2556), (1206, 2622)}, 'iphone-6.9': {(1260, 2736), (1290, 2796), (1320, 2868)}, 'ipad-13': {(2064, 2752), (2048, 2732)}}
        require((width, height) in valid[item['display']], 'Wrong screenshot dimensions')
        require(item.get('realUI') is True and item.get('sourceCapture'), 'Screenshot capture provenance is missing')
        capture = ROOT / item['sourceCapture']
        require(capture.is_file() and hashlib.sha256(capture.read_bytes()).hexdigest() == item.get('sourceSha256'), 'Native source capture changed or is missing')
        require(item.get('version') == app['version'] and str(item.get('build')) == str(app['ios']['buildNumber']), 'Source capture belongs to another build')
        locale = Path(item['file']).parent.name
        require(locale in locales, 'Screenshot language is not a supported store locale')
        classes.add((locale, item['display']))
        bucket = (locale, item['display'])
        counts[bucket] = counts.get(bucket, 0) + 1
        require(counts[bucket] <= 10, 'Too many screenshots in a locale/display class')
    for locale in locales:
        require((locale, 'iphone-medium') in classes, f'Required iPhone screenshots missing: {locale}')
        require(not app['ios'].get('supportsTablet') or (locale, 'ipad-13') in classes, f'Supported iPad screenshots missing: {locale}')


def signed_ipa(path, app):
    path = Path(path).resolve()
    require(path.is_file(), 'Signed IPA is missing')
    with tempfile.TemporaryDirectory(prefix='mautic-release-verification-') as temp:
        with zipfile.ZipFile(path) as z:
            require(all(not Path(n).is_absolute() and '..' not in Path(n).parts for n in z.namelist()), 'Unsafe IPA archive path')
            z.extractall(temp)
        apps = list((Path(temp) / 'Payload').glob('*.app'))
        require(len(apps) == 1, 'Unexpected IPA payload')
        bundle = apps[0]
        info = plistlib.loads((bundle / 'Info.plist').read_bytes())
        require(info['CFBundleIdentifier'] == app['ios']['bundleIdentifier'], 'Wrong signed bundle')
        require(info['CFBundleShortVersionString'] == app['version'] and str(info['CFBundleVersion']) == str(app['ios']['buildNumber']), 'IPA version differs from release source')
        require(int(re.search(r'\d+', info.get('DTSDKName', '0')).group()) >= 26, 'iOS 26 SDK is required')
        profile_path = bundle / 'embedded.mobileprovision'
        require(profile_path.is_file(), 'IPA has no provisioning profile')
        profile = plistlib.loads(subprocess.check_output(['security', 'cms', '-D', '-i', str(profile_path)], stderr=subprocess.PIPE))
        require(app['ios']['appleTeamId'] in profile['TeamIdentifier'], 'Wrong profile team')
        require(profile['ExpirationDate'].replace(tzinfo=dt.timezone.utc) > dt.datetime.now(dt.timezone.utc), 'Profile has expired')
        require(not profile.get('ProvisionedDevices') and not profile.get('ProvisionsAllDevices'), 'App Store distribution profile required')
        ent = profile['Entitlements']
        require(ent.get('aps-environment') == 'production' and not ent.get('get-task-allow', False), 'Production push entitlements required')
        require(ent['application-identifier'] == app['ios']['appleTeamId'] + '.' + app['ios']['bundleIdentifier'], 'Wrong provisioned app')
        signed = subprocess.run(['codesign', '-d', '--entitlements', ':-', str(bundle)], capture_output=True, check=True)
        content = signed.stdout if b'<?xml' in signed.stdout else signed.stderr
        require(b'<?xml' in content, 'Signed entitlements unavailable')
        content = content[content.index(b'<?xml'):]
        content = content[:content.index(b'</plist>') + len(b'</plist>')]
        actual = plistlib.loads(content)
        require(actual.get('aps-environment') == 'production' and actual.get('application-identifier') == ent['application-identifier'], 'Signed entitlements differ from production profile')
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(bundle)], capture_output=True, check=True)
        own_manifest = bundle / 'PrivacyInfo.xcprivacy'
        require(own_manifest.is_file(), 'Application privacy manifest missing')
        privacy = plistlib.loads(own_manifest.read_bytes())
        expected = app['ios']['privacyManifests']
        require(privacy.get('NSPrivacyTracking') is False, 'Unexpected tracking declaration')
        require(privacy.get('NSPrivacyCollectedDataTypes') == expected['NSPrivacyCollectedDataTypes'], 'Application data declarations differ from audited source')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', action='store_true')
    parser.add_argument('--listing', action='store_true')
    parser.add_argument('--submission', action='store_true')
    parser.add_argument('--ipa')
    args = parser.parse_args()
    app = source()
    if args.listing or args.submission:
        listing(app)
    digest = signed_ipa(args.ipa, app) if args.ipa else None
    if args.submission:
        require(digest, 'Submission requires a verified IPA')
        evidence = ROOT / 'artifacts/publication/release-evidence.json'
        require(evidence.is_file(), 'Physical release evidence is missing')
        report = json.loads(evidence.read_text())
        submission_evidence(report, digest, app)
    print(f"Release check passed: {app['version']} ({app['ios']['buildNumber']})")


if __name__ == '__main__':
    main()
