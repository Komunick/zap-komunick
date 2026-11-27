# Changelog

Mudanças relevantes para quem usa, integra ou opera o projeto.

## Não publicado

### Adicionado

- **Mensagem de finalização com pergunta a quem finaliza.** Em Configurações › Opções, "Mensagem de finalização ao
  cliente" pode ficar em "Perguntar a quem finaliza": ao clicar em Finalizar na conversa, a pessoa vê o texto que o
  cliente receberia (a "Mensagem de conclusão" da conexão) e escolhe entre **Enviar mensagem e finalizar** e
  **Finalizar sem mensagem**. Nesse modo a mensagem só sai com essa escolha: finalizar pela lista, em lote ou por
  automação não manda, e um atendimento já finalizado não recebe a mensagem de novo. Exceção: com a avaliação do
  atendimento ligada a pergunta não aparece e a mensagem segue o fluxo da avaliação. O padrão continua "Enviar sempre
  que finalizar", como era (RF-034).
- Importação do histórico de conversas do ZapContábil como atendimentos fechados (script `importZappyHistory`, com
  simulação antes de gravar e sem repetir mensagens que o SuperChat já tem). Primeira etapa só com texto (RF-029).
  Mensagem importada é só para consulta: o menu avisa, e responder citando, encaminhar, editar, apagar ou reagir é
  recusado com explicação. Gravar exige a data de corte (`--until` ou `--no-until`), e opção desconhecida interrompe.
- **Atualizar**, na barra de cima: quem já está com o SuperChat aberto é avisado quando uma versão nova é publicada,
  sem ser interrompido. Um cartão diz o que fica guardado e o que se perde antes de a página ser carregada de novo, o
  que só acontece no clique em **Atualizar agora**. Navegadores ainda na versão antiga recebem do servidor um aviso
  curto pedindo F5 (desligável com `LEGACY_CLIENT_NOTICE=off`) (RF-032).
- **Tour pelo sistema:** um tour guiado passa pelas telas de verdade e explica como cada funcionalidade funciona, com a
  tela escurecida, o ponto do passo aceso, um balão com a explicação, "Tour · passo n de N" e **Sair do tour** sempre à
  mão. São 12 passos para o atendente e 18 para o administrador. É oferecido uma vez a cada usuário e pode ser
  repetido pelo menu do usuário. Nada é enviado nem alterado durante o tour (RF-031).
- Mensagem de boas-vindas, uma vez por usuário, avisando que o SuperChat está em versão beta e que os problemas devem
  ser enviados pela aba **Suporte** (RF-030).
- **Suporte**, no menu de todos os perfis: o usuário abre chamados (título, categoria, prioridade, descrição e até 5
  anexos em imagem, vídeo ou PDF, 15 MB por envio), acompanha os próprios e conversa com a equipe ali mesmo, ao vivo.
  O superadministrador da instalação vê a fila com os chamados de todas as empresas, assume, pede informação, conclui e
  reabre. Escrever num chamado concluído reabre o chamado. O menu mostra quantos chamados têm novidade. Nada é
  enviado por e-mail (RF-030).
- Pacote para instalar o SuperChat em qualquer VM ARM64 e migrar os dados entre VMs, com ensaio (`deploy/vm`).
- Antes de enviar imagens, a conversa mostra a prévia de cada uma. Com vários arquivos, miniaturas escolhem qual ver.
- Quando o cliente já tem atendimento em andamento, o aviso diz com quem está, em que fila, por qual canal e desde
  quando. Ao iniciar conversa, a janela oferece **Abrir atendimento** e **Assumir** ou **Aceitar**, conforme as
  permissões de cada um (RF-026).
- O separador de cada atendimento anterior mostra data, fila, canal (e se está desconectado) e atendente (RF-027).
- A empresa pode exigir o nome do atendente nas mensagens manuais de texto do WhatsApp. A configuração
  prevalece sobre a preferência de assinatura do navegador e mantém o acesso por setor.
- Na tela de atendimento, um botão no cabeçalho, ao lado de Finalizar, recolhe e reabre o painel do cliente.
  Recolhido, a conversa ocupa a largura toda. O SuperChat lembra a escolha de cada usuário neste navegador.
- A mensagem de boas-vindas passa a destacar a abertura de chamado: um bloco "Encontrou uma falha? Abra um chamado."
  com o passo a passo, um incentivo a relatar mesmo as falhas pequenas, e **Abrir um chamado** como botão principal.
  Quem já tinha fechado a mensagem anterior vê a nova uma vez (RF-030).
- Alerta de chamados no Windows de quem atende: um programa que roda escondido, consulta a fila a cada 30 segundos e,
  quando chega chamado novo ou mensagem nova de um solicitante, mostra um aviso do Windows e apita, mesmo com o
  navegador fechado. Usa uma chave própria, que só lê essa lista (`deploy/alerta-suporte-windows`, RF-030).
- Arrastar arquivos para anexar passa a valer em todas as conversas. No Chat interno, soltar um ou mais arquivos em
  qualquer ponto da conversa os deixa prontos para enviar, somados aos já escolhidos. No Suporte, o arquivo pode ser
  solto em qualquer ponto do chamado, e não só no campo de texto. As duas telas mostram "Solte os arquivos para
  anexar", deixam de fora pastas e arquivos vazios com um aviso e ignoram texto ou link arrastado. Nos atendimentos
  isso já existia.
- Arquivos arrastados para a conversa ou para o campo de mensagem entram como anexo, com a mesma validação do botão
  de anexo. Pastas e arquivos vazios são recusados com aviso, inclusive pelo botão.


### Alterado

- A conversa não mostra mais, no topo, o aviso "Há N mensagens anteriores deste cliente em setores que você não
  acompanha…". A regra do histórico por setor continua a mesma: só o aviso saiu (RF-027).
- A conversa de quem ainda não escolheu o setor aparece na hora em **Aguardando**, com o rótulo **Sem setor**, para
  quem é da fila de atendimento geral, em vez de só depois do tempo de espera da triagem (15 minutos por padrão).
  Aceitar leva a conversa para a fila geral. Quem não é dessa fila continua sem vê-la, e as demais conversas sem
  fila continuam só com os administradores (RF-033).
- Atualizado com o Ticketz até a v1.0.141 (46 commits, de 21/10 a 18/11/2026, sem migração de banco). Entram:
  - dependências do backend e do frontend com correções de segurança;
  - contato que não existe no WhatsApp deixa de dar erro;
  - exclusão de empresa, usuário, fila e conexão pede que se digite "EXCLUIR";
  - tela de Empresas do superadministrador com busca e cartões;
  - contagem das listas de contatos corrigida;
  - opção "Fechar em silêncio" para atendentes, ligada por padrão como hoje;
  - chave pública do reCAPTCHA em Configurações.

  Fica a versão do SuperChat onde as duas colidem:
  - lista de atendimentos, menu, rotas, tela de Conexões, QR code, histórico de mensagens e áudio;
  - correção de impersonação e áudio, que o SuperChat já tinha (PR #53);
  - configurações sem cache. O cache de 10 s do Ticketz fica disponível só para quem o pedir: várias telas gravam
    configurações direto, como a lista de IPs e as credenciais, e o cache faria a mudança demorar a valer;
  - chave secreta do reCAPTCHA continua no ambiente (`RECAPTCHA_SECRET_KEY`), e não em texto aberto nas
    configurações;
  - a página de relatório de campanhas, que o Ticketz apagou.

  Não entram as opções "Espiar" e "Zoom dos ícones", que a lista de atendimentos do SuperChat não usa, nem os testes
  do Ticketz da tela de Conexões em cartões.
- A opção "Visibilidade da mensagem" passa a se chamar **Histórico do cliente para atendentes**, com "Só dos setores
  do atendente" e "Completo, de todos os setores". A troca de nome não mudou o comportamento; o de "Só dos setores do
  atendente" mudou depois, em 26/11 (ver Corrigido).
- O login carrega só o código de que precisa. As telas internas são baixadas conforme o uso.
- A consulta de um atendimento começa ao abrir a conversa, sem a espera fixa de 500 ms.
- A abertura do SuperChat ganha fundo mais suave e uma barra de carregamento discreta. A assinatura oficial
  “Powered by Komunick” sai da logo e passa para o rodapé.
- Em Atendimentos → Aguardando, **Ver prévia da mensagem** mostra a conversa inteira do atendimento, com
  rolagem, das mensagens do cliente às respostas automáticas. A prévia só lê: o atendimento continua aguardando
  até alguém clicar em **Aceitar e abrir**.
- O download de mídia recebida pelo WhatsApp junta os pedaços uma única vez no fim, em vez de copiar o acumulado
  a cada pedaço. Em um arquivo de 15 MiB, o custo de CPU cai de cerca de 1,9 s para poucos milissegundos, sem
  mudar o arquivo salvo nem o limite de velocidade.

### Corrigido

- Tour pelo sistema: depois do tour, o botão Voltar do navegador não passa mais pelas telas do tour; fechar o convite
  com Esc ou com um clique fora não conta mais como "Agora não"; o cartão acompanha a tela quando o celular é virado; e
  responder ao convite numa aba fecha o convite nas outras (RF-031).
- A barra de envio de anexos segue o tema. No modo escuro ela era quase branca e o nome do arquivo não aparecia.
- Enviar vários anexos de uma vez no atendimento. As imagens são reduzidas no navegador antes de subir, e o envio
  saía depois de 2 segundos fixos, com o que estivesse pronto: com várias fotos, ou num computador mais lento, parte
  dos arquivos (ou todos) ficava de fora sem nenhum aviso, e a ordem podia trocar. Agora:
  - cada arquivo espera a própria redução e vai num pedido só dele, na ordem em que foi escolhido. Uma foto sozinha
    também sai mais rápido, sem a espera fixa;
  - se um arquivo falhar, o envio para ali, um aviso diz em qual arquivo parou e os que faltam continuam selecionados
    para tentar de novo. Antes, a seleção inteira era descartada;
  - colar (Ctrl+V) vários arquivos anexa todos, e não só o primeiro;
  - foto que o navegador não consegue reduzir (HEIC, por exemplo) vai como está, em vez de ser descartada;
  - no servidor, os arquivos de um mesmo pedido saem um por vez e na ordem (saíam todos ao mesmo tempo), a cópia
    temporária é apagada mesmo quando o envio falha, e um pedido de envio que chega sem nenhum arquivo é recusado com
    erro, em vez de respondido como sucesso.
- Conexão de WhatsApp que parece aberta e não recebe mais nada:
  - um download interno cortado ou parado por 60 s agora dá erro. Antes ele esperava para sempre e prendia a fila
    de mensagens, confirmações e avisos;
  - se um item da fila passa de 2 minutos, a conexão é refeita sozinha com as mesmas credenciais, sem QR code novo.
    O WhatsApp entrega de novo o que não foi confirmado;
  - as publicações de Status dos contatos enviadas no formato novo do WhatsApp passam a ser confirmadas;
  - se a própria tentativa de reconectar falhar (banco ou rede fora do ar naquele instante), o SuperChat tenta de
    novo. Antes o canal ficava parado até alguém reiniciar.
- O leitor de PDF não fica mais alternando entre a página e "Carregando PDF…" em telas de pouca altura (notebook,
  janela pequena ou zoom alto). A barra de rolagem da janela do anexo mudava a largura medida e fazia o leitor
  redesenhar sem parar.
- Mensagens enviadas pelo número da empresa fora do SuperChat (outro aplicativo no mesmo número ou o celular) para um
  cliente sem atendimento ativo entram no histórico dele e não abrem mais um atendimento aguardando sem fila. Esses
  atendimentos só apareciam para administradores e travavam o **Novo atendimento** desse cliente. Se o canal tem uma
  fila só ou o cliente tem dono na carteira, o atendimento continua sendo aberto como antes.
- Iniciar conversa com um cliente que tem um atendimento aguardando sem fila e sem atendente passa esse atendimento
  para a fila escolhida e o aceita, em vez de mostrar um aviso que só administradores conseguiam resolver.
- Iniciar conversa com um cliente cujo atendimento já é da própria pessoa (aguardando com o nome dela, pausado ou sem
  fila) abre esse atendimento, em vez de dizer que o cliente está em atendimento com outra pessoa (RF-028).
- Com o proxy de saída do WhatsApp configurado, os downloads de estado e de conteúdo (mmg.whatsapp.net) passam
  pelo mesmo caminho da conexão. Antes saíam direto, falhavam onde só o proxy alcança a internet e derrubavam a
  sincronização depois de reconectar.
- As rotas de registro da instalação no Ticketz (`/ticketz/registry`) passam a exigir superadministrador. Antes,
  qualquer administrador de empresa passava, porque a rota importava `isAdmin` com o nome `isSuper`.
- O repositório deixa de guardar certificados e chaves herdados do Ticketz original (`backend/certs`,
  `backend/certification` e `frontend/certification`). Eram de terceiros ou de desenvolvimento e não eram usados.
  O `.gitignore` passa a recusar `*.p12`, `*.pfx`, `*.pem` e `*.key`.
- A imagem do `frontend/Dockerfile` publica em `/config.json` só as chaves que o frontend lê, em vez de todas as
  variáveis do contêiner, e deixa de copiar a interface do Socket.IO Admin. A publicação da ARM04 já usava uma
  lista fechada e não muda.
- O menu de setores do robô sai uma vez por espera. Antes ele era reenviado a cada mensagem que o cliente
  mandava sem escolher o setor, às vezes duas vezes no mesmo segundo. Se o cliente não escolher, o atendimento
  segue para a fila geral no tempo configurado, como antes.
- As reações que o cliente manda no WhatsApp aparecem embaixo da mensagem original, também ao reabrir a
  conversa. Cada pessoa mostra só a reação mais recente, e a reação removida some.
- O painel de notificações e os avisos do navegador respeitam os setores vinculados ao usuário.
  Ao transferir um atendimento, a notificação é retirada da fila de origem.
- Quando um WhatsApp atende uma única fila, a primeira mensagem recebida já fica registrada nela. Se o atendimento
  existente estiver em uma fila incompatível, a entrada corrige o vínculo antes de registrar a nova mensagem.
- Agendamentos usam o WhatsApp da fila selecionada ou o canal do atendimento de origem. Se o canal
  não estiver disponível ou o agendamento antigo tiver origem ambígua, o envio fica com erro.
- Mensagens automáticas da fila só saem por um WhatsApp vinculado a ela. O sistema recusa
  transferências para filas que não atendem pelo número da conversa.
- Em Novo atendimento, a fila escolhida define o WhatsApp de envio. Se ela não tiver um canal conectado,
  o sistema avisa e bloqueia a abertura.
- A tela de Conexões acompanha o QR Code do WhatsApp, avisa quando ele expira e permite gerar outro na mesma janela.
- Miniaturas da galeria do chat interno usam a mesma sessão autenticada da imagem principal. Erros e fechamento
  também liberam essas referências, preservando a galeria dos atendimentos e os downloads existentes.
- PDF e outros documentos com nome longo voltam a ser enviados e registrados na conversa. A cópia em disco
  usa um nome encurtado e sem caracteres que quebram caminho ou link; o cliente recebe o nome original. Vários
  arquivos enviados juntos não se sobrescrevem mais.
- O menu lateral do desktop se recolhe quando o mouse sai da barra.
- Depois de transferir um cliente para outro setor, quem transferiu abria uma conversa com ele de novo e a conversa
  do dia não estava mais lá. Com o histórico "Só dos setores do atendente", as mensagens seguiam o setor atual do
  atendimento. Agora, de um atendimento que saiu do seu setor, a pessoa continua lendo tudo o que já estava na
  conversa até a última mensagem trocada no setor dela (inclusive o que o cliente escreveu a outro setor antes de
  chegar a ela, e os anexos), e pode citar essas mensagens numa resposta. O que o setor seguinte trocar depois
  continua só dele, e o atendimento transferido continua fechado para quem não é do setor. Atendimento que está no
  setor da pessoa aparece inteiro no histórico, como ao abri-lo. No histórico, outro atendimento do cliente que ainda
  não foi resolvido aparece como "Atendimento em andamento", e o menu das mensagens de um atendimento fora do setor
  da pessoa oferece só **Responder** (reagir, editar, apagar e encaminhar dependem do atendimento da mensagem e eram
  recusados). Uma mensagem que já estava na conversa e for editada depois aparece com o texto atual (RF-017, RF-027).

### Segurança

- Avisos em tempo real de filas, usuários, campanhas, listas de contatos, respostas rápidas, ajuda e agendamentos
  chegam só aos usuários conectados da própria empresa. Antes, qualquer usuário autenticado podia escutar os
  eventos de outra empresa. Os avisos da plataforma continuam para todos.
- A conversão de áudio gravado chama o ffmpeg sem shell, com cada argumento separado. Um nome de arquivo com aspas,
  `;`, `&` ou `$()` não executa mais comandos no servidor. Os uploads guardam só extensões alfanuméricas simples.
- Entrar em outra empresa (impersonação) exige conta Super já na rota, antes das checagens do serviço.

- Na visibilidade por fila, de outro atendimento do cliente a pessoa só lê o que o setor dela pode ler ou já leu: o
  atendimento que está hoje num setor dela, e, do que saiu, o que havia na conversa até a última mensagem do setor
  dela. Anexos e citações seguem a mesma regra (ajustada em 26/11: antes valiam o setor atual do atendimento e o
  setor gravado na mensagem, o que tirava do setor de origem a conversa que ele mesmo teve). Criar ou excluir usuários
  exige o perfil administrativo atual.

- A geração de um novo QR Code fica restrita a administradores da empresa dona do canal desconectado.

- A consulta de setores confere o usuário e seus privilégios atuais antes de listar outra empresa. Usuários e
  administradores comuns ficam na própria empresa; a seleção empresarial do superusuário continua disponível.
  Parâmetros inválidos e sessões com contexto alterado são recusados.

- "Acessar como" exige superusuário atual e vincula a sessão assumida à sua origem. Entrada, retorno e renovação
  recusam contas, vínculos ou versões revogados e aplicam os IPs permitidos da identidade de destino. Sessões
  derivadas antigas exigem novo login; tokens de acesso já emitidos mantêm a validade de até quinze minutos.
  Ativar ou desativar 2FA durante a impersonação exige novo login, sem gerar uma sessão normal do alvo.

- Opções e mídia de setores conferem o administrador e a empresa atuais, incluindo pais e encaminhamentos. Uploads
  são autorizados antes da gravação; campos de identidade/mídia enviados no body não substituem os dados protegidos.
  Listas e exclusões respeitam a empresa autenticada.

- Busca de contatos (tela Contatos e `GET /contacts`, inclusive com token de API): o texto buscado agora chega ao
  banco só como valor. Antes, uma aspa simples no texto alterava a consulta SQL, falha que veio do Ticketz. A busca
  continua sem diferenciar acentos e maiúsculas, e nomes com apóstrofo (como "D'Ávila"), que davam erro, passam a ser
  encontrados.

- A nota de transferência só cita mensagens do atendimento que está sendo transferido. Antes, um id de mensagem de
  outro atendimento do mesmo cliente, enviado numa requisição montada à mão, era copiado para a nota sem conferir se a
  pessoa podia ler aquela mensagem. A tela nunca ofereceu essas mensagens (RF-017).

### Adicionado

- O atendente pode consultar a última mensagem recebida de um atendimento pendente e depois usar
  **Aceitar e abrir**. Consultar a prévia preserva o status e a leitura.
- Uma fila geral configurada no WhatsApp recebe atendimentos que escolhem **Geral** ou passam do prazo de triagem.
  Os atendentes da fila podem assumir esses atendimentos.
- Alertas de SLA aparecem no SuperChat após três horas sem resposta. Cada setor pode ter responsáveis
  e a empresa pode indicar pessoas para acompanhar todos os setores.

- Menu lateral abre ao passar o mouse sobre o trilho recolhido no desktop, sem precisar clicar. Botão, teclado,
  preferência salva e funcionamento por toque no celular continuam disponíveis.

- Consulta integrada simulada no atendimento, com seleção independente de clientes Acessórias/SCI, texto elegível da
  conversa, fontes/horários e avisos de limite, desatualização e falha parcial. Resumo e sugestão exigem ação humana;
  sugestão editável só é anexada ao rascunho após nova validação de contexto/vínculos, sem envio. Começa desligada e
  mantém as flags das fontes independentes, sem IA/API real, sincronização ou documentos.

- Painel SCI simulado com clientes explicitamente vinculados e metadados de publicações paginados, origem e
  atualização. Começa desligado por empresa/servidor, mantém vínculos separados do Acessórias e exige confirmação
  administrativa para alterações locais. Não usa API/token real, download de documento ou marcação de leitura.

- Preparação de dois ambientes ARM64 na ARM07: superchatdev.komunick.com para desenvolvimento e
  superchat.komunick.com para produção. Cada um tem projeto, banco, Redis, arquivos e segredos próprios,
  frontend por hash para seu domínio e bootstrap separado. Ambos mantêm WhatsApp e fornecedores desligados;
  ativação dos domínios e migração de dados não fazem parte dessa preparação.

- Área de arquivos da conversa com filtros, paginação e busca nos itens carregados. Imagens, vídeos e PDFs abrem
  dentro do aplicativo, com zoom/rotação, reprodução e controles de página. Prévias locais de até 25 MiB usam a nova
  API autenticada; os links públicos legados de entrega permanecem disponíveis. Sem alteração do envio ou armazenamento.
- Painel Acessórias simulado com cadastro fictício, pendências paginadas, origem/atualização e aviso de desatualização.
  Clientes exigem vínculo local explícito por empresa/contato, administrado com confirmação e seleção entre múltiplos
  vínculos. Começa desligado e não conecta fornecedor, credenciais reais, documentos ou IA.
- Assistente simulado para resumir texto do atendimento atual e sugerir resposta com referências e revisão humana.
  A sugestão pode ser editada e anexada ao rascunho sem substituir o texto existente nem enviar automaticamente.
  Começa desligado por empresa e exige modo `mock` no backend; não usa chave nem provedor de IA real.
- Armazenamento cifrado por empresa para credenciais de IA e dos futuros conectores Acessórias/SCI, com estado público,
  substituição, remoção e migração administrativa. Exige chave mestra configurada exclusivamente no backend.
- Segurança da conta com verificação em duas etapas por autenticador, QR/chave de configuração, códigos de recuperação
  de uso único e gerenciamento pelo usuário. Login pede o segundo fator antes de abrir a sessão quando 2FA está ativo.
- IPs permitidos por empresa, com IPv4/IPv6 e redes CIDR, validação da lista e proteção contra bloquear o próprio acesso.
- Auditoria administrativa com filtros de período, usuário e ação, paginação e detalhes de eventos de acesso, segurança,
  usuários e configurações. Usuários mostra o estado de 2FA e permite reset administrativo de outra conta.
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

- Logo padrão SuperChat adota a opção Essencial: nome sem símbolo ao lado, tipografia mais leve e Powered by
  Komunick menor, com a assinatura oficial preservada. O topo do menu fica mais baixo e mantém altura automática
  para logos personalizadas. Ícone compacto e favicon continuam disponíveis.

- Chat interno com busca limpável, estados de carregamento/vazio/erro e repetição, seleção e não lidas acessíveis.
  Mensagens, anexos e campo de envio respeitam a largura disponível e os temas claro e escuro.

- A chave de IA não é mais preenchida na tela nem salva ao desfocar. Configurações mostra somente seu estado e exige
  ação explícita para salvar, proteger uma configuração antiga ou confirmar remoção.
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

- Migração de anexos privados no Windows usa um handle de diretório gravável para flush, mantendo o comportamento
  POSIX. Preflight recusa filesystem/permissões incompatíveis antes da publicação; retomada sincroniza a cópia
  privada antes de remover a pública, preservando hashes, locks e prontidão.

- Operações de segurança revalidam empresa, perfil e privilégio de superusuário no cadastro atual. Tokens antigos
  deixam de autorizar alterações de 2FA, IPs permitidos ou leitura de auditoria após mudança desses acessos.
- Criar uma etiqueta já existente preserva seus setores; a alteração continua restrita à edição autorizada.
- Falhas de autenticação e 2FA são sanitizadas antes dos logs e da telemetria, incluindo JSON inválido e erros de
  persistência. Códigos de erro, status HTTP e espera por limite de tentativas são preservados.
- Financeiro sai dos menus e a aba Containers Docker sai de Configurações, no desktop e no celular. API e os demais
  itens continuam disponíveis conforme as permissões existentes; a infraestrutura de publicação é preservada.
- Endosso SuperChat usa a logo oficial completa Komunick Inteligência e Tecnologia, com versões vertical e horizontal.
  O navegador e as notificações usam um endereço próprio para o favicon SuperChat, preservando ícones Whitelabel
  personalizados e o contador de conversas não lidas.

- Marca padrão passa a SuperChat, com logo `superChat`, endosso `Powered by Komunick` e símbolo próprio nos ícones.
  Nomes antigos de produto são apresentados com a nova marca, preservando personalizações de empresas, créditos
  upstream e dados existentes. A identidade se adapta aos dois temas, menu recolhido e celular. Novos cadastros 2FA
  usam o rótulo SuperChat; autenticadores já cadastrados conservam o nome salvo até eventual recadastro voluntário.

- Movimentação direta do Kanban aplica a visibilidade atual de empresa, fila e atendimento, inclusive ao remover a
  coluna; uma negativa não altera etiquetas, retorna dados do atendimento ou emite eventos.
- Administração de credenciais revalida o vínculo e o perfil atuais: Bearer de uma empresa anterior não permite
  consultar estado, substituir, remover ou migrar o cofre após transferência ou perda de permissão.
- CI do fork valida o código sem publicar imagens automaticamente. Publicação fica explícita e desligada por padrão,
  limitada ao namespace do próprio repositório; nenhum workflow inicia a aplicação ou faz deploy.

- Login de usuários comuns deixa de abrir transitoriamente o dashboard e consultar suas APIs administrativas.
  O destino respeita o perfil e a resolução da sessão; administradores mantêm o dashboard e as APIs continuam
  recusando usuários comuns com 403.

- Anexos do chat interno passam a exigir sessão e participação atual para visualização, reprodução e download.
  Arquivos existentes têm migração explícita para armazenamento privado, com verificação de integridade e retomada;
  links públicos antigos são bloqueados também no ingresso nginx. Arquivos dos demais módulos permanecem preservados.

- Chat interno passa a conferir empresa e participação nas operações e nos eventos; somente o dono participante
  administra grupos, e marcar leitura usa o usuário autenticado. Remoção de participante limpa também o popover.
  Upload é autorizado antes de gravar e revalidado antes de confirmar, com limpeza segura dos arquivos da requisição.

- No chat interno, Shift+Enter insere uma linha; texto e anexos permanecem disponíveis quando o envio falha.
  Envios pendentes não são repetidos, e respostas atrasadas do histórico não entram em outra conversa.

- Restauração do banco com índice de busca de etiquetas: a função de normalização
  resolve a extensão de acentos pelo esquema explícito, preservando os resultados.

- Rascunhos deixam de ser apagados ao abrir ou trocar de atendimento. Uma resposta atrasada do assistente não altera
  o editor de outra conversa; a revisão fica bloqueada durante a confirmação de uso para preservar a versão aceita.
- Editor e assistente aguardam o atendimento válido ao carregar/trocar de conversa, impedindo rascunho sem
  proprietário e pedidos com ID ausente; respostas antigas de carregamento são ignoradas.
- Credenciais de IA removidas das respostas de autenticação/configuração; segredos conhecidos deixam de acompanhar
  o payload geral da empresa. Configurações herdadas exigem migração explícita para proteção em repouso.
- Notas, leitura de atendimento e histórico validam empresa, cliente e setor, incluindo atendentes sem setor, IDs/UUIDs
  externos e referências a mensagens; editar uma nota não permite trocar seu vínculo/autor pela requisição.
- Eventos em tempo real deixam de entregar contexto por atribuição ou assinatura antiga sem setor permitido; acesso
  é revisto após transferências e mudanças de permissões. Erros de credenciais/JSON e consultas lentas não registram
  valores secretos ou SQL bruto.

- Credenciais e segredos não são incluídos no trace de requisições nem nos detalhes da auditoria. Desafios de 2FA,
  códigos do autenticador e de recuperação recusam reutilização e respeitam limite de tentativas.
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

- As migrações `20261027120000` e `20261027120100` acrescentam auditoria e campos de 2FA; contas existentes começam com
  2FA desligado. `TRUST_PROXY` precisa indicar explicitamente os proxies conhecidos antes de usar a restrição de IP
  atrás de proxy. Ativar/desativar 2FA preserva a sessão atual e invalida renovações antigas de outras sessões.
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
