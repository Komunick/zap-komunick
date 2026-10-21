# TAD — Zap Komunick

**Komunick Inteligência e Tecnologia** · **Atualizado em:** 21/10/2026
**Fonte oficial:** `docs/TAD.md` no repositório · **Comportamento:** `docs/PRD.md`

Levantamento parcial: este documento cobre o que o fork acrescenta ao Ticketz. O restante do sistema segue o desenho do
upstream, resumido na segunda parte do `AGENTS.md`.

## 1. Solução e tecnologias

**Visão geral:** o Ticketz (github.com/ticketz-oss/ticketz, AGPL-3.0) é um atendimento multiusuário de WhatsApp com
filas, chatbot, etiquetas, agendamentos e campanhas. O fork mantém a base e acrescenta cinco recursos (PRD RF-002 a
RF-006) e o link de código-fonte (RF-001), com mudanças pequenas nos arquivos do upstream para facilitar a mesclagem de
novas versões.

**Partes e responsabilidades:**
- `backend/src/helpers/*Rules.ts`, `AccessHours.ts`, `ScheduleRecurrence.ts`, `SlaPanel.ts`: regras de negócio em
  funções puras, sem banco (classificação do SLA, agregação do painel, atribuição da carteira, plano de movimento do
  Kanban, horário de acesso, próxima data da série).
- `backend/src/services/SlaServices`, `KanbanServices`, `ContactServices/SetContactWalletService`,
  `ScheduleServices/CreateNextOccurrenceService`: buscam os dados, aplicam a regra e gravam.
- Rotas novas: `GET /sla` (admin), `GET /kanban`, `PUT /kanban/tickets/:ticketId`, `PUT /contacts/:contactId/wallet`
  (admin).
- Frontend: `pages/Sla`, `pages/Kanban`, `components/AccessHoursEditor`, `helpers/sla.js` e campos novos nos
  formulários existentes (etiqueta, contato, usuário, agendamento, configurações).

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
  ou a falha. A próxima data vem de `nextOccurrence(recurrenceAnchorAt, recurrence, max(agora, sendAt), recurrenceEndAt)`.

**Tecnologias:** as do upstream (Node 24, Express, TypeScript, Sequelize, Postgres 16, Redis/Bull, React 17, Material-UI
v4, i18next). O fork não acrescenta dependências. Arrastar e soltar do Kanban usa a API nativa do navegador (HTML5 drag
and drop). Situação: confirmada (é o que está no código).

**Organização do código:** os arquivos novos levam o nome do recurso; os trechos maiores alterados em arquivos do
upstream têm o comentário "Zap Komunick". Textos novos da interface ficam em
`frontend/src/translate/languages/komunick.js`, mesclado sobre os dicionários do upstream em
`translate/languages/index.js` (idiomas sem entrada caem no inglês).

## 2. Dados e integrações

**Dados principais (migrações `20261021120000` a `20261021120300`):**
- `Tickets.unansweredSince` (data, nulo) e índice `(companyId, status, unansweredSince)`. A migração estima o valor dos
  atendimentos já abertos.
- `Contacts.walletUserId` (FK `Users`, `ON DELETE SET NULL`) e índice `(companyId, walletUserId)`.
- `Users.accessHours` (JSONB, nulo): `{ weekdays: number[], start: "HH:mm", end: "HH:mm" }`.
- `Schedules.recurrence` (texto, padrão `none`), `recurrenceEndAt` e `recurrenceAnchorAt` (datas, nulas).
- Configurações por empresa (`Settings`): `slaMinutes` (padrão 0), `slaOldTicketHours` (padrão 72),
  `walletAutoAssign` (padrão `disabled`).

**Integridade:**
- `unansweredSince` só muda com mensagem nova: `CreateMessageService` confere se a mensagem já existia antes do
  `upsert`, então edições e reações de mensagens antigas não reiniciam a espera.
- O responsável da carteira é validado na mesma empresa e só pela rota de administrador; a edição comum de contato não
  grava `walletUserId`.
- Kanban mexe só em etiquetas com `kanban = 1`; o atendente sem perfil admin só move o que vê.
- A série recorrente guarda a âncora para não acumular desvio de datas; editar só o texto preserva a âncora.

**Integrações:** nenhuma nova. O envio continua pelo WhatsApp do Ticketz (Baileys).

**Compatibilidade:** todas as colunas novas são opcionais e as configurações novas começam desligadas, então uma
instalação existente mantém o comportamento até o gestor ativar. As rotas e payloads existentes só ganharam campos.

## 3. Telas, acesso e cuidados

**Telas e navegação:** menu "Kanban" (atendimento) e "Painel de SLA" (gerência, só admin); coluna e chave de Kanban em
Etiquetas; responsável e filtro "Minha carteira" em Contatos; horário de acesso no formulário do usuário; "Repetir" no
agendamento; grupo "SLA e carteira de clientes" em Configurações.

**Interação:** o Kanban tem, além do arrastar, o menu "Mover para" em cada cartão (teclado e leitores de tela); o
movimento aparece na hora e volta atrás se o servidor recusar. O painel de SLA avisa quando o prazo não foi definido e
leva às configurações.

**Proteção:** as permissões são verificadas no servidor: `isAdmin` em `GET /sla` e `PUT /contacts/:id/wallet`;
`MoveKanbanTicketService` confere dono/status como o `UpdateTicketService`; o horário de acesso é aplicado no login e na
renovação do token.

## 4. Estratégia de testes e operação

**Ambiente e comandos:** ver `AGENTS.md`.

**Estratégia de testes:**
- Regras puras com Jest em `backend/src/__tests__/helpers/` (sem banco): limites do SLA, agregação do painel,
  carteira, Kanban, horário de acesso (inclusive virada da meia-noite) e datas da série (fim de mês, bissexto, atrasos,
  data final).
- Rotas e permissões exercitadas contra o ambiente de desenvolvimento (Postgres real) por chamadas HTTP; serviços que
  dependem de eventos do WhatsApp (`CreateMessageService`, `FindOrCreateTicketService`, `CreateNextOccurrenceService`)
  chamados direto dentro do contêiner do backend. Esses roteiros não estão no repositório; o resultado fica no PR.
- Sem conexão de WhatsApp no ambiente local, o percurso real de mensagens e a edição de contato pela tela (que consulta
  o número no WhatsApp) não são exercitados; ficam para a homologação.

**Validação de uso:** em homologação, com uma conexão de teste: mandar mensagem de um número de teste, conferir o
relógio no painel, responder, mover no Kanban, contato com carteira abrindo direto no responsável, usuário fora do
horário e um agendamento diário.

**Publicação e observação:** não definido para o fork. O zap.komunick.com (produção) roda o Ticketz 1.0.132 por
imagens Docker; o repositório traz o workflow de imagens do upstream (`.github/workflows/build-docker.yml`), que publica
em `ghcr.io/ticketz-oss` e precisa ser adaptado antes de uso. Pendente de decisão (PRD, seção 5).

**Recuperação:** as migrações têm `down`; nenhuma apaga dados existentes. Desligar `slaMinutes` e `walletAutoAssign`
devolve o comportamento original sem migração reversa.

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

**Dúvidas ou riscos:** os do PRD, seção 5. Além deles: o `npm ci` da imagem `node:24` atual não roda scripts de
instalação de alguns pacotes (aviso "install-scripts" do npm 11), o que pode afetar o `ffmpeg` do backend em imagens
geradas daqui; conferir no build de homologação.
