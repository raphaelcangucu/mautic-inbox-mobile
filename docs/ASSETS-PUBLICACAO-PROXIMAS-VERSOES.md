# Assets e texto nas próximas publicações iOS

O Fastlane usa a coleção de produto como padrão da lane `ios store_listing`: screenshots com headlines, subtítulo, descrição, texto promocional e palavras-chave, em pt-BR, en-US e es-ES. URLs, notas de versão e copyright vêm dos arquivos existentes em `fastlane/metadata`.

Headline principal em português: **Seu atendimento. Onde você estiver.**
Subtítulo da loja: **Conversas, equipe e assistente**.
Fonte única dos textos e headlines: `fastlane/product-assets-ios/copy.json`.

## Fluxo

1. Atualizar versão/build e notas de versão. Capturar a interface nativa desse build nos simuladores iPhone e iPad, com dados de demonstração identificados, e atualizar `fastlane/screenshots/manifest.json` com a proveniência real.
2. Executar `bundle exec fastlane ios product_assets`. Compila o compositor Swift e gera 30 screenshots, seis banners, prévias, metadata e ZIP em `artifacts/publication/product-assets-ios-BUILD/`.
3. Inspecionar as seis prévias por idioma/aparelho e os seis banners, inclusive alinhamento, legibilidade e telas reais. Registrar a revisão em `fastlane/product-assets-ios/reviewed-BUILD.json`, com versão, build, `copySha256` do arquivo de textos e mapa `images` de caminho relativo → SHA-256 de todas as 36 imagens. O registro do build 24 é um exemplo de inspeção já realizada. Não copiar o registro para outro build ou registrar revisão sem olhar as imagens.
4. Executar novamente `bundle exec fastlane ios product_assets` para incorporar a revisão. Conferir `python3 scripts/package-ios-product-assets.py --check`.
5. Quando a próxima versão estiver editável na Apple, executar `bundle exec fastlane ios store_listing` com as credenciais privadas já configuradas. Essa lane gera/verifica os assets e envia somente metadata e screenshots. Banners sociais não são enviados como screenshots. Não envia binário nem submete a revisão.
6. Seguir as verificações do build e do aparelho físico antes da lane separada `ios app_store_review`.

Qualquer mudança de texto, pixels, fonte nativa, versão ou build invalida o registro anterior. As capturas devem corresponder ao build destinado à loja. O upload rejeita versões em `WAITING_FOR_REVIEW`, `IN_REVIEW` e outros estados não editáveis, antes de mudar instruções ou imagens. A ficha da versão atualmente em análise permanece intacta.

## Verificação local

A geração não usa bancos, APIs ou aparelho físico. Os testes cobrem revisão visual ausente, alteração de headline/imagem, outra versão/build, imagem faltante e estados Apple bloqueados. O manifesto e a validação conferem hashes da captura nativa, composição, resolução, quantidade, idiomas e textos usados na publicação.
