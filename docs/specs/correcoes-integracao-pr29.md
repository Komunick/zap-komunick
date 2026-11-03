# Correções para integração do PR29 e dependências

## Objetivo e aprovação

Resolver os bloqueios encontrados na revisão da cadeia do PR29, sem ampliar permissões, conectar WhatsApp ou fazer
deploy. O usuário aprovou explicitamente este escopo corretivo em 03/11/2026, após a issue apresentada no chat.
A autorização anterior para os merges permanece, condicionada às correções, verificações e revisão exigida.

## Mudanças

- Kanban: a movimentação direta deve aplicar os mesmos critérios de empresa, ator, fila e estado da listagem.
  Atendente não move nem recebe dados de atendimento pendente em fila alheia; voltar para “Em aberto” também exige
  autorização. Negativas não alteram etiquetas nem emitem eventos. Preservar as operações legitimamente permitidas.
- Credenciais: cada operação administrativa verifica o vínculo e o perfil atuais do ator na empresa da sessão.
  Um Bearer válido antigo de A não permite administrar A após o ator ser transferido para B, removido ou perder
  o perfil administrativo. Aplicar a consulta de estado, substituição, remoção e migração, sem redesenhar JWT global
  nem alterar o acesso interno legítimo aos segredos. Não devolver valores/envelopes nem registrar segredos.
- CI: eliminar o namespace herdado `ticketz-oss` na publicação do fork. Eventos automáticos de validação/integração
  não publicam imagens; eventual publicação deve ser explícita, limitada ao próprio repositório/namespace e desligada
  por padrão. Não implantar ou iniciar aplicação, não usar credenciais de produção nem alterar proteções.

## Verificação e entrega

- Regressões com dados fictícios demonstram os dois defeitos na base b7228ed0f43e8c9c92920f81e5d359d346d30611
  e passam após a correção, com controles positivos de administrador/atendente autorizados e empresas isoladas.
- Conferir respostas, ausência de dados indevidos, gravações e eventos nas negativas, além de regras e cenários da CI.
  Rodar verificações apropriadas sobre o pacote final, registrando revisões e limites reais.
- Usar ambiente isolado que não inicie instâncias existentes. O Docker local permanece desligado, pois sua subida
  pode restaurar uma sessão WhatsApp salva. Não operar ARM07, produção ou publicação de imagens neste trabalho.
- Atualizar PRD/TAD/CHANGELOG e instruções afetadas. Abrir o PR corretivo e retomar os merges já autorizados somente
  após verificações e revisão exigida, sem simular aprovação humana ou contornar proteções.

## Referências

- [PRD RF004 e RF020](../PRD.md): visibilidade do Kanban e administração de credenciais da própria empresa.
- Revisão local de 03/11/2026 em `contexto-codex/merge-pr29/review-result.json`; cadeia #1, #4–20 e #22–29.
- [Workflow de entrega](../DELIVERY-WORKFLOW.md): revisão e integração. #21 já integrado; #2/#3 fora do recorte.
