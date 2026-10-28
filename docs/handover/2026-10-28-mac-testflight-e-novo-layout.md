# Handover: continuar no Mac (TestFlight da 1.1.1 e novo layout)

Estado em 28/10/2026. O canal de e-mail foi testado de ponta a ponta num Android físico contra a produção. As correções saíram nas tags abaixo, e o novo layout do app foi aprovado. No Mac, os próximos passos são:
1. Publicar a 1.1.1 no TestFlight interno.
2. Implementar o novo layout como 1.2.0.
3. Publicar a 1.2.0 no TestFlight.

## 1. Onde está tudo

| Repositório | Branch | PR | Tag atual | Observação |
|---|---|---|---|---|
| mautic-inbox-mobile | `feat/canal-email` | raphaelcangucu/mautic-inbox-mobile#11 | `v1.1.1` | 1.1.1 (Android 19, iOS 44) |
| mautic-inbox-bundle | `feat/canal-email` | raphaelcangucu/mautic-inbox-bundle#21 | `v1.9.1` | |
| mautic-multi-mail-bundle | `feat/canal-email` | raphaelcangucu/mautic-multi-mail-bundle#3 | `v0.5.1` | |
| mautic-meta-bundle | `feat/canal-email` | raphaelcangucu/mautic-meta-bundle#3 | `v0.15.1` | |

- As tags anteriores (`v1.1.0`, `v1.9.0`, `v0.5.0`, `v0.15.0`) continuam onde estavam. Correção depois de uma tag publicada ganha tag nova de patch; tag publicada não se move.
- O handover do canal de e-mail, com o roteiro do teste real, está em `mautic-inbox-bundle/docs/superpowers/handover/2026-10-25-canal-email-macos.md`.
- O design aprovado está em `docs/design/2026-10-novo-layout/` neste repositório: README com tokens e correspondência tela → código, `png/` e `html/index.html`.

## 2. Preparar o Mac

```bash
git clone git@github.com:raphaelcangucu/mautic-inbox-mobile.git
cd mautic-inbox-mobile && git checkout feat/canal-email
nvm install 22.22.2 && nvm use 22.22.2
npm ci --include=dev
bundle install
```

- **Requisitos:** Xcode e CocoaPods (via Bundler).
- **Certificado:** "Apple Distribution: Raphael Cangucu (SB6QYUH97U)" no Keychain.
- **Perfil:** um perfil App Store de `com.distributionmachine.mauticinbox.demo`.
- **Credenciais:** ficam fora do repositório. Copie `.env.example` para um arquivo privado (por exemplo `~/.config/mautic-inbox/release.env`, `chmod 600`) e preencha `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_PATH` (a chave `.p8`, também `chmod 600` e fora do projeto) e `IOS_PROVISIONING_PROFILE_NAME`. Carregue com `set -a; source ~/.config/mautic-inbox/release.env; set +a`.
- **Primeira compilação:** o iOS da 1.1.0/1.1.1 ainda não foi compilado. Esta é a primeira compilação nativa do canal de e-mail no iPhone.

## 3. TestFlight interno da 1.1.1

```bash
bundle exec fastlane ios archive
```

O `archive` roda `check` (typecheck, testes JS e Python, preflight) e `prepare`, que monta um workspace limpo em `/tmp/mautic-inbox-release` com APNs de produção. O IPA sai em `artifacts/publication/Mautic-Inbox-1.1.1-44.ipa`.

**Avaliação de criptografia:** o upload exige `artifacts/publication/encryption-assessment.json` com o hash do IPA assinado. Isso é uma declaração de exportação. Confirme com o Raphael antes de gravar `usesNonExemptEncryption: false`, que vale quando o app usa só HTTPS/TLS do sistema, sem criptografia própria.

```bash
python3 - <<'PY'
import hashlib, json, pathlib
ipa = pathlib.Path("artifacts/publication/Mautic-Inbox-1.1.1-44.ipa")
json.dump({"ipaSha256": hashlib.sha256(ipa.read_bytes()).hexdigest(), "version": "1.1.1", "build": "44",
           "usesNonExemptEncryption": False}, open("artifacts/publication/encryption-assessment.json", "w"), indent=2)
PY
IOS_IPA_PATH=artifacts/publication/Mautic-Inbox-1.1.1-44.ipa bundle exec fastlane ios internal_testflight
```

- **Escopo:** o envio é só para testadores internos, sem distribuição externa.
- **Número de build:** se o App Store Connect recusar o 44 por já existir, suba `ios.buildNumber` em `app.json`, faça commit e gere de novo.
- **Texto do TestFlight:** o changelog fixo no `Fastfile` fala de atendimento multicanal. Se quiser citar o canal de e-mail, mude o texto ali antes do upload.

**No iPhone, depois do TestFlight:**
- Entre com o código mágico.
- Siga o roteiro do teste real do handover do canal de e-mail: abrir pela ficha do contato, enviar com pesquisa, responder pela caixa reports@ e conferir a thread.
- No iOS, o "Ver original" abre no Safari View Controller. O problema da aba antiga era só do Android.

## 4. Novo layout (1.2.0)

Siga `docs/design/2026-10-novo-layout/README.md`. Ele traz:
- tokens de cor, tipografia, forma e componentes;
- a tela correspondente no código para cada PNG;
- a ordem sugerida, que começa pelos componentes base em `src/theme.ts` e `src/components/ui.tsx`.

Regras:
- **Mudança visual:** o comportamento continua o mesmo, a não ser nos pontos marcados como fora do que o app faz hoje no README.
- **Testes:** o Maestro usa `testID`; mantenha os existentes ou atualize os fluxos em `e2e/flows/`. Rode `npm test` e `npm run typecheck` a cada etapa.
- **Fonte:** o peso 800 da Manrope não está em `assets/fonts`. Adicione `manrope-800.ttf` com a licença em `assets/fonts/LICENSE_FONT`, ou use 700.
- **Tema escuro:** não foi desenhado. Derive dos papéis de cor e confira no aparelho.
- **Fechar a versão:** quando terminar, suba para 1.2.0 (`package.json`, `package-lock.json`, `app.json` com `buildNumber` 45 e `versionCode` 20), crie a tag `v1.2.0` e publique no TestFlight como no passo 3.

## 5. Pendências fora do Mac

- **Deploy do Inbox 1.9.1 em produção:** ainda não foi feito. Leva o status de falha do bounce e o idioma das páginas públicas. Os pacotes e o script estão no PC Windows (WSL): `bash ~/.cc/remote/ship.sh`, que faz backup do banco e dos plugins antes. Precisa do OK do Raphael. A correção da resposta duplicada (Multi Mail) e a dos parênteses (Inbox) já estão em produção desde 25/10.
- **Android físico:** instalar `Mautic-Inbox-1.1.1-arm64.apk` (no PC Windows, em `C:\Users\raphaelcangucu\code\mautic\artifacts-canal-email\`) por cima da 1.1.0, sem perder o login. Depois, conferir que o cartão fantasma sumiu e que o teclado aberto não cobre o compositor.
- **Dados de teste em produção:** o lead #5170 e a conversa #448. Apagar pelo Mautic quando não precisar mais.
- **Testes do Meta:** `MetaSetupServiceTest` (mock de classe `final`) e `IdentityManagerTest::testRejectsContactOnMauticDnc` já falhavam na v0.14.2; não são do canal de e-mail.
- **Merge:** ordem Meta → Multi Mail → Inbox → app, com merge commit para as tags ficarem no histórico da `main`.
