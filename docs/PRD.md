# PRD — Zap Komunick

**Komunick Inteligência e Tecnologia**
**Responsável:** Jailson (Komunick) · **Atualizado em:** 21/10/2026
**Fonte oficial:** `docs/PRD.md` no repositório
**Validado por:** Pendente

Este PRD delimita a primeira entrega do fork (Linear KOM-136 e subtarefas KOM-137 a KOM-142). Não há especificação
separada em `docs/specs/` para ela.

## 1. Problema e objetivo

**Problema:** a Komunick atende clientes pelo WhatsApp com o Zap Komunick (zap.komunick.com, Ticketz 1.0.132 com a
marca da Komunick). O Ticketz aberto não tem recursos que ferramentas do mercado contábil oferecem e que o pedido de
21/10/2026 tomou como inspiração: o ZapContábil (zapcontabil.com / zappycontabil.com.br) anuncia módulo de SLA,
carteira de clientes, permissões de acesso por horário e envios recorrentes. O próprio Ticketz guarda o campo `kanban`
nas etiquetas e o menu do zap.komunick.com traz o rótulo "Kanban", mas não existe tela de Kanban.

**Usuário principal:** gestor e atendentes de uma empresa que atende pelo WhatsApp com várias filas (por exemplo, os
setores Contábil, Fiscal e DP de um escritório de contabilidade).

**Objetivo:** o gestor enxerga quem está sem resposta e há quanto tempo, distribui clientes por responsável, organiza
os atendimentos em etapas e controla quando cada atendente pode entrar; lembretes que se repetem saem sozinhos.

## 2. Escopo

**Escopo descrito:** código-fonte acessível (RF-001), painel de SLA (RF-002), carteira de clientes (RF-003), Kanban por
etiquetas (RF-004), horário de acesso por usuário (RF-005) e agendamento recorrente (RF-006), sobre o Ticketz como ele
é hoje (filas, chatbot, etiquetas, agendamentos, perfis admin e usuário).

**Fora do escopo:** canais oficiais (API oficial do WhatsApp, Instagram, Messenger; no zap.komunick.com chegam pelo
Ticketz PRO, que é fechado), integrações financeiras e contábeis (Asaas, Omie, Nibo, G-Click, Conta Azul), PABX
próprio, aplicativo móvel, IA, alerta sonoro ou pop-up de SLA e relatórios exportáveis.

**Fluxo principal:** o cliente escreve → o atendimento entra na fila (ou direto no responsável da carteira) → o painel
de SLA mostra a espera e destaca o que passou do prazo → o atendente responde e move o atendimento pelas colunas do
Kanban → lembretes recorrentes continuam saindo nas datas da série.

## 3. Funcionalidades e critérios de aceite

### RF-001 — Código-fonte acessível (AGPL)

**O que faz:** a tela "Sobre" leva ao código desta versão (github.com/Komunick/zap-komunick) e credita o Ticketz.

**Regras importantes:** a licença AGPL-3.0 do Ticketz exige que todo usuário do sistema consiga o código da versão
modificada; o README do Ticketz pede que o link continue fácil de achar e aponte para o código das mudanças.

**Cenário de sucesso:**

Dado um usuário qualquer logado,
quando abre "Sobre" no menu do perfil,
então vê o link "Código-fonte desta versão" para o repositório do fork.

### RF-002 — Painel de SLA

**O que faz:** mostra, em tempo quase real, os atendimentos em aberto e quanto tempo o cliente espera resposta de uma
pessoa, destacando o que passou do prazo. Inspiração: "Módulo SLA" do ZapContábil.

**Regras importantes:**
- O prazo é definido pela empresa em Configurações ("Prazo de SLA", em minutos). Vale 0 (desligado) até o gestor
  definir; com 0 nada aparece como estourado.
- A espera começa na primeira mensagem do cliente ainda não respondida. Mensagem enviada pela empresa só conta como
  resposta quando um atendente está com o atendimento (status "em atendimento"); mensagens do chatbot e da fila não
  param o relógio. Fechar o atendimento zera a espera. Enquanto o chatbot conduz a conversa, o atendimento não conta
  como "aguardando resposta".
- Estourado: espera maior que o prazo (exatamente no prazo ainda está no prazo).
- Antigo: atendimento aberto há mais horas do que o limite configurado ("Alerta de antigos", em horas). O padrão é
  72 h, a referência usada pelo ZapContábil ("Aberto há +72h"); 0 desliga. Conta desde o início do ciclo atual do
  atendimento.
- Situação de cada atendimento: Estourado, +N h (antigo) ou No prazo; estourado tem prioridade.
- O painel mostra: em aberto, aguardando, em atendimento, estourados, antigos, clientes sem resposta, grupos em aberto
  e grupos sem resposta; tabelas por fila e por atendente (com "Sem dono" para quem não tem atendente); lista dos
  atendimentos com cliente, número, fila, responsável, status, tempo de espera e situação, com os estourados primeiro.
  Atualiza a cada minuto.
- Só administradores veem o painel. Todos os usuários veem o selo "SLA" na lista de atendimentos nos atendimentos
  estourados, com o tempo de espera no balão.
- Para atendimentos que já estavam abertos na instalação, a espera é estimada pela primeira mensagem do cliente depois
  da última mensagem da empresa.

**Cenário de sucesso:**

Dado o prazo de 30 minutos e um cliente aguardando há 31 minutos,
quando o gestor abre o painel de SLA,
então o atendimento aparece como "Estourado", entra na contagem de estourados da fila e do atendente, e mostra o selo
"SLA" na lista de atendimentos.

**Exceção importante:**

Dado um atendente sem perfil de administrador,
quando tenta abrir o painel de SLA,
então o acesso é recusado.

### RF-003 — Carteira de clientes

**O que faz:** cada contato pode ter um atendente responsável; com a opção ligada, o atendimento novo desse contato vai
direto para ele. Inspiração: "Carteira de clientes" do ZapContábil.

**Regras importantes:**
- Só administradores definem ou trocam o responsável; grupos não têm responsável; o responsável precisa ser da mesma
  empresa. Se o usuário for excluído, o contato fica sem responsável.
- Opção da empresa "Atendimento de contato da carteira": "Seguir o fluxo normal" (padrão) ou "Enviar direto para o
  responsável".
- Ligada, o atendimento novo ou reaberto do contato fica aguardando com o responsável atribuído, sem passar pelo
  chatbot, na primeira fila do responsável atendida pela conexão (ou na primeira fila dele).
- A tela de contatos mostra a coluna "Carteira" e o filtro "Minha carteira".

**Cenário de sucesso:**

Dado um contato com responsável Ana e a opção ligada,
quando o contato manda mensagem e abre um atendimento,
então o atendimento já aparece com a Ana, na fila dela, sem passar pelo menu do chatbot.

**Exceção importante:**

Dado a opção desligada ou um contato sem responsável,
quando o contato abre um atendimento,
então o fluxo normal do Ticketz é mantido.

### RF-004 — Kanban por etiquetas

**O que faz:** quadro com a coluna "Em aberto" e uma coluna por etiqueta marcada como Kanban; arrastar um atendimento
de coluna troca a etiqueta dele.

**Regras importantes:**
- Na edição da etiqueta, a chave "Usar como coluna do Kanban" define se ela é coluna. As colunas aparecem em ordem
  alfabética (prefixos como "1 - ", "2 - " ordenam o quadro).
- Mover troca apenas a etiqueta de Kanban do atendimento; as outras etiquetas continuam. Voltar para "Em aberto" tira a
  etiqueta de Kanban.
- O quadro mostra os atendimentos em aberto que o usuário pode ver na lista: o administrador vê todos; o atendente vê
  os seus e os aguardando das filas dele, e só move esses. Mostra até 500, os movimentados mais recentemente.
- Além de arrastar, cada cartão tem o menu "Mover para" (teclado e leitores de tela).

**Cenário de sucesso:**

Dado as colunas "1 - Documentos pendentes" e "2 - Em análise",
quando o atendente arrasta um atendimento de "Em aberto" para "2 - Em análise",
então o atendimento passa a ter só a etiqueta "2 - Em análise" entre as de Kanban e continua com as outras.

**Exceção importante:**

Dado um atendimento de outro atendente,
quando um atendente sem perfil de administrador tenta movê-lo,
então o movimento é recusado.

### RF-005 — Horário de acesso por usuário

**O que faz:** o administrador define dias da semana e faixa de horário em que cada usuário pode entrar. Inspiração:
"Permissões de acesso e horários" do ZapContábil.

**Regras importantes:**
- Sem restrição por padrão. Com restrição, é preciso ao menos um dia e início diferente do fim.
- Faixa que termina antes de começar (ex.: 22:00 às 06:00) atravessa a meia-noite e pertence ao dia em que começa.
- Fora do horário o login é recusado com aviso próprio e a renovação da sessão também, o que encerra a sessão aberta
  na próxima renovação.
- Administradores e o superusuário nunca são bloqueados. Vale o horário do servidor.

**Cenário de sucesso:**

Dado um atendente liberado de segunda a sexta, das 08:00 às 18:00,
quando tenta entrar num domingo,
então o login é recusado com a mensagem de que o usuário não tem acesso neste horário.

### RF-006 — Agendamento recorrente

**O que faz:** o agendamento de mensagem pode repetir todo dia, toda semana, todo mês ou todo ano, com data final
opcional. Inspiração: lembretes recorrentes do ZapContábil.

**Regras importantes:**
- Depois de cada envio (ou falha de envio), o próximo agendamento da série é criado como pendente. O envio com falha
  continua com status de erro.
- As datas seguem a primeira da série: mensal no dia 31 vai para o último dia dos meses curtos e volta ao 31; anual em
  29/02 vai para 28/02 fora dos anos bissextos.
- Se um envio ficou para trás (sistema fora do ar), a série continua na próxima data futura, sem disparar os
  atrasados.
- A data final vale até o fim daquele dia e não pode ser antes do primeiro envio. Editar a data ou a repetição
  recomeça a série a partir do novo envio; editar só o texto mantém a série.

**Cenário de sucesso:**

Dado um lembrete mensal a partir de 31/01,
quando o envio de 31/01 acontece,
então aparece um novo agendamento pendente para 28/02 e, depois dele, para 31/03.

## 4. Restrições e cuidados

**Uso e acesso:** navegador, perfis do Ticketz (admin e usuário). Painel de SLA, carteira e horário de acesso são
geridos só por administradores.

**Dados e integrações:** dados de contatos e mensagens dos clientes das empresas usuárias. Nenhum dado novo sai do
sistema; nenhuma integração externa nova.

**Limites reais:** licença AGPL-3.0 (RF-001). O Ticketz PRO é fechado e não pode ter código copiado para cá.

## 5. Validação e pendências

**Quem valida:** responsável pela Komunick, com uma empresa de teste e uma conexão de WhatsApp de homologação.

**Como saber se resolveu o problema:** depois de algumas semanas de uso, conversar com o gestor sobre os atendimentos
estourados que ele passou a ver no painel e se a carteira e o Kanban substituíram controles feitos fora do sistema.

**Dúvidas ou riscos:**
- Publicação: o zap.komunick.com roda hoje o Ticketz 1.0.132; a Komunick guarda um backup do Ticketz PRO em
  `Komunick/ticketz-pro`. Trocar a produção por este fork faz perder o que for exclusivo do PRO (por exemplo, canais
  oficiais). Decisão do responsável, antes de qualquer publicação.
- Prazo de SLA e limite de "antigos": valores de cada empresa, definidos pelo gestor (não há valor padrão do prazo).
- Ordem das colunas do Kanban por nome: confirmar se atende ou se precisa de ordem manual.
- Atendente que responde pelo celular sem aceitar o atendimento não para o relógio do SLA (a resposta chega com o
  atendimento ainda aguardando).
