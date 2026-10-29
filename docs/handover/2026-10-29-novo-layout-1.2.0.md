# Handover: novo layout 1.2.0

Estado em 29/10/2026. As seis etapas do `docs/design/2026-10-novo-layout/README.md` estão
implementadas, validadas contra a API de produção e gravadas em vídeo. Nada foi publicado:
não houve envio ao TestFlight nem deploy.

## O que está pronto

| Etapa | Commit |
|---|---|
| Tokens e componentes base | `34110ba` |
| Lista de conversas e o arrastar para o lado | `cea7ece` |
| Folha de filtros unificada e tela de busca | `3c28c65` |
| Chat e thread de e-mail | `0548745` |
| Folha de canais e diretório de contatos | `93ad0d2` |
| Blocos de ação rápida | `5a91b93` |
| Botões e campos | `e062f90` |
| Central de avisos e ficha de contato | `e2dcd32` |
| Tema de três estados | `1a8f411` |
| Pílula do agente e chips de adiar | `7157183` |
| Respostas prontas e ações dos comentários | `bbeba33` |
| Agrupamento por publicação | `263c5d2` |
| "Não é spam" na linha do comentário | `16f3363` |

191 testes e `tsc --noEmit` passam em cada etapa.

## Decisões que valem saber

- **Tokens remapeados, não renomeados.** Os nomes antigos (`c.blue`, `c.line`) apontam para a
  cor nova, então as 18 telas migraram sem edição individual.
- **Manrope 800 cai no 700**, alternativa que o próprio README autoriza. O `.ttf` do peso 800
  não existe nesta máquina; `font.heavy` é o ponto único de troca se ele for adicionado.
- **Tema escuro derivado, não desenhado.** Vale conferir no aparelho.
- **`themeChoice` separado de `theme`.** A escolha (Sistema/Claro/Escuro) é persistida; `theme`
  continua sendo sempre `light` ou `dark`, então nenhuma tela precisou mudar.

## Defeitos que só a API real revelou

1. **Gravatar genérico no lugar das iniciais.** `AvatarHelper::getAvatar` do Mautic cai no
   Gravatar do e-mail do contato, que devolve um boneco quando não há foto. O app pede `d=404`
   e cai nas iniciais (`src/api/avatar.ts`). O mesmo vale para o inbox web, que mostra o mesmo
   boneco: corrigir na origem seria em `InboxQuery.php:386`.
2. **Avatar vazio** enquanto a imagem carregava ou falhava. As iniciais passaram a ser a camada
   de baixo, com a foto por cima.
3. **Voltar do chat sem `testID`.** Só a thread de e-mail tinha, e o fluxo ficava preso em
   conversas de WhatsApp.
4. **Pisca-pisca na rolagem.** O `onScroll` gravava a posição no store a cada 160 ms e
   re-renderizava a tela inteira; agora fica num `ref` e é persistida ao sair.
5. **`restore` inalcançável.** O servidor sempre aceitou `spam`, `restore`, `block`, `unblock`,
   `hide` e `show`; o tipo no app listava um subconjunto sem o `restore`.

## Fotos de perfil, por canal (medido em produção)

| Canal | Recebidas | Com foto |
|---|---|---|
| WhatsApp | 224 | 0 |
| Instagram | 210 | 7 |
| Facebook | 191 | 9 |
| Web Chat | 90 | 0 |
| E-mail | 5 | 0 |

A API da Meta não envia foto de contato de WhatsApp, nem pelo canal homologado nem pelo QR:
as iniciais são a única informação disponível. As fotos de Facebook e Instagram chegam como
URLs assinadas `platform-lookaside.fbsbx.com`, que **expiram** — uma testada em 28/10 devolveu
HTTP 404. Guardá-las em WebP no servidor foi aprovado pelo Raphael e ainda não foi feito.

## Vídeo e2e

`artifacts/qa/api-real/api-real-1.2.0.mp4`, 48s, `1/1 Flow Passed`, contra
`mkt-macro.on-forge.com`. O fluxo (`e2e/flows/api-real.yaml`) é **somente leitura**: nunca envia,
assume, resolve, adia nem transfere, para não alterar conversas de cliente numa gravação.

O build de e2e usa `EXPO_PUBLIC_MAUTIC_E2E_DEMO=1` para abrir a conta mockada sem o gesto de
balançar, que nenhum simulador iOS injeta. Sem a variável nada muda, e o build de loja continua
exigindo o gesto.

## Pendente, aguardando decisão

- **"Disponível para atender"** (tela Conta): não existe endpoint de presença de atendente na
  API — confirmado buscando `availab`, `presence`, `online` e `away` no bundle. Um interruptor
  só local diria ao operador que ele está indisponível enquanto o servidor segue distribuindo.
- **Cache de fotos em WebP** no `mautic-inbox-bundle`: aprovado, não iniciado.

O **"Ligar"** foi implementado: o bloco aparece na ficha quando há telefone (do CRM ou, no
WhatsApp, do próprio destinatário) e abre o discador do sistema com `tel:`. O app entrega o
número; quem disca é o aparelho, e nada é enviado.

## Versão

`package.json`, `app.json` e a tag `v1.2.0` foram criados em `e062f90`. Treze commits vieram
depois. Como a tag nunca foi publicada em lugar nenhum, há duas saídas limpas: recriá-la no
estado atual, ou deixá-la onde está e marcar o estado atual como `v1.2.1`. A regra do projeto
— tag publicada não se move — favorece a segunda.
