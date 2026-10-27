# TAD — Zap Komunick

**Komunick Inteligência e Tecnologia** · **Atualizado em:** 27/10/2026
**Fonte oficial:** `docs/TAD.md` no repositório · **Comportamento:** `docs/PRD.md`

Levantamento parcial: este documento cobre o que o fork acrescenta ao Ticketz. O restante do sistema segue o desenho do
upstream, resumido na segunda parte do `AGENTS.md`.

## 1. Solução e tecnologias

**Visão geral:** o Ticketz (github.com/ticketz-oss/ticketz, AGPL-3.0) é um atendimento multiusuário de WhatsApp com
filas, chatbot, etiquetas, agendamentos e campanhas. O fork mantém a base e acrescenta sete recursos (PRD RF-002 a
RF-008), o link de código-fonte (RF-001) e a identidade visual da Komunick (RF-009), com mudanças pequenas nos arquivos
do upstream para facilitar a mesclagem de novas versões.

**Partes e responsabilidades:**
- `backend/src/helpers/*Rules.ts`, `AccessHours.ts`, `ScheduleRecurrence.ts`, `SlaPanel.ts`: regras de negócio em
  funções puras, sem banco (classificação do SLA, agregação do painel, atribuição da carteira, plano de movimento do
  Kanban, horário de acesso, próxima data da série).
- `backend/src/services/SlaServices`, `KanbanServices`, `ContactServices/SetContactWalletService`,
  `ScheduleServices/CreateNextOccurrenceService`: buscam os dados, aplicam a regra e gravam.
- `backend/src/helpers/TicketPauseAndClose.ts` (transição para pausado, exigência do motivo e
  `ACTIVE_TICKET_STATUSES`), `BusinessDays.ts` (feriados e próximo dia útil) e `ScheduleTargets.ts` (destinatários e
  caminho do anexo): mais regras puras.
- `backend/src/services/CloseReasonServices` (cadastro e relatório dos motivos) e
  `ScheduleServices/CreateService.ts` (`CreateSchedulesService`, um agendamento por destinatário numa transação).
- `backend/src/helpers/TagScope.ts`: normalização de setores, visibilidade das etiquetas e seleção de ids da mesma
  empresa; `TagServices/SyncTagsService` mantém a associação no atendimento ou contato conforme `tagsMode` (RF-019).
- Rotas novas: `GET /sla` (admin), `GET /kanban`, `PUT /kanban/tickets/:ticketId`, `PUT /contacts/:contactId/wallet`
  (admin), `GET /close-reasons` (qualquer usuário: os ativos; `?all=true` para admin), `POST`, `PUT` e `DELETE
  /close-reasons/:closeReasonId` e `GET /close-reasons/report` (admin), `POST /schedules/media` (envio do anexo).
- Frontend: `pages/Sla`, `pages/Kanban`, `pages/CloseReasons`, `components/AccessHoursEditor`,
  `components/CloseTicketModal`, `components/ScheduleExtras`, `helpers/sla.js`, `theme/komunick.js` (tokens de cor e
  ajustes do Material-UI) e campos novos nos formulários existentes (etiqueta, contato, usuário, agendamento,
  configurações). A tela de login foi reescrita (`pages/Login`).

**Percurso principal:**
- SLA: `MessageServices/CreateMessageService` marca `Tickets.unansweredSince` na primeira mensagem nova do cliente e
  limpa na mensagem da empresa quando o atendimento está `open`; `UpdateTicketService` e o fechamento em massa da
  conexão limpam ao fechar. `GET /sla` lê os atendimentos `open`/`pending` com o início do ciclo atual
  (`TicketTraking` sem `finishedAt`) e monta o painel com `buildSlaPanel`. A lista de atendimentos recebe
  `unansweredSince` em todo payload de ticket (REST e socket) e calcula o selo no navegador com o prazo lido da
  configuração `slaMinutes`, liberada a não administradores em `safeSettingsKeys`.
- Carteira: `FindOrCreateTicketService` consulta `walletAutoAssign`, o responsável (`Contacts.walletUserId`) e as filas
  dele e da conexão; com atribuição, cria ou reabre o atendimento como `pending` com `userId` e `queueId`, e o
  `wbotMessageListener` já pula o chatbot quando o atendimento tem `userId`.
- Kanban: as colunas são etiquetas com `kanban = 1`. `PUT /kanban/tickets/:id` calcula com `planKanbanMove` as
  etiquetas de Kanban a remover e a acrescentar, grava em `TicketTags` e emite a atualização do ticket pelo socket. O
  quadro escuta `company-<id>-ticket` e `-appMessage` e recarrega com atraso de 1 s.
- Horário de acesso: `AuthUserService` (login) e `RefreshTokenService` (renovação) recusam com
  `ERR_OUT_OF_ACCESS_HOURS` quando `canAccessNow` é falso; sessões de impersonação não são checadas.
- Recorrência: `queues.ts` (`handleSendScheduledMessage`) chama `CreateNextOccurrenceService` no `finally`, após o envio
  ou a falha. A próxima data vem de `nextOccurrence(recurrenceAnchorAt, recurrence, max(agora, sendAt), recurrenceEndAt)`
  e, com `businessDaysOnly`, passa por `nextBusinessDay`.
- Pausa: `paused` é um status novo de `Tickets.status`. `UpdateTicketService` recusa com `checkStatusTransition` a pausa
  de quem não está `open`. As buscas de "atendimento ativo do contato" (`FindOrCreateTicketService`,
  `FindOrCreateTicketServiceMeta`, `CheckContactOpenTickets`, `MergeContactsService`, `WhatsAppController` e o Kanban)
  usam `ACTIVE_TICKET_STATUSES` (`open`, `pending`, `paused`), então a mensagem do cliente cai no atendimento pausado.
  O aviso pelo socket segue o do upstream (`company-<id>-<status>` e `user-<id>`); a aba "Pausados" é uma lista com
  `status=paused`. O SLA só olha `open` e `pending`, então o pausado sai do painel e do selo.
- Motivo de finalização: na transição para `closed`, `UpdateTicketService` lê a configuração `closeReasonRequired` e os
  ids ativos da empresa e aplica `checkCloseReason`; só exige quando a chamada traz o usuário (`TicketController.update`)
  e o atendimento não é grupo. Motivo e observação ficam no `TicketTraking` do ciclo que fecha; o relatório agrupa
  `TicketTraking` por `closeReasonId` com `finishedAt` nos últimos N dias.
- Agendamento completo: `POST /schedules` com `contactIds` ou `tagId` chama `CreateSchedulesService`, que junta os
  contatos da etiqueta (`ContactTags`) aos escolhidos com `mergeRecipients`, filtra pela empresa e cria todos com
  `bulkCreate` numa transação; o socket recebe um `create` por agendamento. O anexo sobe antes por
  `POST /schedules/media` (`saveMediaToFile` com `persistant`, em `public/media-persistant/<empresa>/...`) e o
  agendamento guarda só o caminho; no envio, `queues.ts` passa `path.resolve(getPublicPath(), mediaPath)` ao
  `SendMessage`. Com `businessDaysOnly`, `sendAt` é levado ao dia útil e `recurrenceAnchorAt` guarda a data pedida.

**Tecnologias:** as do upstream (Node 24, Express, TypeScript, Sequelize, Postgres 16, Redis/Bull, React 17, Material-UI
v4, i18next). O fork não acrescenta dependências. Arrastar e soltar do Kanban usa a API nativa do navegador (HTML5 drag
and drop). Situação: confirmada (é o que está no código).

**Organização do código:** os arquivos novos levam o nome do recurso; os trechos maiores alterados em arquivos do
upstream têm o comentário "Zap Komunick". Textos novos da interface ficam em
`frontend/src/translate/languages/komunick.js`, mesclado sobre os dicionários do upstream em
`translate/languages/index.js` (idiomas sem entrada caem no inglês).

**Visual (RF-009):** `theme/komunick.js` guarda os tokens de cor dos dois temas (fundo, papel, bordas, textos, chat e
balões) e as mudanças nos componentes do Material-UI (raios, botões, abas, campos, tabelas, chips). O `App.js` cria o
tema com `createKomunickTheme`, que mescla esses valores sobre o tema do upstream sem mudar as chaves que os
componentes do Ticketz usam. Cores que o upstream escreve direto nos componentes foram trocadas pelos tokens só onde
apareciam (chat em `MessagesList`, barra do topo em `layout/index.js`, itens da lista e abas). Logo e ícones padrão
estão em `public/vector/` e nos PNGs de `public/`; o Whitelabel da empresa continua por cima deles. A Direção B do
Stitch entra como tokens: `sidebar*` (menu preto, igual nos dois temas), `accent`, `selectedRow`, `tagBackground` e
`bubbleMineBorder`, usados em `layout/index.js`, `layout/MainListItems.js` e `TicketListItemCustom`.

## 2. Dados e integrações

**Dados principais (migrações `20261021120000` a `20261021120300`):**
- `Tickets.unansweredSince` (data, nulo) e índice `(companyId, status, unansweredSince)`. A migração estima o valor dos
  atendimentos já abertos.
- `Contacts.walletUserId` (FK `Users`, `ON DELETE SET NULL`) e índice `(companyId, walletUserId)`.
- `Users.accessHours` (JSONB, nulo): `{ weekdays: number[], start: "HH:mm", end: "HH:mm" }`.
- `Schedules.recurrence` (texto, padrão `none`), `recurrenceEndAt` e `recurrenceAnchorAt` (datas, nulas).
- Configurações por empresa (`Settings`): `slaMinutes` (padrão 0), `slaOldTicketHours` (padrão 72),
  `walletAutoAssign` (padrão `disabled`), `closeReasonRequired` (padrão `disabled`).

**Dados da segunda entrega (migrações `20261021130000` e `20261021130100`):**
- Tabela `CloseReasons` (`name`, `active` padrão verdadeiro, `companyId` com `ON DELETE CASCADE`), índice por empresa.
- `TicketTraking.closeReasonId` (FK `CloseReasons`, `ON DELETE SET NULL`) e `closeReasonNote` (texto).
- `Schedules.mediaPath` e `mediaName` (texto, nulos) e `businessDaysOnly` (booleano, padrão falso).
- `Tickets.status` ganha o valor `paused` (a coluna já é texto livre; não há migração).
- `Chats.isDirect` (booleano, padrão falso; migração `20261026120000`): conversa a dois do chat interno (RF-010).
  `POST /chats/direct` `{ userId }` acha ou cria a conversa entre o usuário logado e outro da mesma empresa
  (`FindOrCreateDirectService`; 400 para si mesmo ou sem `userId`, 404 para usuário de outra empresa); editar ou excluir
  uma conversa a dois responde 403 (`ERR_CHAT_DIRECT_READONLY`). A lista de conversas passa a vir por `updatedAt`.
- `POST /tickets/bulk` `{ action: accept|transfer|close|tag, ticketIds, queueId?, userId?, closeReasonId?, closeReasonNote?, tagIds? }`
  (RF-011): `helpers/BulkTicketActions` valida e monta a alteração (até 100 ids, sem repetidos; aceitar só de
  `pending`, transferir e finalizar de `open`/`pending`/`paused`); o controlador confere a empresa e a situação de cada
  um e chama `UpdateTicketService` em sequência, sob o mesmo mutex do `PUT /tickets/:id`. Resposta `{ done, failed }`
  com o erro de cada id que não passou; uma falha não interrompe os demais. Sem tabela nova.
  A ação `tag` (RF-019) recebe de 1 a 20 ids de etiquetas e aceita também `closed` pela API (a aba Resolvidos continua
  sem seleção em lote); adiciona às associações atuais, sem duplicar, e usa `SyncTagsService`. Cada atendimento recebe
  somente etiquetas compatíveis com seu setor; sem nenhuma compatível, vai para `failed`. Em `tagsMode=contact`,
  altera `ContactTags`; em `ticket` ou `both`, altera `TicketTags`, preservando a semântica da sincronização da conversa.
- `GET /tickets` ganha os filtros do painel (RF-012): `whatsappIds`, `userIds`, `filterTags` (listas JSON, até 50),
  `createdFrom`/`createdTo` (`AAAA-MM-DD`, dia inteiro no fuso do backend), `unread`, `slaBreached`, `wallet`
  (`mine`|`none`). `helpers/TicketFilters` valida (400 com `ERR_FILTER_*`) e monta as condições somadas com `AND` às da
  lista; `userIds` só vale para administrador; as etiquetas entram no mesmo cálculo das etiquetas da busca; SLA
  estourado = aberto ou aguardando, sem chatbot e `unansweredSince` mais antigo que o prazo. No frontend,
  `components/TicketsFilters` repete a regra para os eventos do socket. Sem tabela nova.
- `GET /users/online` (administrador; RF-013): `OnlineUsersService` lê as sessões que o socket já grava em
  `UserSocketSessions` (online = alguma ativa; desde = a mais antiga ativa; visto por último = maior `updatedAt`),
  conta atendimentos `open` e `paused` de cada usuário e os finalizados hoje em `TicketTraking.finishedAt`, com as
  filas; `helpers/OnlineUsers` classifica (fora do horário pelo `canAccessNow`), ordena e resume. A página escuta
  `userOnlineChange` e `counter` (com espera de 2 s) e atualiza a cada minuto. Sem tabela nova.
- `PUT /contacts/wallet/bulk` (administrador; RF-014), declarada antes de `/contacts/:contactId/wallet`:
  `{ mode: "contacts", contactIds, walletUserId }` (até 500) ou `{ mode: "transfer", fromUserId, walletUserId }`, com
  `null` para "sem responsável". `helpers/WalletBulk` valida; `SetWalletBulkService` confere os responsáveis na
  empresa, ignora grupos e faz um `UPDATE` só nos contatos da empresa; cada contato alterado sai no evento
  `company-<id>-contact`. `GET /contacts?walletUserId=none` lista os contatos sem responsável (sem grupos). Resposta
  `{ updated, skippedGroups }`. Sem tabela nova.
- `GET /metrics?from&to&queueId&userId` (administrador; RF-015): `helpers/Metrics` valida o período (padrão: 30 dias até
  hoje; até 366; 400 com `ERR_METRICS_*`), preenche os dias vazios e monta o mapa 7×24. `MetricsService` faz consultas
  SQL com parâmetros sobre `TicketTraking` (um ciclo por linha; `waitTime` e `serviceTime` são colunas geradas) junto de
  `Tickets` (sem grupos; fila do atendimento), contando abertos por `createdAt`, finalizados por `finishedAt`, espera e
  "no prazo" por `startedAt` (`waitTime` até `slaMinutes`), dias e horas no fuso `TZ` do backend; novos contatos em
  `Contacts` e notas em `UserRatings`. Sem tabela nova.
- `Tags.queueIds` (JSONB, nulo; migração `20261027130000-add-queue-ids-to-tags`): ids dos setores em que a etiqueta é
  oferecida; `null` ou lista vazia significa todos os setores. `TagController` valida os ids contra `Queues.companyId`
  antes de criar ou editar. `GET /tags` e `GET /tags/list` usam `TagScope.isTagVisible`: gerais e setores do usuário,
  ou todas para administrador; `GET /tags/list?queueId=<id>` restringe às gerais e ao setor da conversa. `queueId=0`
  representa uma conversa sem setor e oferece somente etiquetas gerais; a ausência do parâmetro mantém a listagem
  conforme os setores do usuário.
- `GET /contacts?tagIds=[1,2]` (RF-019): lista JSON com até 20 ids inteiros positivos, combinada com busca e carteira.
  `ListContactsService` seleciona contatos com qualquer etiqueta em `ContactTags` ou em `TicketTags` de algum
  atendimento, sem restrição de status, mantendo o filtro de empresa da listagem. O filtro vazio não restringe.
  A contagem usa contatos distintos para que a associação com várias etiquetas não gere páginas extras.

**Integridade:**
- `unansweredSince` só muda com mensagem nova: `CreateMessageService` confere se a mensagem já existia antes do
  `upsert`, então edições e reações de mensagens antigas não reiniciam a espera.
- O responsável da carteira é validado na mesma empresa e só pela rota de administrador; a edição comum de contato não
  grava `walletUserId`.
- `SyncTagsService` busca atendimento e contato com `companyId` e só associa etiquetas da mesma empresa; ids enviados
  pelo cliente não podem ligar entidades de empresas diferentes. A mesma proteção vale na ação de etiquetar em lote.
  Novas associações respeitam o setor da conversa; etiquetas antigas de outro setor permanecem se vierem no pedido,
  permitindo preservar o contexto após uma transferência sem impedir sua remoção explícita.
- Kanban mexe só em etiquetas com `kanban = 1`; o atendente sem perfil admin só move o que vê.
- A série recorrente guarda a âncora para não acumular desvio de datas; editar só o texto preserva a âncora.
- O motivo de finalização é conferido na empresa e entre os ativos no servidor, com ou sem exigência; ids inválidos
  nas rotas de motivo respondem 404.
- O caminho do anexo do agendamento só é aceito no formato `media-persistant/<empresa>/<pasta>/<arquivo>`, da própria
  empresa e sem `..`; vale na criação e na edição.
- O dia útil é calculado no fuso do backend (`TZ`, que nos compose do upstream vem como `America/Sao_Paulo`).

**Integrações:** nenhuma nova. O envio continua pelo WhatsApp do Ticketz (Baileys).

**Compatibilidade:** todas as colunas novas são opcionais e as configurações novas começam desligadas, então uma
instalação existente mantém o comportamento até o gestor ativar. As rotas e payloads existentes só ganharam campos.

## 3. Telas, acesso e cuidados

**Telas e navegação:** menu "Kanban" (atendimento), "Painel de SLA" (gerência, só admin) e "Motivos de finalização"
(administração); coluna e chave de Kanban em Etiquetas; responsável e filtros de carteira e etiquetas em Contatos; horário de
acesso no formulário do usuário; "Repetir", contatos, etiqueta, anexo e "Enviar só em dia útil" no agendamento; grupo
"SLA e carteira de clientes" e "Exigir motivo ao finalizar" em Configurações; aba "Pausados" e botões Transferir,
Pausar, Retomar e Finalizar no atendimento.

**Etiquetas por setor (RF-019):** `TagModal` usa `QueueSelect` com seleção múltipla e texto explicando que a seleção
vazia vale para todos os setores; `pages/Tags` mostra a coluna "Setores". `components/TagPicker` reúne
`useSectorTags`, `TagChecklist` e `TagPickerPopover`: a linha do atendimento abre o popover e salva por
`POST /tags/sync`; `TagsContainer` recebe o setor da conversa, inclusive quando as etiquetas ficam no contato.
`TicketsBulk` reutiliza a lista na janela de aplicação em lote. Em Contatos, `tagIds` combina com
`walletUserId=me|none`; "Sem responsável" aparece para administradores. Textos ficam em
`translate/languages/komunick.js`.

**Tarefas (RF-009):** o item é omitido de `layout/MainListItems.js` e `layout/navItems.js`, cobrindo menu lateral,
abas e paleta Ctrl K. A rota `/todolist` e sua página continuam registradas.

**Interação:** o Kanban tem, além do arrastar, o menu "Mover para" em cada cartão (teclado e leitores de tela); o
movimento aparece na hora e volta atrás se o servidor recusar. O painel de SLA avisa quando o prazo não foi definido e
leva às configurações.

**Proteção:** as permissões são verificadas no servidor: `isAdmin` em `GET /sla`, `PUT /contacts/:id/wallet` e nas
rotas de escrita e relatório de `/close-reasons`; `MoveKanbanTicketService` confere dono/status como o
`UpdateTicketService`; o horário de acesso é aplicado no login e na renovação do token; a exigência de motivo e a regra
de pausa ficam no `UpdateTicketService`, não só na tela.

## 4. Estratégia de testes e operação

**Ambiente e comandos:** ver `AGENTS.md`.

**Estratégia de testes:**
- Regras puras com Jest em `backend/src/__tests__/helpers/` (sem banco): limites do SLA, agregação do painel,
  carteira, Kanban, horário de acesso (inclusive virada da meia-noite), datas da série (fim de mês, bissexto, atrasos,
  data final), pausa e motivo, feriados e dia útil (Páscoa, Carnaval, Corpus Christi, Consciência Negra a partir de
  2024), destinatários e caminho do anexo do agendamento, normalização e visibilidade de etiquetas por setor e
  validação da ação de etiquetar em lote.
- Etiquetas por setor: exercitar cadastro e edição de setores, seletores da conversa e da linha, aplicação em lote
  com preservação das associações, filtro de contatos por etiqueta em contato e atendimento, combinação com carteira
  e isolamento por empresa. Incluir conversa sem setor, etiquetas anteriores após transferência e lote com setores
  diferentes. Usar somente dados fictícios; os resultados de API e de tela ficam no PR.
- Rotas e permissões exercitadas contra o ambiente de desenvolvimento (Postgres real) por chamadas HTTP; serviços que
  dependem de eventos do WhatsApp (`CreateMessageService`, `FindOrCreateTicketService`, `CreateNextOccurrenceService`)
  chamados direto dentro do contêiner do backend. Esses roteiros não estão no repositório; o resultado fica no PR.
- Sem conexão de WhatsApp no ambiente local, o percurso real de mensagens, a edição de contato pela tela (que consulta
  o número no WhatsApp) e o envio do agendamento com anexo não são exercitados; ficam para a homologação.
- Telas conferidas por capturas do Playwright num contêiner (`node:24` com `playwright@1.49.1`) ligado à rede do
  ambiente de desenvolvimento, nos temas claro e escuro e na largura de celular.

**Validação de uso:** em homologação, com uma conexão de teste: mandar mensagem de um número de teste, conferir o
relógio no painel, responder, mover no Kanban, contato com carteira abrindo direto no responsável, usuário fora do
horário e um agendamento diário.

**Publicação e observação:** guia em `docs/DEPLOY.md`, para `superchat.komunick.com` (DNS no Cloudflare, registro
`A` somente DNS na primeira subida), ao lado do zap.komunick.com (que segue com o Ticketz 1.0.132; trocar é decisão do responsável, PRD seção 5). As imagens são
montadas no próprio servidor a partir do código (`docker-compose-komunick.yaml`), com a aplicação só em
`127.0.0.1:5480`, atrás do nginx do servidor (`deploy/nginx-host.conf.example`) ou do proxy com Let's Encrypt
(`docker-compose-komunick-proxy.yaml`). Diferenças para os compose do upstream: banco com senha
(`POSTGRES_PASSWORD`/`DB_PASS`), backend sem o socket do Docker (a autoatualização pela tela trocaria o fork pelas
imagens do Ticketz), `SOCKET_ADMIN=false`, senha do primeiro administrador por `ADMIN_PASSWORD` e segredos do JWT por
`crypto.randomBytes`, sem registro em log. Backup diário por `deploy/backup.sh` (banco e arquivos, 14 cópias).
Observação: `docker compose logs` no servidor; não há monitoramento externo. O workflow do upstream
(`.github/workflows/build-docker.yml`) publica em `ghcr.io/ticketz-oss` e não é usado.

**Histórico do cliente e nota de transferência (RF-017):** `ListMessagesService` busca as mensagens de todos os
`Tickets` do mesmo `contactId` na empresa (cursor `nextId` e respostas no mesmo conjunto); com `messageVisibility` =
`message`, o filtro de fila vale só para mensagens de outros atendimentos. `PUT /tickets/:id` aceita `transferNote` e
`transferMessageIds`: se a fila ou o atendente mudou, `CreateTransferNoteService` grava uma `Message` com
`mediaType` = `transferNote` (id `ZKNOTE…`, `fromMe`, `read`), texto e cópia das mensagens citadas em `dataJson`
(só do mesmo cliente, `helpers/TransferNote` limita tamanho e quantidade), e emite o `appMessage` normal. Ela não passa
pelo `CreateMessageService` (não mexe em `unansweredSince`) nem pelo envio do WhatsApp, e não altera
`Ticket.lastMessage`. O frontend desenha `transferNote` como cartão interno, sem menu de ações.

**Agenda do WhatsApp em Contatos (RF-018):** no evento `contacts.upsert` (`wbotMonitor`), depois de gravar a tabela
`Baileys`, `SyncAgendaContactsService` usa `helpers/AgendaContacts` (só `<número>@s.whatsapp.net`, ou o `phoneNumber`
de um contato `@lid`; um registro por número, nome salvo > nome verificado > nome do perfil > número) e faz um
`bulkCreate` só dos números ausentes, com `ignoreDuplicates` sobre o índice único `(number, companyId)`. Configuração
`syncPhoneContacts` (padrão `enabled`). No frontend, a paleta e o componente `ClientMatches` buscam `GET /contacts` e
abrem a conversa pelo fluxo existente `window.mentionClick`.

**Reconexão do WhatsApp:** cada queda do socket passa por `helpers/ReconnectPolicy` (código do `lastDisconnect`):
401, 403, 411 e 500 apagam a sessão e pedem QR novo; 440 (sessão aberta por outro cliente com as mesmas credenciais,
como outro servidor ou um backend duplicado) para a conexão sem apagar as credenciais e avisa os administradores, em
vez de reconectar e brigar pela sessão; 515 reconecta em 0,5 s (normal depois de parear); o resto (408, 428, 503,
desconhecido) reconecta com espera crescente de 2 s até 5 min, com até 20% de variação, zerada quando a conexão abre.
Cada queda fica no log como `Socket <nome> closed: <motivo> -> <ação>`. Antes, toda queda que não fosse 401
reconectava em 2 s fixos, inclusive 440, e o 403 apagava a sessão e ainda tentava reconectar.

**Recuperação:** as migrações de avanço não removem dados existentes. As migrações têm `down`, mas a reversão pode
perder dados (o `down` da `20261021130000` apaga os motivos cadastrados). Desligar `slaMinutes`, `walletAutoAssign` e
`closeReasonRequired` devolve o comportamento original
sem migração reversa. Antes de voltar a uma versão sem o status `paused`, retomar ou finalizar os atendimentos
pausados: o Ticketz original não mostra esse status em nenhuma aba.

Para voltar à aplicação sem etiquetas por setor, manter `Tags.queueIds` no banco preserva as restrições cadastradas
para uma futura atualização; a versão anterior ignora esse campo. O `down` da migração `20261027130000` remove só a
coluna, sem apagar etiquetas ou associações, mas perde a configuração de setores. Não é necessário executá-lo para
recuar a aplicação.

## Segurança da conta, IPs permitidos e auditoria (RF-016)

- As migrações `20261027120000` e `20261027120100` criam `AuditLogs` e acrescentam `twoFactorEnabled`,
  `twoFactorSecret`, `twoFactorPendingSecret` e `twoFactorRecoveryCodes` a `Users`. Contas existentes começam sem
  2FA. O segredo TOTP fica no banco privado; o escopo padrão e `User.toJSON` o excluem das consultas e respostas,
  inclusive associações. Serviços de autenticação/segurança carregam os campos privados explicitamente. Os códigos
  de recuperação são armazenados como hashes bcrypt e apresentados ao usuário apenas ao ativar ou regenerar.
- `helpers/Totp` implementa TOTP com HMAC-SHA1, período de 30 segundos, seis dígitos e tolerância de um período.
  O cadastro começa com `POST /security/2fa/setup` (`secret`, URI `otpauth`); `POST /security/2fa/enable` confirma o
  código e retorna oito códigos de recuperação. `POST /security/2fa/recovery-codes` exige um novo TOTP e invalida os
  códigos anteriores. `POST /security/2fa/disable` exige senha e TOTP ou recuperação; `GET /security/me` expõe só
  status, quantidade restante de códigos e IP reconhecido. Segredo/URI e códigos em claro ficam somente na memória
  da página; a opção de baixar os códigos gera o arquivo apenas por ação do usuário.
- `AuthUserService` mantém o login normal para contas sem 2FA. Com 2FA, senha válida retorna
  `{ twoFactorRequired: true, challenge }`, sem sessão. `POST /auth/2fa` recebe `{ challenge, code }` e somente a
  confirmação válida emite token/cookie. O desafio é HS256, tem propósito/chave próprios, identificador aleatório,
  `tokenVersion` e validade de cinco minutos; não serve como access token. Redis faz a reserva atômica de desafios
  e períodos TOTP consumidos e controla cinco tentativas por janela fixa de dez minutos, contada da primeira tentativa
  (`429`, `Retry-After: 600` como espera máxima conservadora). A recuperação
  usa atualização condicional no banco para impedir consumo concorrente duplicado.
- Ativar, desativar e redefinir 2FA incrementa `tokenVersion`; operações condicionais impedem reativar uma configuração
  invalidada por reset concorrente. A sessão atual recebe novo refresh cookie ao ativar/desativar; outras renovações
  e desafios antigos ficam inválidos. O access token anterior continua sujeito ao TTL existente de quinze minutos.
  `DELETE /users/:userId/2fa` é administrativo, confere empresa e privilégio de superusuário, e não permite reset da
  própria conta. `ListUsersService` expõe `twoFactorEnabled` e `super` para indicação e disponibilidade da ação.
- `helpers/IpAllowlist` valida IPv4/IPv6 e CIDR; aceita uma entrada por linha, separadores vírgula/ponto e vírgula e
  comentários `#`. `GET/PUT /security/ip-allowlist` são administrativos. A gravação exige entradas válidas, até 100,
  lista não vazia quando ativa e inclusão do IP do administrador (superusuário é a exceção de recuperação).
  `IpAllowlistService` persiste `ipAllowlist` e `ipAllowlistEnabled` em uma transação, serializando edições da empresa;
  consulta ambas juntas para aplicar a restrição no login, 2FA e refresh. A rota genérica de settings recusa essas chaves.
- `TRUST_PROXY` vem desligado por padrão. Antes de ativar IPs permitidos atrás de um proxy, configurar explicitamente
  os proxies conhecidos (por exemplo `loopback` quando o proxy está no mesmo host, ou os CIDRs da rede do proxy),
  garantindo que acesso direto e cabeçalhos `X-Forwarded-For` não possam forjar o IP. A tela mostra o IP usado pelo
  servidor para essa conferência. `TWO_FACTOR_ISSUER` personaliza o nome do autenticador (padrão `Zap Komunick`).
- `RecordAuditService` registra as famílias `auth.`, `security.`, `user.` e `setting.` com empresa, usuário, entidade,
  data, IP e user-agent limitado a 512 caracteres. Falha de gravação é registrada no log sem interromper a ação.
  `GET /audit-logs` é administrativo e filtra a empresa autenticada, período (`from`, `to`), usuário e ação/família;
  páginas de 50 registros, ordem por data/id decrescentes. Filtros inválidos são recusados. Não existem rotas de
  alteração da trilha. Alterações de usuário/configuração guardam metadados, sem senha, valor de configuração,
  códigos ou tokens; o trace HTTP registra método/caminho, sem body, query ou cabeçalhos de autenticação.
- Frontend: `/account-security` no menu do perfil e paleta; `/ip-allowlist` e `/audit-logs` no menu administrativo e
  paleta; Usuários mostra 2FA e o reset com confirmação. `Login/TwoFactorForm` mantém o desafio só em estado local,
  limpa a senha, oferece autenticador/recuperação, mostra expiração e ignora respostas de uma tentativa cancelada.
  Falhas de senha/código nos formulários autenticados preservam a sessão para correção dos dados.

**Verificação prevista:** testes dos helpers e serviços de segurança, concorrência/replay, expiração e limites;
API com PostgreSQL/Redis reais para autenticação, cookies, autorização, IPs, filtros e privacidade da auditoria;
percurso de tela com contas fictícias para ativar, recuperar, desativar, redefinir e consultar registros. Nunca incluir
segredo, QR ou códigos de recuperação em logs ou prints de evidência. Os resultados executados ficam no PR.

**Recuperação:** manter as colunas e a tabela ao recuar a aplicação preserva os dados. Os `down` removem configuração
2FA e trilha de auditoria e não são necessários para recuar o código; não usá-los como procedimento padrão. Uma versão
anterior sem 2FA/allowlist deixa de aplicar essas proteções e requer decisão operacional humana antes de ser publicada.

## 5. Decisões e pendências

**Escolhas que precisam de explicação:**
- Marca de espera em coluna do ticket em vez de calcular por consulta a cada listagem: o payload do ticket já vai para
  a lista por REST e socket, então o selo fica certo em tempo real sem consultas extras; a consulta só acontece no
  painel.
- Mensagem da empresa só conta como resposta com o atendimento `open`: não há como diferenciar, no registro da
  mensagem, o que veio do chatbot ou de uma pessoa.
- Carteira atribui como `pending` com `userId`, o mesmo estado que o Ticketz já usa ao reabrir atendimento mantendo o
  atendente; assim o chatbot é pulado sem mexer no `wbotMessageListener`.
- Textos em arquivo próprio e regras em helpers para reduzir conflitos ao trazer versões novas do Ticketz.
- Pausa como status novo em vez de uma marca à parte: a lista, o socket e as abas do Ticketz já se organizam por
  status, então a aba "Pausados" sai sem consulta nova; o custo é lembrar o `paused` nas buscas de atendimento ativo
  (`ACTIVE_TICKET_STATUSES`).
- Motivo no `TicketTraking` e não no `Tickets`: o atendimento pode reabrir e fechar de novo, e cada ciclo guarda o seu
  motivo.
- Anexo enviado uma vez e só referenciado pelos agendamentos, para não copiar o arquivo para cada contato.
- Tema por tokens mesclados sobre o tema do upstream (e não por um tema novo), para os componentes do Ticketz que leem
  `theme.palette.*` continuarem funcionando sem mudança.

**Dúvidas ou riscos:** os do PRD, seção 5. Além deles: o `npm ci` da imagem `node:24` atual não roda scripts de
instalação de alguns pacotes (aviso "install-scripts" do npm 11), o que pode afetar o `ffmpeg` do backend em imagens
geradas daqui; conferir no build de homologação.
