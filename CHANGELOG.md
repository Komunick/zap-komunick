# Changelog

Mudanças relevantes para quem usa, integra ou opera o projeto.

## Não publicado

### Adicionado

- Etiquetas por setor: escolha de um ou mais setores no cadastro, coluna "Setores" e etiquetas gerais quando nenhum
  setor é escolhido. Na conversa e no botão "Etiquetar" da linha, o seletor oferece etiquetas do setor e gerais.
- Ação "Etiquetar" em lote nos atendimentos, adicionando as etiquetas compatíveis com cada setor sem apagar as
  anteriores e informando os atendimentos que não puderam ser alterados.
- Filtro de etiquetas em Contatos, incluindo etiquetas do próprio contato ou de seus atendimentos, combinado com
  busca e carteira.
- Painel de SLA (menu Gerência, só administradores): atendimentos em aberto, aguardando, em atendimento, estourados,
  abertos há mais de N horas, clientes e grupos sem resposta, por fila e por atendente ("Sem dono" incluído). Selo
  "SLA" na lista de atendimentos para quem passou do prazo. Prazo e limite de horas em Configurações › SLA e carteira
  de clientes; o prazo começa desligado.
- Carteira de clientes: responsável por contato (definido por administradores), coluna "Carteira" e filtro "Minha
  carteira" em Contatos. Com "Enviar direto para o responsável" ligado em Configurações, o atendimento novo ou
  reaberto do contato vai para o responsável sem passar pelo chatbot.
- Kanban: tela com a coluna "Em aberto" e uma coluna por etiqueta marcada como Kanban (chave nova na edição da
  etiqueta); arrastar ou "Mover para" troca a etiqueta de Kanban do atendimento.
- Horário de acesso por usuário: dias e faixa de horário no cadastro; fora dele o login e a renovação de sessão são
  recusados. Administradores não são bloqueados.
- Agendamento recorrente: repetir todo dia, semana, mês ou ano, com data final opcional; o próximo envio é criado
  depois de cada envio.
- `docker-compose-dev-app.yaml`: ambiente de desenvolvimento completo em contêineres (portas 5420 e 5421).
- Pausar atendimento: botão Pausar no atendimento em andamento, aba "Pausados" e botão Retomar. O pausado continua
  recebendo as mensagens do cliente e fica fora do SLA.
- Motivos de finalização: cadastro no menu de administração, com o uso de cada motivo nos últimos 30 dias. Com "Exigir
  motivo ao finalizar" ligado em Configurações, quem finaliza escolhe o motivo e pode deixar uma observação.
- Botão Transferir direto no cabeçalho do atendimento.
- Agendamento para vários contatos ou para todos os contatos de uma etiqueta (até 500), com arquivo anexo e a opção
  "Enviar só em dia útil" (pula fim de semana e feriados nacionais, Carnaval, Sexta-feira Santa e Corpus Christi).

### Alterado

- O filtro "Carteira" em Contatos reúne "Todos", "Minha carteira" e, para administradores, "Sem responsável".
- "Tarefas" fica oculto no menu lateral, nas abas e na paleta Ctrl K; a página continua acessível em `/todolist`.
- A tela "Sobre" aponta o código-fonte para github.com/Komunick/zap-komunick (AGPL) e credita o Ticketz.
- Visual novo com a identidade da Komunick: logo, ícones, verde #35B62E, fonte Manrope, temas claro e escuro
  revistos (menu, barra do topo, lista de atendimentos, chat, cadastros) e login em duas colunas. O Whitelabel da
  empresa continua por cima do padrão.
- O botão de resolver do atendimento virou "Finalizar".
- Menu lateral preto (#020605) nos dois temas, com ícone e barra verdes no item ativo, e atendimento selecionado com
  contorno verde na lista, conforme a Direção B do Stitch (referências em `docs/design/stitch-direcao-b`).
- Telas internas no estilo da Direção B: títulos pretos, cabeçalho de tabela com faixa de fundo, Kanban sem painel atrás
  das colunas, avatares neutros e carteira em etiqueta verde em Contatos, selos de situação suaves no Painel de SLA.
- Dashboard sem propaganda do Ticketz: saem o banner do Ticketz PRO, o blog do Ticketz PRO, o pedido de doação (PIX,
  Mercado Pago e PayPal) e o cadastro da instalação no Ticketz. A tela abre direto nas métricas.
- Três layouts próprios, escolhidos no menu do usuário: "Workspace" (trilho de ícones à esquerda), "Foco" (logo e abas de
  navegação no topo, sem barra lateral) e "Painel" (barra lateral compacta de 224 px, clara e quente no tema claro, com o
  botão de recolher dentro dela e a logo na barra do topo). Todos têm barra do topo plana, conteúdo sem cartões flutuantes e
  busca global com `Ctrl K` (páginas e atendimentos). O trilho de ícones ganha dica com o nome de cada página. Na tela de
  Atendimentos a coluna da lista fica fixa em 380 px e a conversa ocupa o resto.
- Tela de Atendimentos redesenhada: as visões "Em atendimento (ou Meus)", "Aguardando", "Pausados" e "Resolvidos" ficam em
  uma só linha de abas com contadores, as filas viram chips, e cada atendimento é uma linha enxuta (nome e hora, última
  mensagem, fila, etiquetas e atendente; as ações extras aparecem ao passar o mouse). Em telas de 1400 px ou mais, o painel
  do cliente fica fixo à direita da conversa, com carteira, fila, atendente, cronômetro do SLA, etiquetas e notas.
- O botão de recolher o menu fica dentro da barra lateral, ao lado da logo (ou logo abaixo dela, no modo só ícones), em
  vez de solto na barra do topo; o botão de hambúrguer da barra do topo só aparece no celular.
- Menu lateral maior e mais legível: itens de 48 px, ícones de 26 px, texto de 15,5 px, títulos de seção de 12,5 px e
  largura de 264 px (72 px só com ícones).
- Ligações de voz pelo WhatsApp com o Wavoip (serviço de terceiros), desligadas por padrão: só aparecem com
  `WAVOIP_ENABLED=true` no ambiente do frontend. Ligadas, o ícone do Wavoip fica em Conexões para cadastrar o token de
  cada conexão e o botão de ligar aparece no atendimento aberto de conexões com token; só em `https` ou `localhost` (o
  microfone exige). Sai o texto do cupom "TICKETZ" da janela do token.
- Painel de métricas (Gerência, administradores): período, filtros de fila e atendente, indicadores (atendimentos,
  finalizados, espera e atendimento médios, respondidos no prazo, novos contatos, nota), atendimentos por dia, tabelas
  por fila e por atendente, motivos de finalização, horários de maior movimento e exportação em CSV. `GET /metrics`.
- Carteira em lote em Contatos (administradores): marcar vários contatos e definir ou tirar o responsável de uma vez,
  e "Transferir carteira" de um responsável para outro (ou dos sem responsável, ou para ninguém), com a contagem antes
  de confirmar. Grupos são ignorados. `PUT /contacts/wallet/bulk`.
- Página "Usuários online" (Gerência, administradores): resumo da equipe e um cartão por pessoa com situação
  (online, offline ou fora do horário de acesso), tempo online ou última vez vista, atendimentos em andamento,
  pausados e finalizados hoje, e as filas. Atualiza sozinha quando alguém entra ou sai.
- Filtros completos na lista de atendimentos: botão "Filtros" com conexão, atendente (administradores), etiquetas,
  período de abertura, carteira (minha ou sem responsável), só não lidas e só SLA estourado. Valem em todas as visões,
  inclusive na busca e nos atendimentos que chegam em tempo real, e ficam guardados no navegador.
- Ações em lote nos atendimentos: botão "Selecionar" na lista, caixas de marcar, "Marcar todos" e as ações Aceitar,
  Transferir (fila e, se quiser, atendente) e Finalizar (com motivo e observação). Até 100 por vez, pelas mesmas regras
  do atendimento individual (`POST /tickets/bulk`); o que não puder ser alterado é informado à parte.
- Chat interno reorganizado: ao abrir a tela já aparecem as conversas (grupos e a dois, a mais recente primeiro) e as
  pessoas da empresa, numa lista só com busca. Clicar numa pessoa abre (ou cria) a conversa a dois com ela; grupos
  ganham o botão "Novo grupo" e a edição e exclusão no cabeçalho da conversa. A lista se atualiza em tempo real e, no
  celular, mostra lista e conversa uma de cada vez.
- Português como idioma padrão e tema que acompanha o claro ou escuro do Windows (também quando ele muda com a tela
  aberta); o interruptor fixa uma escolha e "Tema do sistema (Windows)", no menu do usuário, volta a seguir o sistema.
- Barra de digitar mensagem com tom próprio: campo arredondado flutuando sobre o fundo da conversa, nos atendimentos e
  no chat interno.
- Dashboard redesenhado: saudação, período em botões, cartões "Agora" com rosca e filas principais, indicadores do
  período com ícones, gráfico nas cores da marca. No celular a busca do topo vira só o botão da lupa.
- Kanban em formato de post-it: cada atendimento é uma nota na cor da etiqueta da coluna (amarelo na coluna "Em aberto"),
  com fita no topo, canto dobrado, pequena inclinação fixa por atendimento e efeito ao passar o mouse.

### Corrigido

- A paginação de Contatos conta cada contato uma vez, mesmo quando ele tem várias etiquetas.
- A sincronização de etiquetas confere a empresa do atendimento, do contato e das etiquetas antes de associá-los,
  e o servidor impede novas associações incompatíveis com o setor da conversa.
- Reconexão do WhatsApp: quedas de rede reconectam com espera crescente (2 s até 5 min) em vez de 2 s fixos; uma
  sessão aberta por outro cliente com as mesmas credenciais (código 440) para e avisa os administradores, em vez de
  ficar derrubando a outra; o bloqueio (403) não tenta mais reconectar depois de apagar a sessão. O log registra o
  motivo de cada queda.

- O sistema não pede mais a localização do navegador ao abrir. O país do campo de telefone vem do idioma do navegador
  (pt-BR vira Brasil), sem enviar coordenadas ao OpenStreetMap nem o endereço IP ao ipinfo.io.
- O Dashboard não consulta mais o ipapi.co com o IP de quem abre, e o painel não carrega mais o Google Analytics do
  projeto Ticketz para superusuários.
- Os contadores das abas "Atendendo" e "Aguardando" não cobrem mais o texto da aba, e o botão "Aceitar" da lista de
  notificações não cobre mais o nome e o horário do atendimento.
- Erro de console em todas as páginas: o `index.html` chamava um script (`/notificame-gateway.js`) que não existe no projeto.
- Kanban: a coluna "Em aberto" esticava até 2.800 px com uma mensagem longa e escondia as outras colunas; agora fica em
  290 px. A prévia da mensagem não mostra mais as marcas de formatação (como `*Admin:*`) e o contato sem nome aparece
  com o número formatado, como na lista de atendimentos.
- A janela de novo agendamento agora se chama "Novo Agendamento" (antes "Mensagem").
- Contatos com "Minha carteira" ligada, ou com uma busca sem resultado, mostra uma mensagem em vez de uma tabela em branco.
- Configurações: rótulos longos (como "Timeout para reabertura automática (minutos)") ficam em uma linha e não cobrem mais o
  valor do campo.
- O menu do usuário fecha ao trocar entre tema claro e escuro.
- O app não trava mais com o erro "JSON.parse: unexpected character" quando o navegador guarda, para este endereço, um
  "token" que não é do sistema (por exemplo, deixado por outro aplicativo que usou a mesma porta): o valor inválido é
  descartado e a tela de login aparece.

### Operação

- A migração `20261027130000` acrescenta `Tags.queueIds` sem alterar etiquetas ou associações existentes; etiquetas
  antigas continuam disponíveis em todos os setores até que seu cadastro seja alterado.
- Clientes da agenda do WhatsApp entram em Contatos automaticamente (sem trocar nomes já cadastrados; configuração
  "Agenda do WhatsApp em Contatos"), e dá para abrir conversa com qualquer cliente pela paleta (Ctrl K, grupo
  "Clientes") e pela busca de Atendimentos (botão "Conversar").
- Histórico completo do cliente na conversa: as mensagens de atendimentos anteriores (inclusive resolvidos)
  aparecem com uma divisória por atendimento, respeitando a privacidade por fila nos atendimentos anteriores.
- Contexto na transferência: nota interna e mensagens destacadas para o setor que recebe, mostradas num cartão na
  conversa; o cliente não recebe nada.
- Endereço de publicação definido: `superchat.komunick.com`. Modelos de ambiente e do nginx já vêm com ele, e o guia
  explica o registro de DNS no Cloudflare (onde está o `komunick.com`).
- Publicação num subdomínio da Komunick (`docs/DEPLOY.md`): `docker-compose-komunick.yaml` (aplicação só em
  `127.0.0.1:5480`, banco com senha, backend sem o socket do Docker), `docker-compose-komunick-proxy.yaml` (proxy com
  HTTPS automático, opcional), modelos de ambiente e de nginx em `deploy/` e `deploy/backup.sh` (banco e arquivos, 14
  cópias). A senha do primeiro administrador vem de `ADMIN_PASSWORD`; o painel do Socket.IO fica desligado.
- Segredos que assinam o login gerados com `crypto.randomBytes` (antes `Math.random`) e fora do log.

- Quatro migrações novas (`20261021120000` a `20261021120300`) rodam na subida do backend; nenhuma remove dados.
- Mais duas migrações (`20261021130000` e `20261021130100`): tabela de motivos de finalização, motivo e observação no
  histórico do atendimento, anexo e dia útil nos agendamentos. Nenhuma remove dados.
- Atendimentos podem ficar com o status `paused`. Antes de voltar para uma versão sem esse status, retome ou finalize
  os pausados.
