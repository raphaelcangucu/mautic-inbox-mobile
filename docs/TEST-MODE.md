# Modo de teste explícito

No aplicativo mobile, o acesso aos mocks fica oculto. Na tela **Conexões**, balançar o celular abre **Modo de teste**. Tocar em **Mostrar conexões mockadas** revela contas de teste; isso não troca a conta ativa. Selecionar uma dessas contas entra no modo mockado, identificado tanto no cartão quanto em um aviso permanente nas telas.

Balançar novamente em Conexões permite ocultar as contas de teste. Ao reiniciar o app, a ativação é esquecida: uma conta real salva é restaurada, ou Conexões é mostrada sem uma conta ativa. A inicialização web também não injeta dados de demonstração.

O cache de contas reais preserva sua identificação atual. Os mocks usam outro namespace, `mock:<accountId>`, tanto para cache quanto para a sessão local fictícia. Falhas de rede/API são mostradas com o histórico real já salvo, sem instanciar um transporte mockado. Não existe mais login fictício por código `123456` no formulário normal.

**Assistente:** o rodapé contém somente o campo de mensagem e o envio. A configuração de compartilhamento com IA fica no ícone de escudo do cabeçalho. O consentimento por conta/usuário/provedor continua obrigatório antes da primeira consulta e pode ser revogado. Nomes internos das ferramentas não aparecem nas respostas.

**Diagnóstico:** não aparece no menu normal ou nas conversas reais. O teste de notificação local também aparece apenas em conta mockada; configuração e teste de APNs real continuam disponíveis. Ferramentas de simulação ficam restritas ao painel de teste, com uma conta mockada ativa.

Validação automática: testes do store com armazenamento em memória cobrem inicialização, restauração, falha HTTP 503, bloqueio de seleção de mocks e isolamento dos caches. O detector cobre movimentos comuns, impulsos alternados e intervalo entre acionamentos. Nenhum banco Mautic é usado pelos testes.

Publicação: os candidatos de fonte são Android 12 e iOS 27. A compilação/validação e o envio às lojas são etapas separadas. Os builds anteriores não são declarados como contendo esses ajustes.

## Conferência nativa

iOS 1.0.0 (27) compilado em Release e instalado no simulador iOS 26.0, preservando a sessão real existente. O fluxo `e2e/flows/live-without-demo.yaml` passou nas telas Conexões, Assistente e Preferências. As capturas estão em `artifacts/qa/test-mode/`. Os 109 testes e a verificação de tipos passaram após o ajuste final.

O gesto físico de balançar ainda precisa de validação no aparelho; os testes automatizados validam o detector e o fluxo de seleção no store. Esta versão não foi enviada ao TestFlight ou Google Play nesta alteração.

## Versão 1.0.1

A tag `v1.0.1` inclui estes ajustes, seleção de navegador compatível com Custom Tabs no Android, formatação nativa de mensagens e melhorias de cadastro/pareamento WhatsQR já presentes na fonte. Candidatos: Android 12 e iOS 27. A validação e a publicação nas lojas permanecem etapas separadas. Evidências com contas reais ficam apenas nos artefatos locais, fora do Git.

Validação da 1.0.1: 109 testes do app, 21 testes das ferramentas de publicação e TypeScript passaram. O iOS 1.0.1 (27) compilou em Release e passou no fluxo nativo de Conexões, Assistente e Preferências no simulador iOS 26.0, mantendo a conta real. Android 1.0.1 (12) compilado e auditado: SDK 36, assinatura da chave existente e bibliotecas de 16 KB. APK instalado por atualização no Moto g56, sem limpar dados; navegação física não conferida porque a tela bloqueou. Nenhum envio às lojas nesta etapa. O gesto físico permanece pendente.

## Validação Android após desbloqueio

O Moto g56 5G conectado por USB passou no fluxo `live-without-demo.yaml` com o APK 1.0.1 (12) derivado do AAB auditado do commit `63f28e5`. Conexões, Assistente e Preferências foram conferidos com a sessão real já existente: contas mockadas e controles demo ocultos, compositor do assistente compacto com configuração de IA no cabeçalho, e teste de notificação local ausente na conta real. As capturas e o relatório ficam nos artefatos locais de QA, sem dados de conta no Git.

O serviço de sensores confirmou acesso ao acelerômetro, inscrição em Conexões e remoção ao trocar de tela. O movimento físico abrindo o painel Modo de teste ainda não foi confirmado. A tag `qa/android-1.0.1-build12` registra esta conferência, sem mudar a tag de aplicação `v1.0.1` e sem envio às lojas. Mudanças posteriores de WhatsQR na pasta de trabalho não fazem parte do binário conferido.
