# Mautic Inbox Mobile

Native multichannel support client for Mautic, built with Expo, React Native and TypeScript. Supports iOS and Android, conversations, social comments, contacts, assistant, multiple connections and direct native push. UI languages: Portuguese, English and Spanish.

The server integration is maintained separately in [Mautic Inbox Bundle](https://github.com/raphaelcangucu/mautic-inbox-bundle). Live channels and assistant access require a compatible Mautic installation and the user's permissions. Demo mode uses local fictional data.

## Install and verify

Use Node.js 22.22.2 or compatible, Python 3.10+, and Ruby with Bundler for Fastlane. Native iOS builds require macOS/Xcode/CocoaPods. Android builds require Android SDK 36 and Java 17+.

```sh
npm ci --include=dev
npm run typecheck
npm test
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
bundle install
bundle exec ruby fastlane/tests/review_draft_test.rb
bundle exec ruby fastlane/tests/listing_guard_test.rb
```

## Native builds

`ios/` and `android/` are generated from `app.json`, `app.config.cjs` and `plugins/`; generated projects are deliberately untracked. Icon, fonts and sample media under `assets/` are referenced by the app and required to build.

```sh
npm run ios
npm run android
# Release simulator/device archive without distribution signing
npm run build:ios
# Local Android APK (not a Play-signed distribution)
npm run build:apk
```

The build scripts create isolated temporary workspaces and keep outputs in ignored `artifacts/`. JavaScript bundles can be verified without signing via `npx expo export --platform ios --platform android`.

## Signed release with Fastlane

```sh
bundle exec fastlane ios archive
bundle exec fastlane ios internal_testflight
bundle exec fastlane android bundle
```

Provide private credentials through environment variables listed in `.env.example`, with their actual files outside the repository and owner-only permissions. iOS also requires an existing distribution certificate/profile in the local signing environment. APNs provider keys stay on the Mautic server; they never belong in the app. Existing app identifiers and build numbers are preserved. Increase build numbers before a new store binary upload.

Publication metadata, localized headlines and asset-generation scripts are versioned. Screenshots, evidence, videos, signed binaries and review-account instructions are generated or supplied locally and are not committed. Store-upload gates fail until current-build captures and visual/physical validation are supplied; cloning this repository does not invent release approval.

For subsequent listing updates, see [the asset publication workflow](docs/ASSETS-PUBLICACAO-PROXIMAS-VERSOES.md). `ios store_listing` cannot overwrite a version under active Apple review. Submission remains a separate action.

## Repository scope

This repository contains app source, runtime assets, pinned dependency lockfiles, unit tests, build/release tooling and public listing text. Local review environments, internal QA history, cached dependencies and generated native projects are excluded. Never commit credentials, signing keys, authentication tokens, customer data or release binaries.
