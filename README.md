# Mautic Inbox

## Your support desk. Wherever you are.

**Bring your Mautic conversations to your phone.** Reply with the history at hand, follow social comments and explore campaigns and contacts with an assistant connected to your installation.

![Mautic Inbox: conversations, comments and an assistant connected to your Mautic](docs/media/hero.png)

Built for customer-facing teams that need to keep an eye on their queue away from the computer. On iPhone, iPad and Android, your Mautic goes with you.

**[Follow the launch and upcoming releases](https://github.com/raphaelcangucu/mautic-inbox-mobile/releases)** · [Privacy and support](https://mautic-inbox-privacidade-e-suporte.me-21d3.chatgpt.site/)

### More context for every reply

- **See what needs attention.** Bring your connected channels together and filter the queue by channel, assignee and status. WhatsApp, Instagram, Facebook and WebChat share the same support workflow.
- **Pick up where you left off.** Read the history, add internal notes and use saved replies. Local history and drafts help you continue your work as you move between screens.
- **Ask your Mautic.** Explore campaigns, contacts and installation information with the assistant, using your account permissions and explicit consent before sharing data with the AI provider.
- **Find the right contact.** Search by name, email or phone. Combine segment and campaign filters, then open a WhatsApp QR conversation when the contact has a valid phone number and an active connection is available.
- **Keep comments in the conversation.** Follow Instagram and Facebook comments, mark spam and organize moderation in the support queue. Blocking an author in the queue does not block their social media profile.
- **Switch between your Mautics.** Add installation URLs, sign in to your accounts and keep sessions separate. Receive notifications sent by the installation you connected.

### See the app in action

<table>
  <tr>
    <td align="center" width="33%"><a href="docs/media/01-conversas.png"><img src="docs/media/01-conversas.png" width="250" alt="Conversation queue with channel, assignee and status filters" /></a><br /><strong>Your queue, in view</strong></td>
    <td align="center" width="33%"><a href="docs/media/02-chat.png"><img src="docs/media/02-chat.png" width="250" alt="Compact chat with conversation history and actions next to the message input" /></a><br /><strong>Reply with context</strong></td>
    <td align="center" width="33%"><a href="docs/media/03-assistente.png"><img src="docs/media/03-assistente.png" width="250" alt="Connected assistant for exploring campaigns and contacts" /></a><br /><strong>Ask your Mautic</strong></td>
  </tr>
</table>
<table>
  <tr>
    <td align="center" width="50%"><a href="docs/media/04-comentarios.png"><img src="docs/media/04-comentarios.png" width="250" alt="Instagram and Facebook comments in the support queue" /></a><br /><strong>Follow your community</strong></td>
    <td align="center" width="50%"><a href="docs/media/05-conexoes.png"><img src="docs/media/05-conexoes.png" width="250" alt="Connections screen for switching between Mautic installations" /></a><br /><strong>Your Mautics, one app</strong></td>
  </tr>
</table>

*Native iOS screens with demo data. Click an image to see the details. Available in English, Portuguese and Spanish, with light and dark themes. Messages and contact names keep their original language.*

### Bring mobile support to your team

1. Use a Mautic installation with the [compatible Inbox Mobile API](https://github.com/raphaelcangucu/mautic-inbox-bundle).
2. Connect your installation URL and sign in with an authorized account.
3. Follow the queue and reply through the channels enabled for your account.

The app is free. Channels, assistant, moderation and notifications depend on your installation settings and user permissions.

### Get the app

| Platform | Public availability |
| --- | --- |
| iPhone and iPad · App Store | Coming soon — the submitted version is awaiting Apple's review. |
| Android · Google Play | Coming soon — a public download link has not been confirmed yet. |

Official download links will be added once the app is available in the stores. Until then, **[follow releases on GitHub](https://github.com/raphaelcangucu/mautic-inbox-mobile/releases)** or build the app from the source in this repository.

<details>
<summary><strong>For developers: setup, build and release</strong></summary>

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

## Explicit test mode

Real connections always use their API and local real-data cache. API failures never switch to fictional data. On a phone, shake only on the **Connections** screen, enable test connections, then select a clearly marked mocked account. The app shows a persistent mock banner and hides test mode again after restarting. Demo tools and simulated notifications stay out of normal connections. See [test-mode behavior](docs/TEST-MODE.md).

## Internal assistants and user permissions

Configure an **Internal assistant** in the Mautic **Agents** screen, select its tools and authorize the existing user roles. Its MCP connection uses the current Mautic account. Effective tools are the configured selection intersected with the user's permissions; the server also enforces access to each contact, campaign and conversation. Customer-facing agents keep their separate channel workflow.

The app lists only authorized assistants and stores history separately for each account and agent. Users without access still see the Assistant tab, which shows restricted access and no composer. An API failure never enables a cached or demo assistant. This release supports read-only tools; assistant-driven sending or moderation requires a separate execution flow.

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

Git release tags use **`vMAJOR.MINOR.PATCH`**, for example `v1.0.0`, `v1.0.1` and `v1.0.2`. Do not append TestFlight, build numbers or distribution channels to tag names. Keep those details in release metadata and PR descriptions. Advance the semantic version for each subsequent release.

```sh
bundle exec fastlane ios archive
bundle exec fastlane ios internal_testflight
bundle exec fastlane android bundle
```

Provide private credentials through environment variables listed in `.env.example`, with their actual files outside the repository and owner-only permissions. iOS also requires an existing distribution certificate/profile in the local signing environment. APNs provider keys stay on the Mautic server; they never belong in the app. Existing app identifiers and build numbers are preserved. Increase build numbers before a new store binary upload.

Publication metadata, localized headlines, asset-generation scripts and selected public product images are versioned. Full capture sets, release evidence, videos, signed binaries and review-account instructions are generated or supplied locally and are not committed. Store-upload gates fail until current-build captures and visual/physical validation are supplied; cloning this repository does not invent release approval.

For subsequent listing updates, see [the asset publication workflow](docs/ASSETS-PUBLICACAO-PROXIMAS-VERSOES.md). `ios store_listing` cannot overwrite a version under active Apple review. Submission remains a separate action.

## Repository scope

This repository contains app source, runtime assets, pinned dependency lockfiles, unit tests, build/release tooling and public listing text. Local review environments, internal QA history, cached dependencies and generated native projects are excluded. Never commit credentials, signing keys, authentication tokens, customer data or release binaries.


</details>
