#!/usr/bin/env python3
"""Prepare/sign a Play bundle in an isolated workspace. No emulator or remote upload."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = Path.home() / '.local/share/mautic-inbox/android'


def run(args, cwd=None, env=None):
    # Do not print environment: signing passwords are passed only through env.
    subprocess.run([str(x) for x in args], cwd=cwd, env=env, check=True)


def private_file(path):
    path = Path(path).expanduser().resolve(strict=True)
    if path.is_relative_to(ROOT) or path.stat().st_mode & 0o077:
        raise ValueError('Signing credentials must be outside the project, owner-readable only')
    return path


def signing_environment():
    path = private_file(os.environ.get('MAUTIC_ANDROID_SIGNING_FILE', PRIVATE / 'signing.json'))
    data = json.loads(path.read_text())
    keystore = private_file(data['keystore'])
    if not data.get('alias') or min(len(data.get(k, '')) for k in ('storePassword', 'keyPassword')) < 20:
        raise ValueError('Invalid upload-key credentials')
    env = os.environ.copy()
    env.update(MAUTIC_UPLOAD_STORE=str(keystore), MAUTIC_UPLOAD_ALIAS=data['alias'],
               MAUTIC_UPLOAD_STORE_PASSWORD=data['storePassword'], MAUTIC_UPLOAD_KEY_PASSWORD=data['keyPassword'])
    return env


def init_key():
    PRIVATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = PRIVATE / 'signing.json'
    keystore = PRIVATE / 'upload.jks'
    if path.exists() or keystore.exists():
        raise ValueError('Existing upload key is preserved; do not regenerate it')
    password = secrets.token_urlsafe(48)
    env = os.environ.copy()
    env['MAUTIC_NEW_UPLOAD_PASSWORD'] = password
    java = Path(env.get('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home'))
    run([java / 'bin/keytool', '-genkeypair', '-keystore', keystore, '-storetype', 'JKS',
         '-alias', 'mautic-inbox-upload', '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
         '-dname', 'CN=Mautic Inbox Upload, OU=Mobile, O=Distribution Machine, C=BR',
         '-storepass:env', 'MAUTIC_NEW_UPLOAD_PASSWORD', '-keypass:env', 'MAUTIC_NEW_UPLOAD_PASSWORD'], env=env)
    keystore.chmod(0o600)
    with path.open('x') as output:
        json.dump({'keystore': str(keystore), 'alias': 'mautic-inbox-upload',
                   'storePassword': password, 'keyPassword': password}, output)
    path.chmod(0o600)
    print('Upload key created outside app source. Preserve an encrypted offline backup before publication.')


def configure_gradle(workspace):
    gradle = workspace / 'android/app/build.gradle'
    text = gradle.read_text()
    marker = '    signingConfigs {\n'
    if text.count(marker) != 1:
        raise ValueError('Unexpected Expo signing configuration')
    signing = '''        playUpload {
            storeFile file(System.getenv("MAUTIC_UPLOAD_STORE"))
            storePassword System.getenv("MAUTIC_UPLOAD_STORE_PASSWORD")
            keyAlias System.getenv("MAUTIC_UPLOAD_ALIAS")
            keyPassword System.getenv("MAUTIC_UPLOAD_KEY_PASSWORD")
        }
'''
    release_start = text.index('        release {', text.index(marker))
    release = text[release_start:]
    if '        playUpload {' in text:
        if signing not in text or release.count('signingConfig signingConfigs.playUpload') != 1 or 'signingConfig signingConfigs.debug' in release:
            raise ValueError('Unexpected prepared upload signing configuration')
    else:
        if release.count('signingConfig signingConfigs.debug') != 1:
            raise ValueError('Unexpected Expo release signing configuration')
        text = text[:release_start] + release.replace('signingConfig signingConfigs.debug',
                                                     'signingConfig signingConfigs.playUpload', 1)
        text = text.replace(marker, marker + signing)
    if gradle.read_text() != text:
        gradle.write_text(text)
    properties = workspace / 'android/gradle.properties'
    current = properties.read_text()
    for name, value in [('android.compileSdkVersion', '36'), ('android.targetSdkVersion', '36'),
                        ('org.gradle.workers.max', '2'), ('org.gradle.parallel', 'false')]:
        current = '\n'.join(line for line in current.splitlines() if not line.startswith(name + '='))
        current += f'\n{name}={value}\n'
    if current != properties.read_text():
        properties.write_text(current)


def prepare(workspace, reuse=False):
    if workspace.parent not in (Path('/tmp'), Path('/private/tmp')) or not workspace.name.startswith('mautic-inbox-android-'):
        raise ValueError('Use a dedicated /tmp/mautic-inbox-android-* workspace')
    workspace.mkdir(parents=True, exist_ok=True)
    if reuse:
        if not (workspace / 'android/app/build.gradle').is_file():
            raise ValueError('No prepared workspace to refresh')
        for name in ('package-lock.json', 'package.json'):
            if (ROOT / name).read_bytes() != (workspace / name).read_bytes():
                raise ValueError('Dependencies changed; use a clean bundle build')
    args = ['rsync', '-a', '--delete']
    for excluded in ('node_modules', 'android', 'ios', 'artifacts', 'dist', '.expo', '.git', '.env*'):
        args += ['--exclude', excluded]
    run(args + [str(ROOT) + '/', str(workspace) + '/'])
    env = os.environ.copy()
    env.update(CI='1', EXPO_OFFLINE='1', NODE_ENV='production', MAUTIC_APNS_ENVIRONMENT='production')
    if not reuse:
        run(['npm', 'ci', '--include=dev', '--no-audit', '--no-fund'], workspace, env)
    # Never reuse the stale developer native tree from app source.
    run(['./node_modules/.bin/expo', 'prebuild'] + ([] if reuse else ['--clean']) +
        ['--platform', 'android', '--no-install'], workspace, env)
    configure_gradle(workspace)
    return env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init-key', 'prepare', 'bundle', 'refresh-bundle'])
    args = parser.parse_args()
    os.umask(0o077)
    if args.action == 'init-key':
        init_key()
        return
    workspace = Path(os.environ.get('MAUTIC_ANDROID_RELEASE_WORKSPACE', '/tmp/mautic-inbox-android-release')).resolve()
    signing = signing_environment() if args.action in ('bundle', 'refresh-bundle') else None
    env = prepare(workspace, reuse=args.action == 'refresh-bundle')
    if args.action == 'prepare':
        return
    env.update(signing)
    env.setdefault('JAVA_HOME', '/Applications/Android Studio.app/Contents/jbr/Contents/Home')
    env.setdefault('ANDROID_HOME', str(Path.home() / 'Library/Android/sdk'))
    env.update(CI='1', NODE_ENV='production', EXPO_OFFLINE='1', MAUTIC_APNS_ENVIRONMENT='production')
    env['PATH'] = env['JAVA_HOME'] + '/bin:' + env['PATH']
    run(['./gradlew', 'bundleRelease', '--no-daemon', '--max-workers=2',
         '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64'], workspace / 'android', env)
    config = json.loads((ROOT / 'app.json').read_text())['expo']
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if config['version'] != version:
        raise ValueError('Expo/package versions disagree')
    folder = ROOT / 'artifacts/publication/android'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f'Mautic-Inbox-{version}-{config["android"]["versionCode"]}.aab'
    shutil.copy2(workspace / 'android/app/build/outputs/bundle/release/app-release.aab', target)
    print(f'Signed bundle: {target}\nSHA-256: {hashlib.sha256(target.read_bytes()).hexdigest()}')


if __name__ == '__main__':
    main()
