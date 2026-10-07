#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
app_version="$(node -p 'require("./package.json").version')"
export NODE_ENV=production
# CocoaPods and Expo scripts require a workspace without spaces on this toolchain.
build_dir="$(mktemp -d /tmp/mautic-inbox-ios.XXXXXX)"
printf 'Build workspace: %s\n' "$build_dir"
rsync -a --exclude node_modules --exclude android --exclude ios --exclude artifacts --exclude dist --exclude .expo --exclude .git "$root/" "$build_dir/"
cd "$build_dir"
# Keep Metro dependencies inside the build workspace, without symlinks.
npm ci --include=dev --no-audit --no-fund
./node_modules/.bin/expo prebuild --platform ios --no-install
(cd ios && pod install)
mkdir -p "$root/artifacts"
xcodebuild -workspace ios/MauticInbox.xcworkspace -scheme MauticInbox -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$build_dir/derived-simulator" CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=YES > "$root/artifacts/build-ios.log" 2>&1
xcodebuild archive -workspace ios/MauticInbox.xcworkspace -scheme MauticInbox -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath "$build_dir/derived-device" -archivePath "$build_dir/MauticInbox-unsigned.xcarchive" CODE_SIGNING_ALLOWED=NO > "$root/artifacts/archive-ios.log" 2>&1
cd "$build_dir/derived-simulator/Build/Products/Release-iphonesimulator"
ditto -c -k --keepParent MauticInbox.app "$root/artifacts/Mautic-Inbox-iOS-Simulator-v${app_version}.zip"
cd "$build_dir"
ditto -c -k --keepParent MauticInbox-unsigned.xcarchive "$root/artifacts/Mautic-Inbox-iOS-Unsigned-v${app_version}.zip"
printf 'Artifacts generated in %s/artifacts. Unsigned archive requires Apple signing for device installation.\n' "$root"
