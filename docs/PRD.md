# PRD — Zap Komunick

**Komunick Inteligência e Tecnologia**
**Responsável:** Jailson (Komunick) · **Atualizado em:** 21/10/2026
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
Komunick (RF-009) e o chat interno com conversas e contatos (RF-010), sobre o Ticketz como ele é hoje (filas, chatbot, etiquetas, agendamentos, perfis admin e usuário).
A segunda entrega saiu da comparação com o ZapContábil feita em 21/10/2026 numa conta de cliente, só olhando, sem mudar
nada nela.

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

### RF-009 — Identidade visual da Komunick

**O que faz:** o sistema abre com a marca da Komunick e um visual mais atual que o do Ticketz e o do ZapContábil, com
referências do Dribbble (painéis de atendimento e CRMs de 2025 e 2026).

**Regras importantes:**
- Logo, ícone e cores da Komunick por padrão: verde #35B62E, preto #020605 e a fonte Manrope. Botões e textos em verde
  usam o tom mais escuro #1F7F1B no tema claro, para manter o contraste. O logo e a cor que a empresa configurar em
  Whitelabel continuam valendo.
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
- Atendimentos: uma linha de visões com contadores (em atendimento ou meus, aguardando, pausados, resolvidos) mais a
  busca; filas como chips que o usuário liga e desliga (sempre fica ao menos uma); cada atendimento em uma linha enxuta;
  em telas de 1400 px ou mais, painel do cliente fixo à direita da conversa (carteira, fila, atendente, SLA, etiquetas,
  notas e edição do contato); abaixo disso, o contato continua abrindo numa gaveta.
- Menu lateral legível: itens de 48 px, ícones de 26 px, texto de 15,5 px e títulos de seção de 12,5 px; largura de 264 px
  aberto e 72 px só com ícones (a lista rola quando não cabe na tela).
- Login em duas colunas (formulário e painel da marca); no celular, só o formulário.
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

**Cenário de sucesso:**

Dado um atendente que nunca conversou com a colega Ana,
quando ele abre o Chat interno e clica em "Ana" na parte de contatos,
então a conversa a dois abre vazia, e depois da primeira mensagem ela aparece no topo das conversas dos dois.

## 4. Restrições e cuidados

**Uso e acesso:** navegador, perfis do Ticketz (admin e usuário). Painel de SLA, carteira, horário de acesso, motivos
de finalização e a exigência de motivo são geridos só por administradores.

**Dados e integrações:** dados de contatos e mensagens dos clientes das empresas usuárias. Nenhum dado novo sai do
sistema; nenhuma integração externa nova.

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
