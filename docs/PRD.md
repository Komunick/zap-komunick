# PRD — SuperChat

**Komunick Inteligência e Tecnologia**
**Responsável:** Jailson (Komunick) · **Atualizado em:** 04/11/2026
**Fonte oficial:** `docs/PRD.md` no repositório
**Validado por:** Pendente

Este PRD delimita as duas primeiras entregas do fork: RF-001 a RF-006 (Linear KOM-136 e subtarefas KOM-137 a KOM-142)
e RF-007 a RF-009 (Linear KOM-144, com KOM-145 visual, KOM-146 pausar e motivo e KOM-147 agendamento completo). Não há
especificação separada em `docs/specs/` para elas.

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
etiquetas (RF-004), horário de acesso por usuário (RF-005), agendamento recorrente (RF-006), pausar atendimento e motivo
de finalização (RF-007), agendamento para vários contatos com anexo e dia útil (RF-008) e a identidade visual da
Komunick (RF-009) o chat interno com conversas e contatos (RF-010) , as
ações em lote nos atendimentos (RF-011), os filtros completos da lista (RF-012), os usuários online (RF-013), a carteira em lote (RF-014), o painel de métricas
(RF-015), o histórico completo com contexto na transferência (RF-017), os clientes da agenda (RF-018) e as etiquetas
por setor com filtros de contatos (RF-019), sobre o Ticketz como ele é hoje (filas, chatbot, etiquetas, agendamentos,
perfis admin e usuário).
A segunda entrega saiu da comparação com o ZapContábil feita em 21/10/2026 numa conta de cliente, só olhando, sem mudar
nada nela.

**Fora do escopo:** canais oficiais (API oficial do WhatsApp, Instagram, Messenger; no zap.komunick.com chegam pelo
Ticketz PRO, que é fechado), integrações financeiras e contábeis (Asaas, Omie, Nibo, G-Click, Conta Azul), PABX
próprio, aplicativo móvel, IA, alerta sonoro ou pop-up de SLA e relatórios exportáveis.

**Rodada 3 em planejamento:** o pedido de 27/10/2026 para IA e Acessórias/SCI está registrado como proposta em
[`docs/specs/rodada-3-ia-integracoes.md`](specs/rodada-3-ia-integracoes.md). O planejamento não habilita integrações
nem promove os recursos a entregues. A transcrição opcional herdada já existe no código; sua ativação e credencial
atual não foram verificadas. O novo uso de mensagens/dados externos exige definir o piloto e o tratamento dos dados.
O [P0 de credenciais e isolamento](specs/p0-credenciais-isolamento.md) foi autorizado separadamente em 27/10/2026;
seu comportamento está definido em RF-020, sem habilitar os demais recursos propostos.
O [P1 de resumos e sugestões](specs/p1-assistente-revisao.md) foi autorizado depois, com provedor simulado e dados
fictícios (RF-021). Esse percurso não habilita um modelo real nem os conectores.
O [P2 de consultas Acessórias](specs/p2-acessorias-consultas.md) também foi autorizado com mocks e dados fictícios
(RF-022), sem conexão ao fornecedor real.
O P3 SCI foi autorizado em 29/10/2026 somente como [painel de publicações simuladas](specs/p3-sci-consultas.md)
(RF-024); produto/módulo e contrato real continuam pendentes, sem download ou marcação de leitura no fornecedor.
O P4 foi autorizado em 30/10/2026 como [consultas integradas com mocks](specs/p4-consultas-integradas.md)
(RF-025), com revisão humana. Sincronização e conexões reais continuam fora do recorte.

**Fluxo principal:** o cliente escreve → o atendimento entra na fila (ou direto no responsável da carteira) → o painel
de SLA mostra a espera e destaca o que passou do prazo → o atendente responde e move o atendimento pelas colunas do
Kanban → lembretes recorrentes continuam saindo nas datas da série.

Em **Novo atendimento**, a fila selecionada usa um WhatsApp conectado da própria empresa e vinculado a ela.
Se houver mais de um, o sistema prioriza o canal padrão entre os elegíveis e depois o de menor ID.
Sem canal elegível, o sistema avisa e não abre o atendimento. Quando a abertura sem fila é permitida,
o sistema continua usando a escolha padrão da empresa.

Em um atendimento de WhatsApp, transferências para outra fila exigem que a fila de destino também
atenda pelo número da conversa. Saudações, avisos de horário e opções do chatbot só usam textos de
uma fila atendida por esse canal.

Na entrada, a primeira mensagem de um WhatsApp vinculado a uma única fila já fica nessa fila.
Se um atendimento reutilizado estiver em uma fila incompatível, a entrada resolve o vínculo antes de gravar
a nova mensagem. Com várias filas elegíveis, o atendimento volta à seleção normal de fila.

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
  chatbot, na primeira fila do responsável atendida pela conexão. Se o responsável tem filas e nenhuma atende pelo
  canal da conversa, vale o roteamento normal da entrada.
- A tela de contatos mostra a coluna "Carteira" e o filtro de carteira descrito no RF-019, incluindo "Minha carteira".

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
- A mesma autorização vale para movimentação por API, inclusive remoção da coluna. Negar antes de alterar etiquetas,
  emitir eventos ou devolver dados de atendimento fora das permissões atuais; ver [correções de integração](specs/correcoes-integracao-pr29.md).
- Além de arrastar, cada cartão tem o menu "Mover para" (teclado e leitores de tela).
- Cada atendimento aparece como um post-it: papel na cor da etiqueta da coluna (amarelo em "Em aberto"), com fita, canto
  dobrado e inclinação pequena e fixa. A coluna tem largura fixa de 290 px; a prévia da mensagem é de uma linha, sem marcas
  de formatação.

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
- A próxima ocorrência conserva o vínculo com a fila ou atendimento escolhido no agendamento.

**Cenário de sucesso:**

Dado um lembrete mensal a partir de 31/01,
quando o envio de 31/01 acontece,
então aparece um novo agendamento pendente para 28/02 e, depois dele, para 31/03.

### RF-007 — Pausar atendimento e motivo de finalização

**O que faz:** o atendente pausa um atendimento em andamento e retoma quando puder; ao finalizar, a empresa pode exigir
um motivo, escolhido de uma lista cadastrada pelo administrador. Inspiração: "Pausar" e os motivos de finalização do
ZapContábil.

**Regras importantes:**
- Só atendimento em andamento ("em atendimento") pode ser pausado. O pausado fica na aba "Pausados", com o mesmo
  atendente e a etiqueta "Pausado" na lista. O campo de mensagem fica travado até "Retomar", que devolve o atendimento
  para "em atendimento" com o mesmo atendente. Do pausado também dá para finalizar.
- O atendimento pausado continua recebendo as mensagens do cliente (não abre outro atendimento).
- O SLA não conta atendimento pausado: ele sai do painel e não leva o selo. A marca de espera continua sendo gravada,
  então, ao retomar, a espera conta desde a primeira mensagem do cliente sem resposta, inclusive o tempo pausado.
- Motivos de finalização (menu de administração, só administradores): nome de 2 a 120 caracteres, sem repetir
  (maiúsculas e minúsculas contam como iguais), ativar e desativar, renomear e excluir. Desativar tira o motivo da
  lista do atendente e guarda o histórico; excluir deixa os atendimentos já finalizados com ele como "sem motivo".
- "Exigir motivo ao finalizar" em Configurações (padrão: não exigir). Exigido, quem finaliza escolhe um motivo ativo e
  pode escrever uma observação de até 1000 caracteres. Vale quando um atendente finaliza; grupos e encerramentos
  automáticos (inatividade, conexão, chatbot) ficam de fora.
- Mesmo sem exigir, um motivo enviado precisa existir na empresa e estar ativo.
- A página de motivos mostra quantos atendimentos foram finalizados com cada motivo nos últimos 30 dias, e quantos sem
  motivo.

**Cenário de sucesso:**

Dado "Exigir motivo ao finalizar" ligado e os motivos "Dúvida resolvida" e "Encaminhado a outro setor",
quando o atendente clica em "Finalizar" e escolhe "Dúvida resolvida",
então o atendimento vai para "Resolvidos" e passa a contar no uso de "Dúvida resolvida".

**Exceções importantes:**

Dado "Exigir motivo ao finalizar" ligado,
quando um atendente tenta finalizar sem motivo (por exemplo, por uma chamada direta à API),
então a finalização é recusada com o aviso "Escolha o motivo para finalizar o atendimento".

Dado um atendimento aguardando,
quando alguém tenta pausá-lo,
então o pedido é recusado: só atendimento em andamento pode ser pausado.

### RF-008 — Agendamento para vários contatos, com anexo e dia útil

**O que faz:** o mesmo agendamento sai para vários contatos ou para todos os contatos de uma etiqueta, com um arquivo
anexo e a opção de enviar só em dia útil. Inspiração: os agendamentos do ZapContábil.

**Regras importantes:**
- No novo agendamento, os contatos escolhidos e os da etiqueta somam, sem repetir, até 500 por vez; só contatos da
  empresa. Cada contato ganha o seu agendamento, que depois se edita e exclui um a um. A edição continua com um contato
  por agendamento, como no Ticketz.
- Na tela Agendamentos, a fila escolhida define os canais elegíveis para o envio. Quando o agendamento é aberto
  dentro de uma conversa, ele fica vinculado ao contato, à fila e ao canal desse atendimento.
- O envio fica com erro se o vínculo exigido for removido, o atendimento mudar para outra fila ou o canal
  necessário estiver indisponível. Agendamentos antigos sem vínculo só saem se houver um único WhatsApp
  cadastrado na empresa e ele estiver conectado.
- Anexo: um arquivo por agendamento, enviado uma vez e guardado na pasta da empresa; vai junto com a mensagem para
  cada contato. O servidor só aceita anexo que esteja na pasta da própria empresa.
- "Enviar só em dia útil": se a data cair em sábado, domingo ou feriado, o envio passa para o próximo dia útil, no mesmo
  horário. Feriados considerados: os nacionais (1/1, 21/4, 1/5, 7/9, 12/10, 2/11, 15/11, 20/11 a partir de 2024 e
  25/12) mais Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi. Feriados estaduais e municipais não
  entram.
- Com repetição, cada data da série é calculada a partir da data pedida e só depois levada ao dia útil, então a série
  não se desloca. Exemplo: todo dia 10; se um dia 10 cair no sábado, aquele envio vai na segunda 12 e o próximo volta
  ao dia 10.

**Cenário de sucesso:**

Dado um agendamento para sábado, 31/10/2026, às 10:00, com "Enviar só em dia útil",
quando o atendente salva,
então o envio fica para terça, 03/11/2026, às 10:00 (pula o domingo e Finados).

Dado os contatos Padaria e Mercado escolhidos e a etiqueta VIP com Padaria e Oficina,
quando o atendente salva o agendamento,
então são criados três agendamentos, um para cada contato.

**Exceção importante:**

Dado um novo agendamento sem contato e sem etiqueta,
quando o atendente tenta salvar,
então o formulário pede pelo menos um contato ou uma etiqueta.

### RF-009 — Identidade SuperChat e Komunick

**O que faz:** o sistema abre como SuperChat, com logo `superChat` e endosso `Powered by Komunick` usando a marca oficial
da Komunick Inteligência e Tecnologia, e um visual mais atual que o do Ticketz e o do ZapContábil, com
referências do Dribbble (painéis de atendimento e CRMs de 2025 e 2026).

**Regras importantes:**
- Nome de produto padrão SuperChat, inclusive na inicialização, PWA, títulos, Sobre e configurações legadas de marca.
  Preservar nomes personalizados, uploads Whitelabel, identificadores técnicos e créditos AGPL/Ticketz.
  Ver [identidade SuperChat](specs/superchat-identidade.md); a troca não reescreve dados reais nem segredos 2FA.
- Logo tipográfica `superChat` na composição Essencial, sem símbolo junto ao nome; símbolo compacto preservado
  no trilho recolhido e nos ícones. Endosso com geometria oficial Komunick preservada. Usar as cores da Komunick:
  verde #35B62E, preto #020605 e a fonte Manrope. Botões e textos em verde
  usam o tom mais escuro #1F7F1B no tema claro, para manter o contraste. O logo e a cor que a empresa configurar em
  Whitelabel continuam valendo.
- A opção A, Essencial, usa Manrope mais leve em `super` e peso maior no `Chat` verde, com Powered by menor.
  No login, Sobre e menu aberto, o endosso ocupa uma linha discreta abaixo da marca; no header Foco/Painel,
  fica à direita.
  O cabeçalho do menu aberto tem altura mínima de 72 px e continua crescendo para acomodar logos personalizadas sem
  cortes. Conferir legibilidade e proporção nos dois temas e no celular. Ver [logo Essencial](specs/superchat-logo-essencial.md);
  o [topo minimalista anterior](specs/superchat-topo-minimalista.md) preserva o registro da composição substituída.
- Tema claro e escuro com as mesmas cores em todas as telas: menu, barra do topo, lista de atendimentos, chat, Kanban,
  SLA, cadastros e login.
- Direção visual "B — Menu preto" (escolhida pelo responsável entre três no Stitch): menu lateral #020605 nos dois
  temas, com ícone e barra verdes no item ativo, e o atendimento selecionado na lista com contorno verde de 2 px. As
  telas de referência estão em `docs/design/stitch-direcao-b` (inspiração visual, não especificação de cada tela).
- Três layouts, escolhidos no menu do usuário e lembrados no navegador: "Workspace" (trilho de ícones, que abre em menu
  largo), "Foco" (abas de navegação no topo, sem barra lateral) e "Painel" (barra lateral compacta de 224 px, clara e
  quente no tema claro, que recolhe para o trilho). Barra do topo plana com busca global (Ctrl K: páginas e
  atendimentos que o usuário pode ver), interruptor de tema e usuário; conteúdo sem cartões flutuantes. No celular os três
  usam a gaveta. Referências em `docs/design/stitch-layouts`.
- No desktop, passar o mouse sobre o trilho recolhido abre o menu imediatamente, sem clique ou espera adicional.
  O menu permanece aberto ao navegar pelos itens ou sair da área; botão, teclado e preferência salva continuam
  controlando o recolhimento. Toque e gaveta do celular mantêm o comportamento existente.
- Atendimentos: uma linha de visões com contadores (em atendimento ou meus, aguardando, pausados, resolvidos) mais a
  busca; filas como chips que o usuário liga e desliga (sempre fica ao menos uma); cada atendimento em uma linha enxuta;
  em telas de 1400 px ou mais, painel do cliente fixo à direita da conversa (carteira, fila, atendente, SLA, etiquetas,
  notas e edição do contato); abaixo disso, o contato continua abrindo numa gaveta.
- Menu lateral legível: itens de 48 px, ícones de 26 px, texto de 15,5 px e títulos de seção de 12,5 px; largura de 264 px
  aberto e 72 px só com ícones (a lista rola quando não cabe na tela).
- "Tarefas" fica oculto no menu lateral, nas abas de navegação e na paleta Ctrl K. A página continua acessível pelo
  endereço `/todolist`.
- Financeiro fica fora da navegação em todos os layouts. A interface de atualização e reinício de contêineres também
  fica fora de Configurações, incluindo a opção móvel; APIs e infraestrutura de publicação são preservadas.
  Ver [navegação e marca](specs/superchat-navegacao-marca.md). A marca do navegador usa título SuperChat e um endereço
  próprio para seu favicon padrão, preservando personalizações Whitelabel.
- Login em duas colunas (formulário e painel da marca); no celular, só o formulário.
- Após autenticar, usuário comum entra em `/tickets`; administrador com interface administrativa disponível entra
  em `/`. A restauração da sessão e o redirecionamento não montam o dashboard para perfis sem acesso à sua interface.
  As APIs administrativas mantêm seus bloqueios. Ver [correção do login por perfil](specs/login-dashboard-perfil.md).
- Português é o idioma padrão (o idioma do navegador não é mais adivinhado; a escolha do usuário no menu continua
  valendo). O tema segue o claro ou escuro do sistema operacional, inclusive quando ele muda com a tela aberta; o
  interruptor "Modo escuro" fixa uma escolha e "Tema do sistema (Windows)", no menu do usuário, volta a seguir o sistema.
- Barra de digitar mensagem (atendimentos e chat interno) em tom próprio: campo arredondado que flutua sobre o fundo da
  conversa, com contorno verde ao focar.
- Dashboard: saudação com o nome, período em botões (personalizado, 3, 7, 15, 30 e 90 dias), cartões "Agora" (equipe
  online, aguardando, em atendimento, cada um com rosca e as filas principais), indicadores do período com ícones,
  gráfico nas cores da marca e tabela da equipe.

**Cenário de sucesso:**

Dado uma instalação nova, sem Whitelabel configurado,
quando o usuário abre o login,
então vê o logo da Komunick, o botão verde e o painel da marca, no tema claro ou escuro que escolheu.

### RF-010 — Chat interno: conversas e contatos numa lista só

**Objetivo:** abrir a tela e já ver com quem falar, sem precisar criar uma "conversa" com título antes.

- Ao abrir, a lista mostra as conversas (grupos e conversas a dois, a mais recente primeiro, com a última mensagem e as
  não lidas) e, abaixo, as pessoas da empresa com quem ainda não há conversa. Uma busca filtra as duas partes.
- Clicar numa pessoa abre a conversa a dois com ela; se não existir, é criada na hora. Cada par de pessoas tem uma só
  conversa a dois, que mostra para cada lado o nome do outro.
- A conversa a dois não tem título, não muda de participantes e não pode ser excluída (apagaria o histórico dos dois).
  Grupos continuam com nome, participantes editáveis e exclusão pelo dono, agora no cabeçalho da conversa.
- A lista se atualiza em tempo real (mensagem nova sobe a conversa e soma não lidas; com a conversa aberta, ela é
  marcada como lida). No celular, a lista e a conversa aparecem uma de cada vez, com botão de voltar.
- A [melhoria de usabilidade](specs/chat-interno-usabilidade.md) distingue carregamento, vazio, busca sem resultados e
  falha recuperável na lista e no histórico. A busca pode ser limpa, e seleção e não lidas continuam identificáveis.
- Mensagens longas, quebras de linha e anexos respeitam a largura disponível nos dois temas. O campo de mensagem tem
  identificação acessível; Enter envia, Shift+Enter insere uma linha e a composição de texto não dispara envio.
- Envio pendente impede duplicação; uma falha conserva texto ou anexo para nova tentativa. Resultados atrasados do
  histórico não entram em outra conversa, e a mesma mensagem recebida por HTTP/socket não aparece duas vezes.

**Autorização:** o recorte aprovado de [autorização do chat](specs/chat-interno-autorizacao.md) restringe consulta,
histórico, envio e leitura à empresa e aos participantes atuais; somente o dono participante administra o grupo.
Participantes estrangeiros são recusados antes de qualquer alteração. Leitura usa o ator autenticado, e eventos vão
somente aos destinatários autorizados; quem sai do grupo recebe apenas a remoção da conversa, inclusive no popover.
Uploads são autorizados antes de receber arquivos e revalidados antes de persistir, com limpeza exclusiva da requisição
revogada. A melhoria anterior de interface não mudou essas permissões; este é o recorte separado de segurança.
**Anexos privados:** o [recorte de privacidade dos anexos internos](specs/chat-anexos-privados.md) move anexos novos e
legados identificados para armazenamento privado e entrega autenticada por mensagem. Empresa e participação atuais
são verificadas em cada acesso, inclusive reprodução parcial e download. Links públicos antigos do chat deixam de
entregar conteúdo; arquivos dos demais módulos mantêm seus contratos. A migração verifica integridade e conflitos
antes de remover cópias públicas, com retomada segura e sem perda das associações.
As [miniaturas da galeria privada](specs/chat-miniaturas-privadas.md) usam a mesma sessão autenticada da imagem
principal e respeitam a limpeza ao fechar ou trocar de identidade, sem fallback para URLs públicas.

O [suporte à migração no Windows](specs/chat-migracao-anexos-windows.md) mantém flush de diretórios, hashes e
retomada; uma falha no preflight recusa o cutover antes de publicar cópias privadas. A cópia privada existente
também é sincronizada antes de remover a origem pública. Não há fallback público nem dispensa da prontidão.

**Cenário de sucesso:**

Dado um atendente que nunca conversou com a colega Ana,
quando ele abre o Chat interno e clica em "Ana" na parte de contatos,
então a conversa a dois abre vazia, e depois da primeira mensagem ela aparece no topo das conversas dos dois.

### RF-011 — Ações em lote nos atendimentos

**Objetivo:** tratar vários atendimentos de uma vez (por exemplo, a fila acumulada depois de um feriado), com as mesmas
regras de quando se trata um por um.

- Botão "Selecionar" nas visões em atendimento, aguardando, pausados, grupos e busca (não em resolvidos). Na seleção,
  cada linha ganha uma caixa de marcar e o clique marca em vez de abrir a conversa; "Marcar todos" pega o que a lista
  mostra.
- Ações: **Aceitar** (só os aguardando da seleção, para quem aceita), **Transferir** (fila obrigatória; com atendente vai
  direto para ele, sem atendente volta à fila aguardando, como na transferência de um atendimento) e **Finalizar**
  (motivo e observação valem para todos; o motivo é exigido quando há motivos cadastrados; o cliente não recebe a
  pesquisa de avaliação).
- A ação adicional **Etiquetar** segue as regras do RF-019.
- Até 100 atendimentos por vez. Cada um passa pelas mesmas permissões e regras do atendimento individual; o que não
  puder ser alterado (situação mudou, sem permissão, falta de motivo) é contado à parte e os demais seguem.
- Trocar de visão ou concluir a ação sai da seleção.

**Cenário de sucesso:**

Dado 12 atendimentos aguardando na fila Fiscal depois de um feriado,
quando o atendente seleciona todos e escolhe "Aceitar",
então os 12 passam para "Em atendimento" com ele, e o aviso mostra "12 atendimento(s) atualizado(s)".

### RF-012 — Filtros completos na lista de atendimentos

**Objetivo:** achar rápido os atendimentos de um recorte (uma conexão, um atendente, um cliente da carteira, os que
estouraram o prazo) sem sair da visão em que se está.

- Botão "Filtros" na lista (em todas as visões, inclusive na busca), com o número de filtros ativos. O painel tem:
  conexão, atendente (só administradores), etiquetas (o atendimento ou o contato precisa ter todas), período de
  abertura (de/até), carteira (todas, minha carteira, sem responsável), só com mensagens não lidas e só com SLA
  estourado (pelo prazo da empresa; desligado quando o prazo está desligado).
- Os filtros somam com a visão, os chips de fila e a busca; nunca mostram o que o usuário não poderia ver.
- "Aplicar" vale para todas as visões; "Limpar" tira tudo. A escolha fica guardada no navegador.
- Atendimentos que chegam em tempo real passam pelos mesmos filtros; o que deixa de atender a eles sai da lista.

**Cenário de sucesso:**

Dado uma atendente com a carteira de clientes dela,
quando ela filtra "Minha carteira" e "Só com mensagens não lidas",
então a lista mostra só os clientes dela que mandaram mensagem e ainda não foram lidos, e continua assim ao recarregar.

### RF-013 — Usuários online

**Objetivo:** o gestor ver, num lugar só, quem da equipe está conectado e quanto cada um tem em mãos, para redistribuir
atendimentos antes que a fila acumule.

- Página "Usuários online" (menu Gerência, só administradores). No topo: online, em atendimento, online sem
  atendimento, offline e, quando houver, fora do horário.
- Um cartão por pessoa: situação (online, offline ou "fora do horário de acesso" quando a sessão continua aberta
  depois do horário permitido), há quanto tempo está online ou quando foi vista por último ("nunca entrou" para quem
  não entrou), atendimentos em andamento, pausados e finalizados hoje, e as filas dela.
- Ordem: fora do horário primeiro, depois os online mais ocupados, depois os offline por quem saiu por último. Opção
  de esconder os offline.
- Atualiza sozinha quando alguém entra ou sai e quando atendimentos mudam, e a cada minuto para os tempos.
- "Online" é ter o sistema aberto em algum navegador (sessão do socket); não mede se a pessoa está na frente da tela.

**Cenário de sucesso:**

Dado três atendentes com o sistema aberto e um deles com oito atendimentos,
quando o gestor abre "Usuários online",
então vê os três online, o mais ocupado no topo com "8 em atendimento", e quem está online sem atendimento no resumo.

### RF-014 — Carteira em lote

**Objetivo:** montar e reorganizar carteiras sem abrir contato por contato: distribuir os clientes entre a equipe e
passar a carteira inteira de quem sai para quem fica.

- Em Contatos (só administradores), uma caixa de marcar por contato e uma no cabeçalho para marcar a lista visível.
  Com contatos marcados aparece a barra: escolher o responsável e "Definir responsável", ou "Tirar da carteira".
- Botão "Transferir carteira": de um responsável (ou dos contatos sem responsável) para outro (ou para ninguém),
  mostrando antes quantos contatos a carteira tem. Origem e destino iguais não são aceitos.
- Grupos nunca entram em carteira: são ignorados e o aviso diz quantos foram. Até 500 contatos marcados por vez; a
  transferência leva a carteira inteira.
- O responsável precisa ser da mesma empresa. A lista recarrega depois da ação e os outros usuários recebem a mudança
  em tempo real.

**Cenário de sucesso:**

Dado uma atendente que sai da empresa com 120 clientes na carteira,
quando o gestor escolhe "Transferir carteira" dela para outro atendente,
então os 120 passam para o novo responsável, e as próximas conversas desses clientes já entram na fila dele.

### RF-015 — Painel de métricas

**Objetivo:** o gestor acompanhar volume, tempos e qualidade do atendimento num período, por fila e por atendente,
sem montar planilha.

- Página "Métricas" (menu Gerência, só administradores), com período em botões (7, 30, 90 dias ou personalizado, até
  366 dias) e filtros de fila e de atendente.
- Indicadores: atendimentos abertos no período, finalizados, tempo médio de espera, tempo médio de atendimento,
  respondidos no prazo do SLA (desligado quando o prazo está desligado), novos contatos e nota média das avaliações.
- Atendimentos por dia (abertos e finalizados), tabela por fila e por atendente (atendimentos, finalizados, espera e
  atendimento médios, no prazo, nota), motivos de finalização com a porcentagem e mapa dos horários de maior
  movimento (dia da semana por hora, no fuso de São Paulo).
- "Exportar CSV" baixa o que está na tela, separado por ponto e vírgula (abre direto no Excel em português).
- Um atendimento é um ciclo de atendimento (aceitar, pausar e retomar, finalizar); conversas de grupo ficam de fora.

**Cenário de sucesso:**

Dado um mês com 400 atendimentos na fila Fiscal,
quando o gestor abre "Métricas" com 30 dias e a fila Fiscal,
então vê quantos foram finalizados, quanto tempo os clientes esperaram em média, quantos foram respondidos no prazo e
quem finalizou mais, e baixa a planilha para a reunião.

### RF-016 — Segurança da conta, IPs permitidos e auditoria

**Escopo retomado em 27/10/2026:** concluir o trabalho de segurança preservado: verificação em duas etapas no login,
Segurança da conta, IPs permitidos, consulta de auditoria e indicação/reset de 2FA em Usuários.

- Cada usuário pode ativar 2FA por aplicativo autenticador, lendo o QR ou informando a chave e confirmando um código.
  A ativação apresenta oito códigos de recuperação, de uso único e mostrados somente nesse momento. Gerar novos
  códigos invalida os anteriores. Desativar exige a senha e um segundo fator válido.
- Depois da senha correta, contas com 2FA só recebem sessão após confirmar o código do aplicativo ou de recuperação.
  O desafio expira em cinco minutos; o segundo fator aceita até cinco tentativas por janela de dez minutos. Ao esgotar
  o limite, é necessário aguardar o fim da janela. Desafios e códigos
  consumidos não podem ser reutilizados. Voltar permite trocar de conta sem preservar a senha ou o desafio.
- Administradores veem a indicação de 2FA em Usuários e podem redefini-la para outro usuário da própria empresa que
  perdeu o autenticador, com confirmação. A conta própria usa o fluxo de desativação com senha e código.
- Administradores configuram IPs ou redes CIDR permitidos da empresa (IPv4/IPv6), com um endereço/rede por linha.
  A restrição vem desligada. A tela mostra o IP reconhecido pelo servidor; lista ativa vazia, entradas inválidas e
  mudanças que bloqueiem o próprio administrador são recusadas. Superusuários mantêm acesso de recuperação.
- A restrição de IP vale no login, na confirmação de 2FA e na renovação de sessão. Ativar, desativar ou redefinir 2FA
  invalida desafios e renovações anteriores; ativar/desativar preserva a sessão normal atual com um novo cookie de
  renovação. Em sessão impersonada, limpa o cookie e exige novo login, sem converter a sessão em normal.
  Tokens de acesso já emitidos mantêm a validade de até quinze minutos.
- A ação "Acessar como" em Empresas exige superusuário atual, com token e cookie normais da mesma conta e contexto
  cadastral válido. A sessão assumida fica vinculada à origem; Sair retorna à conta original após revalidar origem e
  destino. Retorno e renovação recusam vínculos obsoletos ou privilégios revogados. A lista de IPs da identidade de
  destino também vale na emissão dessas sessões, preservando o acesso de recuperação do superusuário.
- Sessões impersonadas anteriores à vinculação completa exigem novo login. A correção protege a entrada, o retorno
  e a renovação; tokens de acesso já emitidos mantêm o TTL de até quinze minutos, sem revogação imediata nos demais
  caminhos. Ver [autorização da impersonação](specs/autorizacao-impersonacao.md).
- Administradores consultam a auditoria da própria empresa, com período, usuário, ação e paginação. São registrados
  eventos de autenticação, alterações de 2FA, da lista de IPs, de usuários e de configurações, com data, autor, ação e IP.
  Senhas, códigos, segredos de autenticador e tokens não aparecem na auditoria nem nos logs de requisição.

**Cenários de aceite:**

Dada uma conta com 2FA ativo, quando a senha é aceita, a tela pede o segundo fator sem abrir a sessão. Um código
válido conclui o acesso; um código incorreto mantém a etapa com erro; um código de recuperação usado é recusado.

Dado um administrador configurando IPs permitidos, quando tenta ativar uma lista vazia, inválida ou que exclua seu
próprio IP, recebe o motivo e a configuração anterior permanece. Uma lista válida pode ser salva e desativada.

Dado um administrador na auditoria, quando filtra por usuário e ação de segurança, encontra os eventos da empresa
correspondentes, sem valores secretos; um atendente não acessa essa consulta nem a configuração de IPs.

### RF-017 — Histórico completo do cliente e contexto na transferência

**Problema relatado (27/10/2026):** mensagens antigas de conversas resolvidas não aparecem em alguns contatos, e ao
transferir um cliente o setor que recebe não sabe do que se trata. Causa do primeiro: quando um cliente com conversa
resolvida volta a escrever, o sistema abre um atendimento novo (a reabertura automática vem desligada) e a conversa só
mostrava as mensagens do atendimento aberto.

- A conversa mostra o histórico de todos os atendimentos do cliente, do mais antigo ao atual, com uma divisória
  "Atendimento anterior #N" e "Atendimento atual #N".
- Com a visibilidade por fila, o histórico de um atendimento anterior só aparece se a equipe tiver acesso
  à fila desse atendimento. A regra vale para mensagens antigas sem fila, anexos e citações. O atendimento
  atual mantém o contexto que a equipe recebe em uma transferência.
- Na janela de transferência, um campo "Contexto para o setor" e a lista das últimas mensagens do atendimento para
  destacar. A nota aparece na conversa num cartão próprio ("Nota de transferência", de onde para onde, quem
  escreveu), visível só para a equipe: o cliente não recebe nada, não conta como resposta no SLA e não vira a última
  mensagem do atendimento.
- A nota só cita mensagens do próprio atendimento que está sendo transferido (as que a janela oferece); até 30
  mensagens e 2.000 caracteres. Id de mensagem de outro atendimento do cliente é ignorado.

**Cenário de sucesso:**

Dado um cliente que pediu a folha de setembro no DP semana passada (atendimento resolvido),
quando ele volta a escrever pedindo a guia do DAS e o atendente do DP transfere para o Fiscal com a nota "quer a guia
do DAS de outubro; CNPJ conferido",
então o Fiscal vê a nota destacada na conversa e as mensagens de hoje, e o cliente não recebe nenhum aviso.

### RF-018 — Clientes aparecem antes de escrever

**Problema relatado (27/10/2026):** "clientes não aparecem enquanto não manter contato" — em Contatos, para iniciar
conversa e na lista de atendimentos. Causa: os contatos da agenda do WhatsApp ficavam só numa tabela interna do Baileys;
um cliente só entrava em Contatos quando mandava mensagem ou pela importação manual.

- A agenda do WhatsApp conectado entra em Contatos sozinha, sempre que o WhatsApp sincroniza os contatos (ao conectar
  e quando a agenda muda). Só entram números que ainda não existem; o nome cadastrado pela equipe nunca é trocado.
  Grupos, listas de transmissão, canais e IDs sem número ficam de fora. Configuração "Agenda do WhatsApp em Contatos"
  (Configurações › SLA e carteira de clientes), ligada por padrão.
- A paleta (Ctrl K) ganha o grupo "Clientes": escolher um cliente abre a janela de nova conversa já com ele, inclusive
  quem nunca escreveu ou só tem atendimentos resolvidos.
- A busca de Atendimentos mostra, acima dos resultados, os clientes encontrados pelo nome ou número com o botão
  "Conversar". Conversas resolvidas continuam aparecendo na busca e reabrem pelo botão da conversa, agora com o histórico
  completo (RF-017).

**Cenário de sucesso:**

Dado um escritório que conecta o WhatsApp com 300 clientes na agenda,
quando a atendente procura "Padaria" na paleta,
então encontra a Padaria Avenida mesmo que ela nunca tenha escrito e abre a conversa com um clique.

### RF-019 — Etiquetas por setor e filtros

**Pedido (27/10/2026):** aplicar etiquetas na conversa e na lista de atendimentos, filtrar contatos por etiqueta e
organizar as etiquetas por setor. Etiquetas automáticas ficam fora desta entrega.

**Regras importantes:**
- O cadastro de etiqueta permite escolher um ou mais setores da própria empresa. Sem seleção, a etiqueta vale para
  todos; a tabela de Etiquetas mostra os setores ou "Todos os setores". Etiquetas anteriores continuam gerais até
  que seu cadastro seja alterado.
- Nas listas de etiquetas, o administrador vê todas as da empresa; os demais usuários veem as gerais e as dos seus
  setores. Ao etiquetar uma conversa, as opções são as etiquetas desse setor e as gerais; sem setor, somente as gerais.
  A mesma restrição vale para novas associações pelo servidor. Etiquetas anteriores de outro setor podem permanecer
  após uma transferência e ser removidas explicitamente.
- O botão "Etiquetar" nas ações da linha permite marcar e desmarcar etiquetas sem abrir a conversa. A seleção salva
  a cada alteração e segue a mesma configuração de etiquetas do contato ou do atendimento usada na conversa.
- Na seleção de atendimentos, "Etiquetar" adiciona de 1 a 20 etiquetas a até 100 atendimentos por vez, preservando
  as que já estavam associadas. Cada atendimento recebe apenas as etiquetas escolhidas compatíveis com seu setor.
  Se nenhuma for compatível, a falha é informada para aquele atendimento, sem impedir os demais.
- Em Contatos, o filtro "Etiquetas" aceita múltipla escolha: entra o contato que tenha qualquer uma das etiquetas
  escolhidas, diretamente ou em algum de seus atendimentos, inclusive resolvidos. Combina com a busca e com o filtro
  "Carteira": "Todos", "Minha carteira" e, para administradores, "Sem responsável". Sem etiqueta escolhida, não há
  restrição por etiqueta.
- Etiquetas, setores, contatos e atendimentos usados nas operações devem pertencer à mesma empresa.
- A consulta de setores (`GET /queue`) mantém todos os setores da própria empresa para usuários e administradores,
  incluindo a seleção explícita dessa empresa. Consultar outra empresa exige superusuário confirmado no banco,
  preservando a seleção de setores em Empresas → Usuários. A consulta recusa sessões com usuário removido ou
  empresa, perfil ou privilégio divergentes do estado atual; a sessão precisa ser renovada. Ver
  [isolamento da consulta de setores](specs/isolamento-setores-empresas.md).

- A administração de opções e mídia dos setores exige administrador atual da empresa autenticada, inclusive para
  superusuários. Pais, setor raiz e encaminhamentos mantêm vínculos da mesma empresa; listas incluem somente suas
  opções válidas. Uploads são autorizados antes da gravação e caminhos de mídia não são definidos pelo body.
  Ver [autorização de mídia e opções](specs/autorizacao-midia-opcoes-setores.md).

**Cenários de aceite:**

Dadas as etiquetas "Fiscal" no setor Fiscal, "DP" no setor DP e "Geral" sem setor,
quando alguém abre o seletor de etiquetas de uma conversa do Fiscal,
então pode escolher "Fiscal" e "Geral", sem receber "DP" como opção.

Dado dois atendimentos com etiquetas anteriores diferentes,
quando o usuário seleciona ambos e aplica a etiqueta geral "Revisar" em lote,
então os dois recebem "Revisar" e mantêm as etiquetas anteriores.

Dado um atendimento Fiscal e outro DP selecionados,
quando o usuário aplica somente uma etiqueta restrita ao Fiscal,
então o Fiscal recebe a etiqueta e o DP é informado como não alterado, mantendo suas etiquetas anteriores.

Dado um cliente com a etiqueta "Revisar" apenas em um atendimento resolvido e com responsável definido,
quando o administrador filtra Contatos por "Revisar",
então encontra o cliente; ao combinar com "Sem responsável", ele deixa de aparecer.

### RF-020 — Credenciais protegidas e isolamento do contexto

**Recorte autorizado (27/10/2026):** P0 da rodada 3, conforme
[especificação](specs/p0-credenciais-isolamento.md), usando dados fictícios. Não inclui IA assistida nem chamadas a
Acessórias/SCI.

- As credenciais de IA e dos futuros conectores ficam cifradas no backend, separadas por empresa. O navegador recebe
  somente o estado da configuração. Login, renovação de sessão, configurações gerais, eventos, auditoria e jobs não
  devolvem o valor nem o envelope cifrado. Segredos conhecidos também são retirados do payload geral da empresa.
- Administradores gerenciam somente as credenciais da empresa autenticada. Em Configurações, a chave de IA aparece
  como configurada, ausente ou pendente de migração, com campo vazio para substituição e gravação explícita. Remover
  exige confirmação; a remoção local não revoga a chave no fornecedor. Atendentes não gerenciam credenciais.
- A administração revalida o vínculo e o perfil atuais a cada operação. Transferência de empresa ou perda do perfil
  administrativo invalida esse acesso mesmo com Bearer antigo ainda válido; sem redesenhar a revogação global de JWT.
- Sem armazenamento protegido configurado no servidor, novas gravações/migrações são recusadas. Configuração herdada
  permanece privada e pode ser migrada de modo explícito, sem perder o valor por falha ou manter duplicata legível.
  A transcrição opcional herdada continua usando a credencial somente no backend; uma falha não impede registrar áudio.
- Notas, leitura de atendimento por ID/UUID e histórico exigem empresa, cliente e setor autorizados. Administrador
  acessa os atendimentos da própria empresa; atendente precisa do setor permitido, e ausência de setores não libera
  acesso geral. Edição de nota não troca autor, cliente ou atendimento por campos enviados na requisição.
- Eventos em tempo real aplicam a mesma autorização; atribuição do atendimento e assinaturas antigas não liberam
  contexto fora do setor. Transferência ou remoção de permissão retiram acesso. Alterar/excluir um atendimento ou
  mensagem também exige contexto autorizado antes de executar a operação.
- A agenda geral da empresa continua conforme RF-018. A privacidade do histórico e o contexto do atendimento recebido
  por transferência continuam conforme RF-017. Consultar sem solicitar marcação de leitura não muda leitura, SLA ou
  estado do atendimento e não envia mensagens.

**Cenários de aceite:**

Dadas duas empresas com clientes e usuários distintos, quando alguém de A usa um ID/UUID, cursor ou referência de
mensagem de B, a API recusa ou exclui o registro sem revelar seu conteúdo. Uma nota com cliente diferente do atendimento
também é recusada. O usuário sem setor não recebe contexto restrito.

Dada uma chave fictícia cadastrada pela empresa A, quando A entra, renova a sessão ou consulta configurações, recebe
somente estado. B não obtém nem substitui a chave de A. Substituir/remover/migrar funciona no escopo correto; falha ou
chave mestra incorreta não destrói a configuração anterior.

### RF-021 — Resumos e sugestões com revisão humana (simulação)

**Pedido (27/10/2026):** implementar o P1 com mocks e dados fictícios, conforme
[especificação](specs/p1-assistente-revisao.md). Não exige chave/faturamento de IA nem envia contexto a fornecedor.

- O administrador habilita o assistente por empresa; ele começa desligado e só funciona quando o servidor também
  permite o provedor simulado. A interface identifica **Simulação**; modo desconhecido não ativa um modelo real.
- O atendente pede **resumo** ou **sugestão de resposta** no atendimento autorizado. O assistente usa somente mensagens
  de texto elegíveis daquele atendimento, até 30 mensagens/12.000 caracteres; informa quando o contexto é parcial.
  Não inclui histórico de outros atendimentos, notas, anexos, áudios, reações ou mensagens excluídas.
- O resumo simulado extrai relatos com referências às mensagens, sem confirmar fatos externos. A sugestão simula um
  texto neutro para esclarecer/conferir informações, sem inventar valor, prazo ou parecer. Falta de informação é
  sinalizada. Texto recebido não altera instruções, permissões ou ferramentas.
- A pessoa pode editar a sugestão antes de usar. **Usar no rascunho** anexa o texto ao que já foi escrito e não envia.
  Cancelar, erro, timeout ou troca de atendimento não apagam o rascunho nem inserem uma resposta atrasada em outro
  editor. Modos de edição/resposta/mídia/gravação não recebem inserção indevida.
- Editor e assistente aguardam um atendimento válido, correspondente à conversa selecionada. Durante o carregamento
  ou troca de conversa não aceitam entrada sem proprietário nem pedidos com ID ausente; respostas antigas de
  carregamento não substituem a conversa atual.
- Empresa, cliente e setor seguem RF-020. O backend monta o contexto e revalida acesso/configuração e referências
  depois da geração. O pedido não aceita texto/contexto/empresa/contato fornecidos pelo navegador. Saída inválida ou
  referências fora do contexto são recusadas.
- Resumo e sugestão não viram mensagem ou nota automaticamente e não alteram leitura, SLA, responsável ou estado.
  Resultados não aceitos ficam só em memória. Depois do aceite, o texto é um rascunho comum do composer e segue a
  persistência local existente; só o envio normal, decidido pela pessoa, envia a mensagem.

**Cenários de aceite:**

Dado um atendimento fictício com texto e um rascunho já escrito, quando a pessoa pede sugestão, edita e usa no
rascunho, o texto anterior permanece e nenhuma mensagem é enviada. Ao cancelar ou trocar de atendimento antes de a
resposta chegar, o resultado não entra no editor da outra conversa.

Dadas duas empresas e clientes distintos, quando alguém solicita resumo de atendimento fora da autorização, a API
recusa sem fornecer texto/referências. Um atendimento vazio mostra falta de informação; um contexto grande informa
seu limite. Mensagens excluídas, anexos, notas e outro atendimento do mesmo cliente não entram no resumo.

### RF-022 — Clientes e pendências Acessórias (simulação)

**Pedido (27/10/2026):** painel de consultas com mocks e dados fictícios, conforme
[especificação](specs/p2-acessorias-consultas.md). Não usa token, API real ou escrita no sistema contábil.

- Começa desligado. Exige modo mock no servidor e habilitação administrativa na empresa; a interface identifica
  **Simulação**. Modo desconhecido não conecta fornecedor real nem habilita a empresa.
- Em atendimento válido e autorizado, o painel mostra somente clientes externos explicitamente vinculados ao
  contato. Telefone, nome, documento em mensagem ou ID conhecido não concedem acesso. Administrador consulta catálogo
  fictício e confirma associação/desvinculação **local**; atendente não recebe catálogo irrestrito nem gerencia vínculos.
- Um contato pode ter múltiplos clientes vinculados; a pessoa escolhe qual consultar. Cadastro/pendências de outro
  cliente ou empresa ficam fora do painel. Vínculo repetido não duplica; remover localmente não exclui nada no fornecedor.
- Mostra cadastro fictício, pendências paginadas em cinco itens, competência e prazo não confirmado, origem,
  horário da consulta/atualização e aviso de dados desatualizados. Vazio, falha, limite e timeout são estados distintos.
  Erro não apresenta dados anteriores como uma consulta atual.
- Trocar cliente/atendimento, cancelar ou alterar vínculo invalida resultados pendentes. Mudanças de vínculo notificam
  somente o identificador do contato afetado na própria empresa, sem divulgar cadastro/pendências; o painel desse contato
  descarta o snapshot ao receber a notificação.
  Sem conexão de eventos, uma nova consulta sempre revalida o acesso/vínculo, sem prometer atualização instantânea.
- Consulta não altera rascunho, leitura, SLA, responsável, notas, mensagens ou IA. Dados ficam na memória do painel;
  auditoria guarda somente ação, identificadores e metadados. Nenhum documento é baixado/exportado.

**Cenários de aceite:**

Dado um contato com dois clientes fictícios vinculados, quando alguém autorizado abre o painel e escolhe um cliente,
vê somente seu cadastro e a página selecionada de pendências, com origem/data e Simulação. Sem vínculo, recebe o estado
correspondente e não uma tentativa de correspondência por telefone ou documento.

Dadas duas empresas que usam o mesmo ID externo fictício, quando A consulta ou altera vínculo, B permanece intacta e
seus dados não são devolvidos. Atendente fora do setor ou sem setor é recusado; apenas administrador gerencia vínculos.

Dado um resultado em andamento, quando o vínculo é removido/recriado ou a conversa muda, o resultado antigo não entra
no cliente errado. Falha ou dado desatualizado fica explícito, sem confirmação de prazo fiscal ou obrigação cumprida.

### RF-023 — Arquivos e visualizadores na conversa

**Pedido:** ampliar a integração de arquivos e visualizar PDF, imagens e vídeos dentro do chat, conforme
[especificação](specs/anexos-visualizadores.md). A interação do WhatsApp serve como referência.

- **Arquivos** abre o histórico de anexos permitido do contato no atendimento atual, com filtros, paginação própria
  e busca por nome nos arquivos já carregados. A listagem não se limita ao lote de mensagens visível no chat.
- A mensagem e a área de arquivos usam o mesmo visualizador: imagem com zoom/rotação, vídeo com controles e PDF com
  páginas/zoom. Não abre serviço externo de visualização. PDF sem metadados específicos do WhatsApp continua documento;
  tipo desconhecido não é tratado como vídeo. Mensagem excluída não recebe novo acesso ao visualizador.
- Uma prévia de até 25 MiB fica ativa por vez. Cancelar, fechar ou trocar contexto libera o conteúdo local e impede
  resposta antiga no arquivo errado. Carregamento, vazio, formato/codec não suportado, arquivo ausente, PDF inválido/com
  senha e limite são comunicados. Abrir arquivo não envia mensagem nem altera rascunho, leitura ou SLA.
- A nova API verifica empresa, contato, setor, histórico e a identidade composta da mensagem. Conteúdo local é
  carregado com autenticação; erro de acesso não provoca abertura automática de URL pública. Download é explícito.
- Arquivos externos/grandes podem manter a ação **Abrir original** pelo mecanismo existente. Os caminhos públicos
  legados do Express/nginx e da entrega ao destinatário continuam públicos; esta entrega não promete privatizá-los
  nem altera uploads, armazenamento, envio ou retenção dos arquivos.

Essa compatibilidade pública refere-se aos arquivos dos atendimentos. Os anexos do chat interno seguem a regra
privada do RF-010 e sua especificação, sem alterar a entrega de arquivos dos demais módulos neste recorte.

**Aceite:** dado um atendimento autorizado com PDF de duas páginas, imagens e vídeo, a pessoa abre pela mensagem ou
pela área de arquivos, muda página/ampliação, reproduz/pausa e baixa por ação explícita, em desktop/celular e ambos os
temas. Outra empresa/cliente/setor proibido não recebe metadados nem bytes pela nova API, mesmo com ID/cursor conhecido.
Troca de contexto durante carga encerra o visualizador anterior; falha não abre silenciosamente o arquivo legado.

### RF-024 — Clientes e publicações SCI (simulação)

**Pedido (29/10/2026):** painel SCI com mocks e dados fictícios, conforme
[especificação](specs/p3-sci-consultas.md). Contrato interno de metadados; não representa integração a um módulo real.

- Começa desligado e exige `SCI_MODE=mock` e `sciEnabled=enabled` na empresa. Administrador gerencia a flag;
  ausência, valor desconhecido e duplicatas divergentes recusam consulta. P1/P2 continuam independentes.
- No atendimento autorizado, mostra somente clientes SCI explicitamente vinculados ao contato e exige seleção.
  Administrador consulta catálogo fictício e confirma vínculo local; atendente não gerencia catálogo/vínculos.
  O namespace SCI é separado do Acessórias mesmo quando IDs externos coincidem.
- Lista publicações fictícias com título, categoria, competência e data, em páginas de cinco itens, com origem e
  horários da fonte/consulta. Vazio, falha, timeout, limite e desatualização têm estados distintos. Não há URLs,
  conteúdo/download de documento, prazo fiscal confirmado nem marcação de leitura.
- Mudanças de contexto, acesso, flag e vínculo invalidam resultados; sem entrega de evento, nova consulta sempre
  revalida acesso, sem promessa de revogação visual instantânea do snapshot já recebido. Consultas não alteram rascunho, leitura, SLA,
  mensagens, notas ou credenciais. Conteúdo fica em memória; auditoria/eventos contêm só ação/IDs/metadados mínimos.
- A API permite revogar um vínculo local SCI conhecido mesmo com a consulta desligada, sem chamar provedor;
  nessa condição a interface oculta o painel de consulta. Não exclui nada em fornecedor nem no namespace Acessórias.

**Aceite:** duas empresas e dois fornecedores com IDs externos iguais mantêm dados/vínculos separados. Selecionar
um de vários clientes mostra somente suas publicações, com paginação correta. Resposta atrasada após remoção/recriação
ou troca de atendimento é recusada/descartada. Interface funciona em ambos os temas e desktop/celular. Testes usam
somente dados fictícios, sem acesso externo, arquivos ou envio e preservam os estados anteriores do atendimento.

### RF-025 — Consultas integradas com revisão humana (simulação)

**Pedido (30/10/2026):** reunir IA, Acessórias e SCI com mocks/dados fictícios, conforme
[especificação](specs/p4-consultas-integradas.md). Não habilita fornecedores, IA reais ou sincronização.

- Começa desligado: exige modo/flag próprios e assistente P1 habilitado. Fontes mantêm suas habilitações independentes.
  No atendimento autorizado, a pessoa escolhe explicitamente clientes vinculados por provedor e ao menos uma fonte;
  não há correspondência automática por ID, nome ou texto de mensagem.
- Uma solicitação humana gera resumo ou sugestão simulados a partir do texto elegível P1 e de uma página de até 5 itens
  por fonte escolhida. Origem, horários, limites, desatualização, vazio e falhas parciais aparecem separados.
  O texto não confirma fatos fiscais, pagamentos ou conteúdo de documentos.
- Sugestão editável só é anexada ao rascunho em outra ação humana, após revalidar contexto local e vínculos atuais.
  Mudanças de acesso, mensagens usadas, flag ou vínculo impedem consulta/aceite com estado antigo, mesmo sem evento entregue.
  Transferência de responsável na mesma fila e mudança de estado também invalidam a versão anterior da sugestão.
  Preserva texto existente e não envia ou altera leitura/SLA/estado/mensagens/notas/credenciais.
- Resultados não aceitos ficam somente em memória. Contratos/erros são estritos e privados; catálogo/CRUD continuam
  nos painéis P2/P3. Não há nova credencial, cache de resultados, fila, documento ou escrita externa.

**Aceite:** duas empresas/clientes e IDs repetidos entre provedores permanecem isolados. Seleção e páginas explícitas,
falhas parciais e stale não apresentam confirmação indevida. Troca, cancelamento, revogação ou edição durante awaits
e antes do aceite recusam respostas antigas. Percurso completo em ambos os temas e desktop/celular, com dados fictícios.

### RF-026 — Com quem está o atendimento aberto

**Problema relatado (23/11/2026, JB Fraga):** ao chamar um cliente, o sistema diz que já existe uma conversa em aberto,
mas não diz com quem. Sem saber onde está o atendimento, a equipe não consegue puxar a conversa.

**Regras importantes:**
- O aviso de atendimento já aberto diz o número do atendimento, o atendente (ou "aguardando na fila"), se está
  pausado, a fila, o canal (marcando quando está desconectado) e a última movimentação. Vale para iniciar conversa,
  reabrir atendimento e encaminhar mensagem.
- Ao iniciar conversa, o aviso abre uma janela com **Abrir atendimento** e **Assumir**, ou **Aceitar**, se estiver
  aguardando. Os botões seguem as regras de acesso que já existem:
  - abre quem é administrador ou é da fila do atendimento, como na abertura normal;
  - aceita um atendimento aguardando quem é da fila; aguardando sem fila, só administrador;
  - assume um atendimento que está com outra pessoa só o administrador. Quem não pode assumir vê o nome do colega,
    para pedir a transferência.
- Aceitar não toma o atendimento de quem acabou de aceitá-lo: se alguém aceitou antes, o sistema avisa e não transfere.
- No reabrir e no encaminhar, o aviso traz o link para abrir o atendimento quando a pessoa pode abri-lo.
- O aviso mostra o nome do atendente, da fila e do canal a qualquer usuário da empresa que esbarre no atendimento,
  mesmo de outro setor. A regra de visibilidade por setor esconde mensagens, não esses nomes.

**Cenário de sucesso:**

Dado que a Raiane atende a cliente Maria na fila Pessoal,
quando a Sirleide, da fila Fiscal, tenta iniciar conversa com a Maria,
então vê "Este cliente já tem o atendimento #55 em andamento: com Raiane, na fila Pessoal, pelo canal WhatsApp JB
Fraga" e a orientação de pedir a transferência à Raiane ou falar com um administrador.

### RF-027 — Histórico do cliente escondido por setor

**Problema relatado (23/11/2026, JB Fraga):** a equipe não vê o que o cliente falou antes. As conversas antigas estão
em atendimentos do canal JBFraga, já desconectado, na fila JBFraga, e a regra de visibilidade por setor esconde de quem
não é dessa fila os atendimentos e as mensagens de outras filas.

**Regras importantes:**
- A opção que já existia passa a ter nome claro: Configurações › Opções › **Histórico do cliente para atendentes**,
  com "Só dos setores do atendente" (padrão, a regra de antes) ou "Completo, de todos os setores". No completo, quem
  pode ver o atendimento vê todo o histórico do cliente, como o administrador.
- Quando a regra esconde parte do histórico, a conversa mostra no topo quantas mensagens anteriores do cliente estão
  em setores que a pessoa não acompanha (ou em atendimentos sem setor) e quem pode liberar. Só a contagem: nada do
  conteúdo escondido.
- O separador de cada atendimento no histórico mostra a data, a fila, o canal (marcando quando está desconectado) e o
  atendente.
- O SuperChat só tem as mensagens que passaram por ele com o canal conectado. Conversas feitas direto no celular antes
  do pareamento, ou com o canal fora, não estão no banco: a sincronização do histórico do WhatsApp continua desligada.

**Cenário de sucesso:**

Dado a opção "Só dos setores do atendente" e uma cliente com 12 mensagens antigas na fila JBFraga,
quando uma atendente da fila Pessoal abre o atendimento novo dessa cliente,
então vê no topo da conversa que há 12 mensagens anteriores em setores que ela não acompanha. Depois que um
administrador escolhe "Completo, de todos os setores", ela vê essas mensagens, com o separador "Atendimento anterior
#52 · 12/11/2026 · fila JBFraga · canal JBFraga (desconectado)".

### RF-028 — O próprio atendimento não bloqueia a nova conversa

**Problema relatado (23/11/2026, JB Fraga):** uma atendente tenta iniciar conversa com um cliente e o sistema diz que
ele já está em atendimento com outra pessoa, mas o atendimento é dela. Causa: o atendimento existente só era
reaproveitado se estivesse em andamento e na mesma fila escolhida. Aguardando com o nome dela (por exemplo, pela
carteira), pausado ou em outra fila dela, ele bloqueava.

**Regras importantes:**
- Se o atendimento ativo do cliente no mesmo canal é da própria pessoa, iniciar conversa abre esse atendimento.
  Aguardando ou pausado, ele passa a "em andamento", como se ela tivesse clicado em Aceitar ou Retomar.
- O atendimento continua na fila em que está, sem mensagem de transferência ao cliente. Se não tiver fila, vai para a
  fila escolhida antes de ser aceito.
- Se o atendimento da pessoa está numa fila que ela não tem mais (e ela não é administradora), ele não é aberto por
  esse caminho: o aviso diz onde ele está, como em RF-026.
- Atendimento com outra pessoa continua bloqueando, com o aviso de RF-026.

**Cenário de sucesso:**

Dado um atendimento aguardando na fila Fiscal com o nome da Yasmin,
quando a Yasmin inicia conversa com esse cliente pela fila Fiscal,
então o atendimento abre em andamento com ela, sem aviso de conversa em aberto.

### RF-029 — Histórico do ZapContábil no SuperChat

**Pedido (23/11/2026):** trazer para o SuperChat as conversas antigas da JB Fraga que estão no ZapContábil (Zappy), para
a equipe ver o que o cliente falou antes. Primeira etapa: só texto, de todo o histórico.

**Regras importantes:**
- Cada atendimento do ZapContábil vira um atendimento **fechado** no SuperChat, do mesmo cliente, com as mensagens na
  data original. Ele aparece no histórico do cliente com o separador de atendimento anterior, sem canal.
- O cliente é encontrado pelo número (com e sem o nono dígito). Quem não existe no SuperChat é criado com o nome do
  ZapContábil. Grupos ficam de fora.
- Fila e atendente são ligados pelo nome quando existem no SuperChat; senão o atendimento fica sem fila ou sem
  atendente. A regra "Histórico do cliente para atendentes" (RF-027) vale para eles como para os demais. Nome que duas
  filas ou dois usuários do SuperChat compartilham não é escolhido ao acaso: aparece na simulação como ambíguo, para
  ser resolvido com um mapa de nomes.
- Anexos entram como texto com o nome do arquivo (📎 nome). Os arquivos ficam para uma segunda etapa. Respostas e
  mensagens com link continuam como texto comum.
- Mensagem importada é só para consulta: não dá para responder citando, encaminhar, editar, apagar nem reagir. O menu
  da mensagem avisa, e abrir ou tentar uma dessas ações não muda o atendimento importado. Reabrir um atendimento
  importado, ou responder por ele, usa a conexão padrão, como já acontece com atendimento que ficou sem conexão.
- Mensagem que o SuperChat já tem (mesmo identificador do WhatsApp, porque os dois sistemas usam o mesmo número) não
  é repetida. Rodar a importação de novo não duplica nada.
- A importação roda primeiro em simulação, que só conta: atendimentos, mensagens, clientes novos e o que ficaria de
  fora, com o motivo (sem data válida, vazia ou sem identificador). O conteúdo das mensagens não aparece em relatório
  nem sai do servidor. O arquivo exportado do ZapContábil fica fora do repositório e é apagado depois da importação.
- Para gravar, é obrigatório informar a data em que o SuperChat passou a receber o número (ou declarar que os dois
  sistemas nunca receberam ao mesmo tempo). Opção digitada errado interrompe a execução em vez de ser ignorada.

**Cenário de sucesso:**

Dado uma cliente que conversou com a JB pelo ZapContábil em outubro,
quando a importação roda e a atendente abre o atendimento atual dela no SuperChat,
então vê as mensagens de outubro acima, no atendimento anterior, na data em que foram trocadas.

### RF-033 — Conversa sem setor visível na hora para a fila geral

**Relato (25/11/2026):** "quando o cliente não escolhe o setor, não está mostrando as mensagens no Aguardando; a gente
tem que ficar olhando no celular para ver os clientes que mandam mensagem e não escolhem o setor".

**Como era:** com a **Triagem sem setor** ligada, o cliente que não escolhe um setor no menu fica sem fila durante o
"tempo para escolher um setor" (15 minutos por padrão) e só depois vai para a fila de atendimento geral. Atendimento
sem fila só aparece para administrador, então nesse intervalo a equipe não via o cliente.

**Regras importantes:**
- A conversa que está esperando o cliente escolher o setor conta como se já estivesse na fila de atendimento geral
  para quem pertence a essa fila. São as mesmas pessoas que a receberiam ao fim da espera; muda só o atraso.
- Para essas pessoas ela aparece em **Aguardando** na hora, com o rótulo **Sem setor**, entra no contador da aba, chega
  ao vivo, toca a notificação e pode ser aberta e lida. Como qualquer conversa da fila geral, some da lista quando o
  filtro dessa fila está desligado.
- Enquanto ninguém aceita, o menu continua valendo: se o cliente escolher um setor, a conversa vai para ele e sai da
  lista de quem não é desse setor.
- Aceitar leva a conversa para a fila de atendimento geral, do mesmo jeito que o fim da espera levaria, e a deixa com
  quem aceitou. Finalizar sem aceitar faz o mesmo antes de fechar, para a conversa não terminar sem setor nas mãos de
  quem não enxerga conversas sem setor.
- Se o cliente escolher um setor no instante em que alguém aceita, vale o setor do cliente: o aceite é recusado para
  quem não é desse setor.
- As anotações feitas na conversa em espera aparecem para quem pode abri-la.
- Quem não é da fila de atendimento geral continua sem ver nem poder aceitar essas conversas.
- Nada muda para as outras conversas sem fila (as iniciadas pelo celular e as anteriores à triagem): continuam só com
  os administradores. Para o administrador nada muda.
- Vale só onde a Triagem sem setor está configurada, e só nas conexões de WhatsApp ligadas à fila geral.

**Cenário de sucesso:**

Dado que a JB Fraga tem a Triagem sem setor com a fila "Atendimento geral" e 15 minutos de espera,
quando um cliente manda "Posso enviar o código?" e não responde ao menu de setores,
então, no mesmo instante, a conversa aparece em Aguardando para quem é da fila Atendimento geral, com o rótulo
"Sem setor"; ao aceitar, ela passa para a fila Atendimento geral com quem aceitou, e a equipe não precisa mais olhar
o celular.

### RF-030 — Aviso de versão beta e chamados de suporte

**Pedido (24/11/2026):** avisar quem entra no SuperChat de que o sistema está em versão beta e pode apresentar erros,
e dar um lugar para pedir suporte dentro do próprio sistema: o usuário abre um chamado, anexa imagens, vídeos ou PDF, e
conversa ao vivo com o superadministrador, que vê e responde todos os chamados. O modelo é a central de chamados do
Brazil TMS. Nada é enviado por e-mail.

**Regras importantes:**
- Depois do login, cada usuário vê uma vez a mensagem de boas-vindas: o sistema está em beta e podem ocorrer erros,
  bugs e falhas. O centro da mensagem é o convite a abrir chamado: um bloco em destaque "Encontrou uma falha? Abra um
  chamado.", o passo a passo (Suporte, contar o que aconteceu, acompanhar a resposta), o incentivo a relatar mesmo as
  falhas pequenas e **Abrir um chamado** como botão principal. A resposta fica guardada no navegador, por usuário; em
  outro navegador ou computador a mensagem aparece de novo. Quando o texto muda de forma relevante, a versão da
  mensagem sobe e todos a veem mais uma vez.
- **Suporte** fica no menu de todos os perfis, na aba "Mais" do layout Foco e no `Ctrl K`. O menu mostra quantos
  chamados têm novidade para quem está logado.
- Qualquer usuário abre chamado, numerado `CH-000123`: título (obrigatório), categoria (Erro numa tela, Dado
  incorreto, Dúvida de uso, Permissão de acesso, Sugestão de melhoria, Outro), prioridade (Baixa, Média, Alta; "Parou
  meu trabalho" vira Crítica), tela onde aconteceu e descrição. Aceita até 5 anexos e 15 MB por envio, só imagem (PNG,
  JPEG, GIF, WebP), vídeo (MP4, WebM, MOV) ou PDF, escolhidos, colados com `Ctrl+V` ou arrastados para qualquer
  ponto do chamado.
- O servidor confere o tipo do anexo pelo conteúdo do arquivo, e não pelo nome. Os anexos ficam no volume privado e só
  saem pela rota autenticada do chamado a que pertencem; abrem dentro do sistema.
- Cada usuário vê só os próprios chamados. Chamado de outra pessoa responde como inexistente. Quem atende é o
  superadministrador da instalação, que vê a fila com os chamados de todas as empresas, o e-mail do solicitante e os
  dados técnicos (navegador, tamanho da tela, endereço).
- Situações: **Aberto**, **Em atendimento**, **Aguardando o solicitante** (para o dono do chamado, "Aguardando você"),
  **Concluído** e **Cancelado**.
  - O suporte assume (vira responsável), pede informação, retoma, conclui e reabre. Pedir informação, concluir e
    cancelar exigem um texto, que entra na conversa.
  - A primeira resposta do suporte num chamado aberto já assume o chamado.
  - O solicitante só cancela enquanto o chamado está Aberto. Quando ele responde um pedido de informação, o chamado
    volta a Em atendimento.
  - Escrever num chamado concluído ou cancelado reabre o chamado, sem prazo. Com responsável, ele volta a Em
    atendimento; sem responsável, volta para a fila.
- A conversa é ao vivo: o servidor avisa, pelo canal de tempo real, qual chamado mudou, e cada tela busca de novo só o
  que aquele usuário pode ver. As mudanças de situação aparecem na conversa, com quem fez e quando.
- Limites: 10 chamados e 120 mensagens por usuário por hora.
- Alerta no Windows de quem atende (`deploy/alerta-suporte-windows`): um programa na conta do usuário consulta a
  fila a cada 30 segundos e, a cada chamado novo ou mensagem nova de solicitante, mostra um aviso do Windows e apita,
  mesmo com o navegador fechado. Ele usa a chave do alerta, criada por um superadministrador, que abre uma rota só de
  leitura com número, título, empresa, solicitante, prioridade e horário dos chamados que esperam o suporte. A chave
  não lê conversa nem anexo, não é login, e o servidor guarda só o SHA-256 dela.
- Os reportes de erro gravados pela primeira versão desta função viram chamados, com o mesmo número.

**Cenário de sucesso:**

Dado uma atendente que abriu o chamado CH-000012 com um print,
quando o superadministrador responde na fila de chamados,
então o chamado passa a Em atendimento com ele como responsável, a resposta aparece na conversa dela sem recarregar a
página e o menu Suporte mostra a novidade. Depois de concluído, se ela escrever "voltou a acontecer", o chamado é
reaberto com o mesmo responsável.

### RF-031 — Tour pelas funcionalidades

**Pedido (25/11/2026):** um tour breve pelas funcionalidades do SuperChat, parecido com os tours do Brazil TMS, dizendo
como cada funcionalidade funciona.

**Regras importantes:**
- O tour tem a mesma forma dos tours do Brazil TMS: a tela escurece e fica aceso só o que o passo mostra, um balão
  preso a esse ponto explica a funcionalidade, uma pílula no alto diz "Tour · passo n de N" e o botão **Sair do tour**
  fica à mão o tempo todo (o `Esc` faz o mesmo). As setas do teclado andam entre os passos.
- Diferente do Brazil TMS, o tour não usa telas de treino: ele passa pelas telas de verdade. Cada passo abre a página
  da funcionalidade e aponta o item dela no menu. Enquanto o tour está aberto, o sistema por trás não recebe clique nem
  teclado, e nada é enviado nem alterado. No fim, a pessoa volta para a tela em que estava.
- Cada passo diz o que a funcionalidade é e, em dois a quatro pontos, como ela funciona, citando os nomes das abas e
  dos botões como aparecem na tela. O tour só fala do que existe hoje: recursos em simulação ou desligados por padrão
  (assistente, integrações, campanhas) ficam de fora.
- **Atendente (12 passos):** Atendimentos (o item do menu, a lista e a conversa), Kanban, Respostas Rápidas, Contatos,
  Agendamentos, Tags, Chat Interno, Ajuda e Suporte, a busca rápida (`Ctrl K`) e o menu do usuário.
- **Administrador (18 passos):** os mesmos e mais Dashboard, SLA, Métricas e Usuários online; IPs permitidos e
  Auditoria; Conexões; Filas & Chatbot e Motivos de finalização; Usuários; API e Configurações.
- O tour acompanha o layout de cada pessoa: no Workspace e no Painel o menu lateral fica aberto durante o tour, para os
  itens aparecerem com o nome; no Foco o balão aponta a aba, ou a aba "Mais" quando a página mora dentro dela. No
  celular, onde o menu fica recolhido, a explicação aparece num cartão no pé da tela, sobre a página do passo.
- O tour é oferecido uma vez a cada usuário, depois da mensagem de boas-vindas (nunca os dois avisos juntos). Quem
  responde "Agora não" não é perguntado de novo. Fechar o convite com `Esc` ou com um clique fora não é resposta: ele
  volta na próxima vez que a página for carregada. A resposta fica guardada no navegador, por usuário; com duas abas
  abertas, responder numa fecha o convite na outra.
- O tour não deixa rastro no histórico do navegador: depois dele, o botão Voltar leva para onde a pessoa estava antes.
  Usar o botão Voltar durante o tour encerra o tour na tela para onde o botão levou.
- Quem fecha o convite sem responder e depois faz o tour pelo menu não é convidado de novo.
- **Tour pelo sistema**, no menu do usuário, repete o tour quando a pessoa quiser.
- A tela final diz onde rever o tour e lembra a aba Suporte. **Concluir** fecha; **Repetir tour** volta ao passo 1.
- Os textos existem em português, inglês e espanhol.

**Cenário de sucesso:**

Dado uma atendente que entra no SuperChat pela primeira vez depois desta entrega,
quando ela aceita o convite "Conheça o SuperChat" e clica em Continuar a cada passo,
então o tour abre Atendimentos, Kanban, Respostas Rápidas e as demais telas do menu dela, explicando cada uma, termina
em "Você chegou ao fim do tour" e, ao concluir, ela está de volta na tela em que estava, sem nenhuma mensagem enviada
nem cadastro alterado.

### RF-032 — Aviso de versão nova para quem já está online

**Pedido (25/11/2026):** apresentar o tour a todos os usuários, inclusive aos que já estavam online quando ele foi
publicado.

**Problema:** quem deixa o SuperChat aberto o dia inteiro continua rodando o programa que o navegador carregou de manhã.
Uma publicação feita às 10 h só chega a essa pessoa quando a página é carregada de novo. Por isso o convite do tour não
apareceu para quem já estava trabalhando.

**Regras importantes:**
- **Atualizar**, na barra de cima, aparece quando existe uma versão do SuperChat mais nova do que a que está na tela.
  É um botão, sem janela e sem som: nunca tira o teclado de quem está digitando para um cliente e não cobre a conversa.
- Clicar em **Atualizar** abre um cartão pequeno que diz o que fica guardado (o texto digitado na conversa com o
  cliente) e o que se perde (anexos ainda não enviados, áudio em gravação, edição ou resposta de mensagem e formulários
  abertos). A página só é carregada de novo no clique em **Atualizar agora**. Nunca sozinha.
- Depois de atualizar, quem ainda não respondeu ao convite do tour o recebe (RF-031).
- O SuperChat percebe a versão nova comparando o programa que está rodando com o que está publicado. Ele confere logo
  depois de a conexão cair e voltar (o que acontece em toda publicação), quando a pessoa volta para a aba, quando uma
  tela não consegue carregar um arquivo e de tempos em tempos. Na dúvida (sem internet, servidor reiniciando), não
  mostra nada: uma queda de rede nunca acende o botão.
- No celular a barra de cima já está cheia: enquanto **Atualizar** está nela, ele ocupa o lugar do controle de volume.
- O cartão vem logo depois do botão na ordem do teclado, e o `Esc` o fecha.
- Enquanto o tour está na tela, o botão fica escondido.
- **Navegadores com a versão antiga, de antes desta entrega:** eles não têm o botão e não aprendem nada novo. O servidor
  os reconhece e manda um aviso curto, "O SuperChat foi atualizado. Aperte F5 para carregar a versão nova.", que a
  versão antiga mostra na tela por três segundos, do mesmo jeito que mostra os avisos de conexão do WhatsApp. O aviso
  vem dez segundos depois de a conexão voltar e se repete a cada dez minutos, no máximo seis vezes por pessoa a cada
  publicação (somando todas as abas e reconexões), até a página ser carregada de novo. Ele não desconecta ninguém e não
  recarrega a página. A variável `LEGACY_CLIENT_NOTICE=off` desliga esse aviso na instalação.

**Cenário de sucesso:**

Dado uma atendente com o SuperChat aberto desde cedo, respondendo a um cliente,
quando uma versão nova é publicada,
então aparece **Atualizar** na barra de cima, sem interromper o que ela digita; ao clicar em Atualizar agora, a página
volta na mesma conversa, com o texto que ela tinha digitado, e o convite do tour aparece se ela ainda não respondeu.

## 4. Restrições e cuidados

**Uso e acesso:** navegador, perfis do Ticketz (admin e usuário). Painel de SLA, carteira, horário de acesso, motivos
de finalização e a exigência de motivo são geridos só por administradores.

**Dados e integrações:** dados de contatos e mensagens dos clientes das empresas usuárias. Nenhum dado novo sai do
sistema; nenhuma integração externa nova. Os chamados de suporte (RF-030) ficam dentro do SuperChat: um print anexado
pode mostrar dados de clientes, e por isso só o dono do chamado e o superadministrador da instalação o veem.

**Privacidade:** o sistema não pede a localização do navegador e não envia IP, coordenadas nem dados de uso a terceiros por
conta própria. O país do campo de telefone vem do idioma do navegador. Saem de cena a geolocalização e o
`nominatim.openstreetmap.org` e o `ipinfo.io` (carregamento do app), o `ipapi.co` (Dashboard), o Google Analytics com a tag
do projeto Ticketz (superusuário), e do Dashboard o banner e o blog do Ticketz PRO, o pedido de doação (PIX, Mercado Pago,
PayPal) e o cadastro da instalação no Ticketz. Seguem como chamadas externas herdadas do Ticketz, a decidir pelo
responsável: lista de países (`cdn.jsdelivr.net`), fontes do Google e a consulta da versão do WhatsApp Web
(`waversion.ticke.tz`, no backend, ao iniciar cada sessão). A tela "Sobre" mantém o crédito ao Ticketz e o link do código
(licença AGPL-3.0).

**Ligações (opcional, desligadas):** fazer ligação de voz pelo WhatsApp usa o Wavoip, serviço de terceiros
(`wavoip.com`), com um token por conexão cadastrado em Conexões. A Komunick decidiu não usar por enquanto: a função só
aparece com `WAVOIP_ENABLED=true` no frontend, e sem token nada é enviado ao Wavoip. Ligações recebidas seguem
só com a mensagem automática e o registro de chamada perdida.

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
- Calendário do "Enviar só em dia útil" (RF-008): nacional mais Carnaval, Sexta-feira Santa e Corpus Christi, como no
  calendário bancário. Confirmar com o responsável; feriados estaduais e municipais pediriam cadastro por empresa.
- Pausa e SLA (RF-007): hoje o tempo pausado conta na espera quando o atendimento é retomado. Confirmar se o gestor
  prefere que a pausa zere ou congele o relógio.
- Lista de motivos de finalização: o sistema começa sem nenhum. Os motivos de cada empresa são definidos pelo gestor.
