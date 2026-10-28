# Novo layout mobile (aprovado em 28/10/2026)

Proposta para o app deixar de parecer página web e seguir os padrões nativos (Material 3 no Android, adaptado ao iOS). Aprovada pelo Raphael em 28/10/2026. São 18 telas de 390 × 844.

- **Canvas original (Claude Design):** https://claude.ai/artifact/233qVmaPu8UuApE7UQBMP3. É privado; só abre com a conta do Raphael.
- **Galeria navegável sem o canvas:** abra `html/index.html` num navegador. Cada tela é um protótipo clicável, ligado às outras como no canvas.
- **Imagens 2x (780 × 1688):** `png/`. Use estas como referência visual ao implementar.
- **Fontes do canvas:** `source/` (`*.dc.html` e `canvas.json`). Só renderizam dentro do canvas; para editar o design, publique de volta no artifact.

## Telas e onde ficam no app

| Tela (png) | O que mostra | Código atual |
|---|---|---|
| `Main` | Login: endereço do Mautic com `https://` fixo e contas salvas no aparelho | `src/screens/More.tsx` (`Connection`) |
| `Login-Codigo` | Código de 6 dígitos em caixas, reenviar com contagem, login pelo navegador como alternativa | `src/screens/More.tsx`, `src/api/magic-code.ts`, `src/api/auth.ts` |
| `Conversas` | Lista: título grande, abas Conversas/Comentários, chips roláveis, linhas sem cartão, selo do canal no avatar, arrastar para o lado, FAB "Nova conversa", barra inferior Material 3 | `src/screens/Inbox.tsx` |
| `Filtros` | Folha inferior: fila (segmentado), situação (chips), canais (lista com contagem), "Mostrar N conversas" | `src/screens/Inbox.tsx` |
| `Busca` | Busca: resultados separados em "Conversas" e "Contatos no Mautic", com "Iniciar" | `src/screens/Inbox.tsx` |
| `Comentarios` | Aba Comentários: aviso do assistente sobre spam, chips, comentários agrupados por publicação, ações rápidas | `src/screens/Inbox.tsx`, `src/components/BulkModeration.tsx` |
| `Chat` | WhatsApp: cabeçalho compacto, balões com cauda, eventos em linha pequena, respostas prontas em chips, compositor em pílula | `src/screens/Chat.tsx`, `src/components/ChatMessage.tsx`, `VoiceComposer.tsx` |
| `Email` | E-mail estilo Gmail: assunto no conteúdo, mensagens separadas por linhas finas, anexo em uma linha, respostas do formulário em lista, Responder/Encaminhar no fim | `src/screens/EmailThread.tsx`, `src/components/EmailCard.tsx` |
| `NovaConversa` | Buscar contato no CRM com filtros de segmento/campanha e conversas recentes | `src/components/ContactDirectory.tsx`, `src/components/CrmAutocomplete.tsx` |
| `Canal` | Folha "Por onde você quer falar?" com o que acontece em cada canal; canal indisponível apagado com o motivo | `src/api/contact-channels.ts`, sheet de canais em `src/screens/More.tsx` |
| `Modelo` | Modelo do WhatsApp com prévia no estilo do WhatsApp e variáveis preenchidas | `TemplateSheet` em `src/screens/Chat.tsx` |
| `NovoEmail` | Novo e-mail: De/Para/Assunto, formulário como cartão no texto, atalhos Resposta pronta, Formulário, Rascunho com IA | `src/screens/EmailCompose.tsx` |
| `Contatos` | Aba Contatos: busca em pílula, filtro de segmento, lista A–Z com etiqueta de etapa | `src/screens/More.tsx` (`Contacts`) |
| `Contato` | Ficha: foto e nome em destaque, 4 atalhos, canais, dados do Mautic | `src/screens/More.tsx` (`Contact`) |
| `Acoes` | Ações da conversa: Resolver, Adiar (com atalhos de horário), Transferir, Não lida; agente de IA; spam em vermelho | `src/components/ConversationActions.tsx` |
| `Assistente` | Resposta com lista clicável, sugestões, seletor de assistente | `src/screens/Assistant.tsx` |
| `Conta` | "Disponível para atender" em destaque, conexões, tema, idioma, diagnóstico, sair | `src/screens/More.tsx` (`Accounts`, `Preferences`, `Diagnostics`) |
| `Notificacoes` | Central de avisos em Hoje/Ontem, não lidas destacadas | `src/screens/More.tsx` (`NotificationsScreen`) |

**Fora do que o app faz hoje** (precisa de decisão ou de servidor): busca no texto das mensagens (a tela `Busca` mostra só nome e contato, que é o que existe); "Ligar" na ficha do contato abre o discador do sistema; arrastar para o lado na lista é gesto novo.

## Tokens

O design não trocou a marca: mesmo azul e mesma fonte. O que muda é a hierarquia, o espaço e os componentes.

### Cores (tema claro)

| Papel | Cor |
|---|---|
| Primária | `#1F3C88` (pressionada `#16306E`) |
| Contêiner da primária (chip ativo, indicador da barra, FAB) | `#DCE4F7`, texto `#16306E` |
| Tons suaves da primária | `#E8EDF8`, `#EEF2FA`, `#F1F4FA`, `#F5F8FF` |
| Texto | `#141A26`; secundário forte `#3A4354`; secundário `#5E6779` |
| Superfícies | `#FFFFFF`; agrupada e barra inferior `#F6F8FC`; fundo do chat `#F3F5F9`; campo preenchido `#F1F3F7`; chip neutro `#EEF1F6` |
| Bordas | contorno `#D5DBE6`; divisória `#E6E9F0` / `#EEF1F6`; contorno azul `#C9D3EA`; desmarcado `#8A93A3` |
| Sucesso | `#1E7A46`, contêiner `#E3F4EA`, texto `#1E6B3E` |
| Atenção | `#B4590F`, contêiner `#FBEEDD`, texto `#8A4B0F`; ponto urgente `#C2410C` |
| Perigo | `#B42318`, contêiner `#FDECEA` |
| Destaque de busca | `#FFF1C2` |
| Véu das folhas | `rgba(15, 20, 32, 0.46)` |
| Canais (só no selo e ícones) | WhatsApp `#1E8E4E`, Instagram `#C1356F`, Messenger `#2F6FDB`, Chat do site `#4A5568`, E-mail `#B4590F` |

O tema escuro não foi desenhado. Derive dos mesmos papéis (superfície escura, primária mais clara para contraste 4.5:1) e confira no aparelho.

### Tipografia (Manrope)

| Uso | Tamanho / linha / peso |
|---|---|
| Título grande da aba | 30 / 36 / 800, tracking −0.5 |
| Título de tela, folha, e-mail | 20–22 / 28 / 800 |
| Nome na lista | 16 / 800 se não lida, 600 se lida |
| Corpo de mensagem | 15 / 21–23 / 400 |
| Secundário | 13–14 / 400–600 |
| Meta (hora, rótulos) | 11–12 / 600–800 |
| Rótulo de seção | 13 / 700–800, cor `#3A4354` |

O app carrega Manrope 400, 600 e 700 (`src/theme.ts`). O peso 800 dos títulos precisa do arquivo `manrope-800.ttf` em `assets/fonts`, ou use 700.

### Forma e espaço

- **Raios:** chips 10; botões 14 (primário com 52 de altura); pílulas 17–24; cartões e grupos 16–18; folhas 28 no topo; balões 18 com o canto da cauda 6; avatares redondos.
- **Margens:** 16 na lista e nos grupos, 20–24 em títulos e formulários. Linha da lista com 10 × 16 de respiro.
- **Toque:** botões de ícone de 48 × 48; nada clicável abaixo de 44.

### Componentes

- **Barra superior** com 56 (64 na conversa) e título grande abaixo, nas abas principais.
- **Abas** sublinhadas, com barra de 3 px.
- **Chips de filtro** com 36 de altura e rolagem horizontal. O ativo tem fundo `#DCE4F7` e ✓, e o primeiro chip abre a folha de filtros com o número de filtros ativos.
- **Linha de conversa** com avatar de 48 e selo do canal de 22 (borda branca de 2). Quando não lida, o nome e a hora ficam em negrito e aparece o contador azul de 20.
- **FAB estendido** com 56 de altura, raio 16 e cor da primária-contêiner.
- **Barra inferior** com 80 de altura e indicador em pílula de 60 × 32 no item ativo, com badge.
- **Folha inferior** com alça de 36 × 4, raio 28 e véu escuro.
- **Segmentado** com 40 de altura; interruptor de 48 × 28; blocos de ação rápida de 76 de altura.
- **Compositor** com botão "+" redondo de 44, campo em pílula de 44 e botão principal redondo de 48.

## Ordem sugerida de implementação

1. Tokens e componentes base em `src/theme.ts` e `src/components/ui.tsx`: cores, tipografia, chips, linha de lista, folha inferior, barra inferior e FAB.
2. Lista de conversas, filtros e busca.
3. Conversa (WhatsApp e demais canais) e conversa de e-mail.
4. Iniciar conversa: busca de contato, canal, modelo e novo e-mail.
5. Contatos e ficha, ações da conversa, comentários, assistente, conta e notificações.
6. Login.

Em cada etapa, compare com o PNG da tela, rode `npm test` e `npm run typecheck`, e atualize os fluxos Maestro em `e2e/flows/` quando um `testID` mudar.
