#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
app_version="$(node -p 'require("./package.json").version')"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export NODE_ENV=production
export EXPO_OFFLINE=1
export CI=1
build_dir="$(mktemp -d /tmp/mautic-inbox-android.XXXXXX)"
printf 'Build workspace: %s\n' "$build_dir"
rsync -a --exclude node_modules --exclude android --exclude ios --exclude artifacts --exclude dist --exclude .expo --exclude .git "$root/" "$build_dir/"
cd "$build_dir"
# Keep Metro dependencies inside the build workspace, without symlinks.
npm ci --include=dev --no-audit --no-fund
./node_modules/.bin/expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a)
mkdir -p "$root/artifacts"
cp android/app/build/outputs/apk/release/app-release.apk "$root/artifacts/Mautic-Inbox-v${app_version}.apk"
