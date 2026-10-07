fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## Android

### android init_upload_key

```sh
[bundle exec] fastlane android init_upload_key
```

Create a dedicated private upload key once; never replaces an existing key

### android check

```sh
[bundle exec] fastlane android check
```

Validate source and release tooling without a device or production database

### android prepare

```sh
[bundle exec] fastlane android prepare
```

Fresh Expo prebuild in a dedicated Android workspace; no emulator

### android bundle

```sh
[bundle exec] fastlane android bundle
```

Build a signed AAB and audit manifest, signature and 16KB native libraries

### android refresh_bundle

```sh
[bundle exec] fastlane android refresh_bundle
```

Refresh Expo configuration and build with unchanged locked dependencies in the prepared workspace

### android credentials

```sh
[bundle exec] fastlane android credentials
```

Validate actual package access, tracks and bundle codes using a temporary uncommitted Play edit

### android device_apk

```sh
[bundle exec] fastlane android device_apk
```

Export a signature-verified APK from the audited AAB for the physical Android device

### android internal_draft

```sh
[bundle exec] fastlane android internal_draft
```

Upload only to the internal track as a draft; never sends a production release

### android internal_test

```sh
[bundle exec] fastlane android internal_test
```

Distribute the audited bundle to internal testers after Play onboarding is complete

### android activate_internal_draft

```sh
[bundle exec] fastlane android activate_internal_draft
```

Activate the existing internal draft without re-uploading its version code

### android listing_text

```sh
[bundle exec] fastlane android listing_text
```

Upload Android listing text only; screenshots and release remain separate

### android listing_assets

```sh
[bundle exec] fastlane android listing_assets
```

Upload reviewed native Android screenshots, branding and listing text; no binary or production release

### android verify_listing

```sh
[bundle exec] fastlane android verify_listing
```

Read back committed Play listing text and image hashes; does not publish or upload

----


## iOS

### ios review_access

```sh
[bundle exec] fastlane ios review_access
```

Save the restricted review account and WebChat instructions without submitting

### ios check

```sh
[bundle exec] fastlane ios check
```

Validate app and release configuration without accessing Mautic production data

### ios prepare

```sh
[bundle exec] fastlane ios prepare
```

Prepare a separate native workspace with production APNs configuration

### ios archive

```sh
[bundle exec] fastlane ios archive
```

Archive and export an Apple-signed production build; no upload or automatic signing mutations

### ios internal_testflight

```sh
[bundle exec] fastlane ios internal_testflight
```

Upload the signed and verified build to internal TestFlight, without external distribution

### ios product_assets

```sh
[bundle exec] fastlane ios product_assets
```

Generate localized headlines, metadata and artwork from the current native captures

### ios store_listing

```sh
[bundle exec] fastlane ios store_listing
```

Upload reviewed product artwork and localized metadata only to an editable version

### ios app_store_review

```sh
[bundle exec] fastlane ios app_store_review
```

Submit an existing processed build only after documented physical push and flow validation

### ios review_status

```sh
[bundle exec] fastlane ios review_status
```

Read Apple's version and review state without submitting, releasing or changing metadata

### ios release

```sh
[bundle exec] fastlane ios release
```

Build, verify and upload to internal TestFlight; App Store review remains separate

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
