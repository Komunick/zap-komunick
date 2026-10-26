# Changelog

Mudanças relevantes para quem usa, integra ou opera o projeto.

## Não publicado

### Adicionado

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
- Dois layouts próprios, escolhidos no menu do usuário: "Workspace" (trilho de ícones à esquerda) e "Foco" (logo e abas de
  navegação no topo, sem barra lateral). Os dois têm barra do topo plana, conteúdo sem cartões flutuantes e busca global
  com `Ctrl K` (páginas e atendimentos). O trilho de ícones ganha dica com o nome de cada página.
- O botão de recolher o menu fica dentro da barra lateral, ao lado da logo (ou logo abaixo dela, no modo só ícones), em
  vez de solto na barra do topo; o botão de hambúrguer da barra do topo só aparece no celular.
- Menu lateral maior e mais legível: itens de 48 px, ícones de 26 px, texto de 15,5 px, títulos de seção de 12,5 px e
  largura de 264 px (72 px só com ícones).
- Kanban em formato de post-it: cada atendimento é uma nota na cor da etiqueta da coluna (amarelo na coluna "Em aberto"),
  com fita no topo, canto dobrado, pequena inclinação fixa por atendimento e efeito ao passar o mouse.

### Corrigido

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

- Quatro migrações novas (`20261021120000` a `20261021120300`) rodam na subida do backend; nenhuma remove dados.
- Mais duas migrações (`20261021130000` e `20261021130100`): tabela de motivos de finalização, motivo e observação no
  histórico do atendimento, anexo e dia útil nos agendamentos. Nenhuma remove dados.
- Atendimentos podem ficar com o status `paused`. Antes de voltar para uma versão sem esse status, retome ou finalize
  os pausados.
