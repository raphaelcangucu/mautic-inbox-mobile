#!/usr/bin/env python3
"""Extract a signed physical-device APK from the already-audited Play AAB."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
aab = Path(os.environ['ANDROID_AAB_PATH']).resolve(strict=True)
report = json.loads(aab.with_name(aab.stem + '-audit.json').read_text())
if hashlib.sha256(aab.read_bytes()).hexdigest() != report['aabSha256']:
    raise ValueError('APK export requires the exact audited AAB')
spec = importlib.util.spec_from_file_location('release', ROOT / 'scripts/android-release.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
env = module.signing_environment()
env.setdefault('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home')
env['PATH'] = env['JAVA_HOME'] + '/bin:' + env['PATH']
java = Path(env.get('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home')) / 'bin/java'
private = Path.home() / '.local/share/mautic-inbox/android'
os.umask(0o077)
with tempfile.TemporaryDirectory(prefix='apk-export-', dir=private) as scratch:
    folder = Path(scratch)
    for name, value in [('store-password', env['MAUTIC_UPLOAD_STORE_PASSWORD']), ('key-password', env['MAUTIC_UPLOAD_KEY_PASSWORD'])]:
        (folder / name).write_text(value + '\n')
    apks = folder / 'bundle.apks'
    subprocess.run([str(java), '-jar', env['BUNDLETOOL_JAR'], 'build-apks', f'--bundle={aab}',
                    f'--output={apks}', '--mode=universal', f'--ks={env["MAUTIC_UPLOAD_STORE"]}',
                    f'--ks-key-alias={env["MAUTIC_UPLOAD_ALIAS"]}', f'--ks-pass=file:{folder / "store-password"}',
                    f'--key-pass=file:{folder / "key-password"}'], env=env, check=True)
    apk = aab.with_suffix('.apk')
    with zipfile.ZipFile(apks) as archive:
        apk.write_bytes(archive.read('universal.apk'))
sdk = Path(env.get('ANDROID_HOME', str(Path.home() / 'Library/Android/sdk')))
output = subprocess.check_output([str(sdk / 'build-tools/36.0.0/apksigner'), 'verify', '--print-certs', str(apk)], env=env).decode()
fingerprints = re.findall(r'certificate SHA-256 digest:\s*([a-fA-F0-9]+)', output)
if [x.upper() for x in fingerprints] != [report['signerSha256']]:
    raise ValueError('APK signing certificate differs from the Play upload key')
evidence = {'apk': str(apk), 'apkSha256': hashlib.sha256(apk.read_bytes()).hexdigest(),
            'aabSha256': report['aabSha256'], 'signerSha256': report['signerSha256'],
            'derivedFromAuditedBundle': True, 'deviceInstalled': False}
apk.with_name(apk.stem + '-apk-audit.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(f'Physical-device APK exported from the audited AAB: {apk}')
