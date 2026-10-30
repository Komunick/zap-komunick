// Zap Komunick: texts of the features added by the fork (docs/PRD.md).
// Kept apart from the upstream dictionaries so Ticketz updates merge cleanly;
// they are deep merged over them in ./index.js. Languages without an entry
// here fall back to English.

const pt = {
  login: {
    welcome: "Entrar na sua conta",
    welcomeSubtitle: "Use o e-mail e a senha cadastrados pelo administrador.",
    noAccount: "Ainda não tem conta?",
    darkMode: "Usar tema escuro",
    lightMode: "Usar tema claro",
    hero: {
      title: "Todo o atendimento do WhatsApp em um só lugar.",
      subtitle:
        "Filas, carteira de clientes, Kanban e prazos de resposta para a equipe inteira atender pelo mesmo número.",
      points: {
        sla: "Painel de SLA",
        wallet: "Carteira de clientes",
        kanban: "Kanban por etiquetas"
      },
      preview: {
        client1: "Cliente Modelo",
        message1: "Bom dia! Pode me mandar a guia?",
        chipSla: "SLA",
        client2: "Padaria Avenida",
        message2: "Enviei os documentos agora.",
        chipWallet: "Carteira",
        client3: "Loja Fictícia",
        message3: "Combinado, aguardo o retorno.",
        chipKanban: "Em análise"
      }
    }
  },
  mainDrawer: {
    collapseMenu: "Recolher menu",
    expandMenu: "Expandir menu",
    listItems: {
      kanban: "Kanban",
      sla: "Painel de SLA",
      metrics: "Métricas",
      onlineUsers: "Usuários online",
      closeReasons: "Motivos de finalização"
    }
  },
  kanban: {
    title: "Kanban",
    refresh: "Atualizar",
    manageTags: "Gerenciar etiquetas",
    noKanbanTags:
      "Nenhuma etiqueta marcada como coluna do Kanban. Em Etiquetas, edite uma etiqueta e ligue “Usar como coluna do Kanban”.",
    truncated:
      "Há muitos atendimentos em aberto; o quadro mostra os 500 movimentados mais recentemente.",
    openLane: "Em aberto",
    emptyLane: "Arraste atendimentos para cá",
    moveTo: "Mover para",
    openTicket: "Abrir atendimento",
    noAttendant: "Sem atendente"
  },
  sla: {
    title: "Painel de SLA",
    refresh: "Atualizar",
    configSummary:
      "Prazo de resposta: {{sla}} · Alerta de antigos: {{hours}} h",
    updatedAt: "atualizado às",
    disabled:
      "O prazo de SLA ainda não foi definido, então nenhum atendimento aparece como estourado.",
    goToSettings: "Definir prazo",
    cards: {
      total: "Em aberto",
      pending: "Aguardando",
      open: "Em atendimento",
      breached: "SLA estourado",
      old: "Abertos há +{{hours}} h",
      waitingClients: "Clientes sem resposta",
      groups: "Grupos em aberto",
      waitingGroups: "Grupos sem resposta"
    },
    byQueue: "Em aberto por fila",
    byUser: "Em aberto por atendente",
    tickets: "Atendimentos",
    table: {
      name: "Nome",
      open: "Em aberto",
      waiting: "Sem resposta",
      breached: "Estourados",
      old: "Antigos",
      client: "Cliente",
      ticket: "Ticket",
      queue: "Fila",
      owner: "Responsável",
      status: "Status",
      waitingFor: "Aguardando há",
      situation: "Situação"
    },
    filters: {
      all: "Todos",
      breached: "Estourados",
      old: "Antigos",
      waiting: "Sem resposta"
    },
    empty: "Nada por aqui.",
    noQueue: "Sem fila",
    noOwner: "Sem dono",
    group: "Grupo",
    answered: "Respondido",
    status: {
      open: "Em atendimento",
      pending: "Aguardando"
    },
    situation: {
      ok: "No prazo",
      breached: "Estourado",
      old: "+{{hours}} h"
    },
    badge: "SLA",
    badgeTooltip: "SLA estourado: cliente aguardando resposta há {{time}}"
  },
  settings: {
    credentials: {
      aiKey: "Chave de IA",
      loading: "Consultando configuração…",
      unavailable: "Não foi possível consultar a configuração.",
      configured: "Chave configurada. O valor salvo não é exibido.",
      notConfigured: "Nenhuma chave configurada.",
      migrationPending:
        "A chave antiga aguarda migração para armazenamento protegido.",
      storageUnavailable:
        "O armazenamento protegido precisa ser configurado no servidor antes de salvar uma chave.",
      save: "Salvar nova chave",
      remove: "Remover chave",
      confirmRemove: "Confirmar remoção",
      removeWarning:
        "A transcrição de áudio que usa esta chave ficará indisponível até uma nova chave ser cadastrada. A remoção local não revoga a chave no fornecedor.",
      cancel: "Cancelar",
      migrate: "Proteger chave existente",
      saved: "Configuração atualizada.",
      requestError:
        "Não foi possível atualizar ou consultar a chave. Tente novamente."
    },
    closeReason: {
      group: "Finalização de atendimentos",
      required: "Exigir motivo ao finalizar",
      requiredHelper:
        "Vale quando um atendente finaliza; grupos e encerramentos automáticos ficam de fora.",
      options: {
        disabled: "Não exigir",
        enabled: "Exigir"
      }
    },
    sla: {
      group: "SLA e carteira de clientes",
      minutes: "Prazo de SLA (minutos sem resposta)",
      minutesHelper: "0 desliga o alerta de SLA",
      oldTicketHours: "Alerta de antigos (horas)",
      oldTicketHoursHelper:
        "Destaca atendimentos abertos há mais tempo; 0 desliga"
    },
    wallet: {
      autoAssign: "Atendimento de contato da carteira",
      options: {
        disabled: "Seguir o fluxo normal (chatbot e filas)",
        enabled: "Enviar direto para o responsável"
      }
    }
  },
  tagModal: {
    form: {
      kanban: "Usar como coluna do Kanban",
      queuesHelp:
        "Sem setor, a etiqueta vale para todos. Com setores, só eles a veem e usam."
    }
  },
  tags: {
    table: {
      kanban: "Kanban",
      queues: "Setores",
      allQueues: "Todos os setores"
    }
  },
  tagPicker: {
    action: "Etiquetar",
    title: "Etiquetas",
    empty: "Nenhuma etiqueta para este setor."
  },
  contactFilters: {
    tags: "Etiquetas",
    wallet: "Carteira",
    all: "Todos",
    mine: "Minha carteira",
    none: "Sem responsável"
  },
  wallet: {
    owner: "Responsável (carteira)",
    ownerHelper: "Atendente responsável por este cliente",
    none: "Sem responsável",
    myWallet: "Minha carteira",
    emptyMine:
      "Nenhum contato na sua carteira. O administrador define o responsável de cada contato.",
    empty: "Nenhum contato encontrado.",
    column: "Carteira"
  },
  customerPanel: {
    title: "Painel do cliente",
    wallet: "Carteira",
    noWallet: "Sem responsável",
    queue: "Fila",
    noQueue: "Sem fila",
    attendant: "Atendente",
    noAttendant: "Sem atendente",
    sla: "SLA",
    waiting: "Aguardando há {{time}}",
    limit: "Prazo de {{minutes}} min",
    answered: "Respondido",
    tags: "Etiquetas",
    noTags: "Sem etiquetas",
    notes: "Notas",
    edit: "Editar contato"
  },
  layoutMode: {
    title: "Layout",
    workspace: "Workspace",
    foco: "Foco",
    painel: "Painel",
    menu: "Menu",
    systemTheme: "Tema do sistema (Windows)",
    more: "Mais",
    goTo: "Ir para",
    tickets: "Atendimentos",
    searchPlaceholder: "Buscar atendimento, contato ou ação",
    noResults: "Nada encontrado.",
    darkMode: "Modo escuro"
  },
  accessHours: {
    restrict: "Restringir horário de acesso",
    helper:
      "Fora do horário o login é recusado e a sessão aberta termina. Administradores não são bloqueados.",
    weekdaysLabel: "Dias permitidos",
    weekdays: {
      0: "Dom",
      1: "Seg",
      2: "Ter",
      3: "Qua",
      4: "Qui",
      5: "Sex",
      6: "Sáb"
    },
    start: "Início",
    end: "Fim",
    noDays: "Escolha pelo menos um dia."
  },
  recurrence: {
    label: "Repetir",
    endAt: "Repetir até (opcional)",
    endAtHelper: "Em branco repete sem data final",
    column: "Repetição",
    options: {
      none: "Não repete",
      daily: "Todo dia",
      weekly: "Toda semana",
      monthly: "Todo mês",
      yearly: "Todo ano"
    }
  },
  chatPage: {
    people: "Equipe",
    search: "Buscar pessoa ou conversa",
    conversations: "Conversas",
    contacts: "Contatos",
    nobody: "Ninguém encontrado.",
    newGroup: "Novo grupo",
    editGroup: "Editar grupo",
    deleteGroup: "Excluir grupo",
    deleteWarning:
      "O grupo e todas as mensagens dele serão apagados para todos os participantes. Esta ação não pode ser revertida, confirmar?",
    groupName: "Nome do grupo",
    participants: "Participantes",
    close: "Fechar",
    save: "Salvar",
    needTitle: "Preencha o nome do grupo.",
    needUsers: "Selecione pelo menos uma pessoa.",
    back: "Voltar para a lista",
    pick: "Escolha uma conversa ou uma pessoa",
    pickHint: "Clique em alguém da lista para começar a conversar.",
    teamHint: "Conversas e pessoas da empresa",
    teamConversations: "Conversas da equipe",
    clearSearch: "Limpar busca",
    loadingConversations: "Carregando conversas e pessoas…",
    conversationsError:
      "Não foi possível carregar toda a lista. As conversas e pessoas disponíveis foram mantidas.",
    retry: "Tentar novamente",
    noResults: "Nenhuma conversa ou pessoa encontrada.",
    searchHint: "Tente outro nome, e-mail ou texto da última mensagem.",
    emptyTeamHint: "As pessoas da sua empresa aparecerão aqui.",
    emptyPreview: "Conversa sem mensagens",
    unreadMessages: "{{count}} mensagens não lidas",
    messages: "Mensagens da conversa",
    loadingMessages: "Carregando mensagens…",
    messagesError:
      "Não foi possível carregar as mensagens. As mensagens já exibidas foram mantidas.",
    loadMore: "Carregar mensagens anteriores",
    emptyMessages: "Comece esta conversa",
    emptyMessagesHint:
      "Envie uma mensagem para combinar o trabalho com a equipe.",
    unknownSender: "Participante",
    messageInput: "Mensagem interna",
    send: "Enviar mensagem",
    sending: "Enviando mensagem…",
    sendError:
      "Não foi possível enviar. Confira sua conexão e tente novamente.",
    composerHint: "Enter envia · Shift+Enter quebra a linha",
    attachFiles: "Anexar arquivos",
    sendFiles: "Enviar arquivos",
    cancelFiles: "Cancelar anexos",
    recordAudio: "Gravar áudio",
    cancelRecording: "Cancelar gravação",
    sendRecording: "Enviar gravação",
    messageImage: "Imagem da mensagem",
    playVideo: "Reproduzir vídeo",
    pauseVideo: "Pausar vídeo",
    openMedia: "Ampliar mídia",
    download: "Baixar arquivo"
  },
  dashboardPage: {
    hello: "Olá, {{name}}!",
    helloAnonymous: "Olá!",
    subtitle: "Veja como está o atendimento agora e no período escolhido.",
    now: "Agora",
    inPeriod: "No período",
    team: "Equipe no período",
    teamOnline: "Equipe online",
    waiting: "Aguardando atendimento",
    inService: "Em atendimento",
    done: "Atendimentos finalizados",
    online: "Online",
    offline: "Offline",
    nobodyOnline: "Ninguém online agora.",
    nobodyWaiting: "Ninguém esperando. Tudo em dia!",
    nobodyInService: "Nenhum atendimento em andamento.",
    more: "+ {{count}} outras filas",
    periods: {
      p0: "Personalizado",
      p3: "3 dias",
      p7: "7 dias",
      p15: "15 dias",
      p30: "30 dias",
      p90: "90 dias"
    }
  },
  onlineUsers: {
    title: "Usuários online",
    subtitle:
      "Quem da equipe está conectado agora e quanto cada um tem em mãos.",
    updatedAt: "Atualizado às {{time}}",
    refresh: "Atualizar",
    team: "Equipe",
    showOffline: "Mostrar quem está offline",
    nobody: "Ninguém online agora.",
    noQueues: "Sem filas",
    onlineNow: "Online agora",
    onlineFor: "Online há {{time}}",
    seenAgo: "Visto há {{time}}",
    seenNow: "Saiu agora há pouco",
    neverSeen: "Nunca entrou",
    situation: {
      online: "Online",
      outsideHours: "Fora do horário de acesso",
      offline: "Offline"
    },
    summary: {
      online: "Online",
      inService: "Em atendimento",
      idle: "Online sem atendimento",
      offline: "Offline",
      outsideHours: "Fora do horário"
    },
    numbers: {
      openCount: "em atendimento",
      pausedCount: "pausados",
      closedToday: "finalizados hoje"
    }
  },
  walletBulk: {
    transferButton: "Transferir carteira",
    selectAll: "Marcar todos os contatos da lista",
    selectOne: "Marcar {{name}}",
    selected: "{{count}} contato(s) marcado(s)",
    owner: "Responsável",
    assign: "Definir responsável",
    remove: "Tirar da carteira",
    cancel: "Cancelar",
    done: "Carteira atualizada em {{count}} contato(s).",
    nothing: "Nenhum contato foi alterado.",
    groups: "{{count}} grupo(s) ignorado(s): grupos não têm carteira.",
    transferTitle: "Transferir carteira",
    transferHint:
      "Todos os contatos de um responsável passam para outro, por exemplo quando alguém sai da equipe.",
    from: "De",
    to: "Para",
    fromCount: "{{count}} contato(s) nessa carteira",
    noOwner: "Contatos sem responsável",
    nobody: "Ninguém (tirar da carteira)",
    same: "Escolha um responsável diferente",
    transfer: "Transferir"
  },
  metrics: {
    title: "Métricas",
    subtitle:
      "Como a equipe atendeu no período: volume, tempos, prazo e motivos.",
    export: "Exportar CSV",
    period: "Período",
    days: "{{count}} dias",
    custom: "Personalizado",
    from: "De",
    to: "Até",
    queue: "Fila",
    user: "Atendente",
    allQueues: "Todas as filas",
    allUsers: "Todos os atendentes",
    loading: "Carregando...",
    nothing: "Nada no período.",
    noQueue: "Sem fila",
    noUser: "Sem atendente",
    noReason: "Sem motivo",
    byDay: "Atendimentos por dia",
    byQueue: "Por fila",
    byUser: "Por atendente",
    closeReasons: "Motivos de finalização",
    heatmap: "Horários de maior movimento (atendimentos abertos)",
    heatCell: "{{day}} às {{hour}}h: {{count}}",
    weekdays: "Dom,Seg,Ter,Qua,Qui,Sex,Sáb",
    kpi: {
      created: "Atendimentos",
      finished: "Finalizados",
      avgWait: "Tempo médio de espera",
      avgService: "Tempo médio de atendimento",
      sla: "Respondidos no prazo",
      slaHint: "Prazo de {{minutes}} min",
      slaOff: "Prazo de SLA desligado",
      newContacts: "Novos contatos",
      rating: "Nota média",
      ratingHint: "{{count}} avaliação(ões)"
    },
    cols: {
      queue: "Fila",
      user: "Atendente",
      created: "Atendimentos",
      finished: "Finalizados",
      avgWait: "Espera média",
      avgService: "Atendimento médio",
      sla: "No prazo",
      rating: "Nota",
      count: "Quantidade"
    }
  },
  transferContext: {
    noteLabel: "Contexto para o setor (opcional)",
    notePlaceholder:
      "Ex.: cliente quer a 2ª via do boleto de outubro; já conferi o CNPJ.",
    noteHint:
      "Nota interna: o setor que recebe vê na conversa. O cliente não recebe.",
    pickTitle: "Destacar mensagens na nota",
    us: "Nós",
    client: "Cliente"
  },
  history: {
    previousTicket: "Atendimento anterior #{{id}}",
    currentTicket: "Atendimento atual #{{id}}",
    transferNote: "Nota de transferência",
    transferFromTo: "{{from}} → {{to}}",
    internalOnly: "visível só para a equipe"
  },
  clients: {
    title: "Clientes",
    talk: "Conversar",
    talkTo: "{{number}} · abrir conversa",
    syncSetting: "Agenda do WhatsApp em Contatos",
    syncEnabled: "Importar automaticamente",
    syncDisabled: "Não importar",
    syncHelper:
      "Os contatos da agenda do WhatsApp conectado entram em Contatos, sem trocar nomes já cadastrados."
  },
  about: {
    licensesourcecode: "Código-fonte desta versão",
    basedOnTicketz: "Baseado no Ticketz (código original)"
  },
  tickets: {
    filters: {
      button: "Filtros",
      title: "Filtrar atendimentos",
      connections: "Conexão",
      attendants: "Atendente",
      tags: "Etiquetas (todas)",
      period: "Aberto entre",
      from: "De",
      to: "Até",
      wallet: "Carteira",
      wallet_all: "Todas",
      wallet_mine: "Minha carteira",
      wallet_none: "Sem responsável",
      unread: "Só com mensagens não lidas",
      sla: "Só SLA estourado (prazo de {{minutes}} min)",
      slaOff: "Só SLA estourado (prazo desligado)",
      clear: "Limpar",
      apply: "Aplicar"
    },
    bulk: {
      tag: "Etiquetar",
      tagTitle: "Etiquetar {{count}} atendimento(s)",
      tagHelp: "As etiquetas escolhidas se somam às que o atendimento já tem.",
      tagConfirm: "Aplicar etiquetas",
      select: "Selecionar",
      selected: "{{count}} selecionado(s)",
      all: "Marcar todos ({{count}})",
      none: "Desmarcar",
      accept: "Aceitar",
      acceptSome: "Aceitar {{count}}",
      transfer: "Transferir",
      close: "Finalizar",
      cancel: "Cancelar",
      transferTitle: "Transferir atendimentos",
      queue: "Fila",
      user: "Atendente",
      userHint: "Sem atendente, eles voltam para a fila, aguardando.",
      noUser: "Sem atendente (aguardando)",
      closeTitle: "Finalizar {{count}} atendimento(s)",
      closeHint:
        "O motivo e a observação valem para todos. Os clientes não recebem a pesquisa de avaliação.",
      done: "{{count}} atendimento(s) atualizado(s).",
      failed:
        "{{count}} não puderam ser alterados (situação mudou ou sem permissão)."
    },
    views: {
      label: "Visões dos atendimentos",
      mine: "Meus",
      inService: "Em atendimento",
      waiting: "Aguardando",
      queues: "Fila:"
    },
    tabs: {
      paused: { title: "Pausados" }
    },
    paused: {
      badge: "Pausado"
    }
  },
  messagesList: {
    header: {
      buttons: {
        pause: "Pausar atendimento",
        resume: "Retomar",
        transfer: "Transferir",
        finish: "Finalizar"
      }
    }
  },
  messagesInput: {
    placeholderPaused: "Atendimento pausado. Clique em Retomar para responder."
  },
  closeReasons: {
    title: "Motivos de finalização",
    add: "Novo motivo",
    hint: "O atendente escolhe um destes motivos ao finalizar. A contagem mostra os atendimentos finalizados nos últimos {{days}} dias.",
    empty: "Nenhum motivo cadastrado ainda.",
    onlyAdmin: "Só administradores cadastram motivos de finalização.",
    withoutReason: "Finalizados sem motivo",
    edit: "Editar",
    delete: "Excluir",
    table: {
      name: "Motivo",
      usage: "Uso nos últimos {{days}} dias",
      active: "Ativo",
      actions: "Ações"
    },
    dialog: {
      addTitle: "Novo motivo de finalização",
      editTitle: "Editar motivo",
      name: "Nome do motivo",
      cancel: "Cancelar",
      save: "Salvar"
    },
    confirmDelete: {
      title: "Excluir o motivo {{name}}?",
      message:
        "Os atendimentos já finalizados com ele passam a contar como sem motivo. Para guardar o histórico, desative em vez de excluir."
    },
    modal: {
      title: "Finalizar atendimento",
      subtitle: "Escolha o motivo para finalizar a conversa com {{contact}}.",
      noReasons:
        "Nenhum motivo ativo. Peça ao administrador para cadastrar em Motivos de finalização.",
      reason: "Motivo",
      note: "Observação (opcional)",
      cancel: "Cancelar",
      confirm: "Finalizar"
    }
  },
  scheduleExtras: {
    contacts: "Contatos",
    tag: "Ou todos os contatos de uma etiqueta",
    noTag: "Nenhuma etiqueta",
    recipientsHelper:
      "A mesma mensagem é agendada para cada contato. Contatos e etiqueta somam, sem repetir, até 500 por vez.",
    required: "Escolha pelo menos um contato ou uma etiqueta.",
    businessDays: "Enviar só em dia útil",
    businessDaysHelper:
      "Se cair em fim de semana ou feriado, vai no próximo dia útil, no mesmo horário.",
    attach: "Anexar arquivo",
    attaching: "Enviando arquivo…",
    attachmentHelper: "O arquivo vai junto com a mensagem.",
    created: "{{count}} agendamentos criados.",
    attachmentTooltip: "Anexo: {{name}}",
    businessDaysTooltip: "Só em dia útil"
  },
  backendErrors: {
    ERR_NO_CHAT_FOUND: "Conversa não encontrada ou indisponível.",
    ERR_CHAT_DIRECT_READONLY:
      "Conversas diretas não podem ser editadas ou excluídas.",
    ERR_INVALID_CHAT_USER: "Selecione participantes válidos da sua empresa.",
    ERR_INVALID_CHAT_TITLE: "Informe um nome válido para o grupo.",
    ERR_INVALID_CHAT_PAGE: "Página do chat inválida.",
    ERR_INVALID_CHAT_MESSAGE: "Mensagem inválida.",
    ERR_BULK_NO_TAGS: "Escolha ao menos uma etiqueta (no máximo 20).",
    ERR_INVALID_TAG_FILTER: "Filtro de etiquetas inválido.",
    ERR_TICKET_PAUSE_NOT_OPEN: "Só dá para pausar um atendimento em andamento.",
    ERR_CLOSE_REASON_REQUIRED: "Escolha o motivo para finalizar o atendimento.",
    ERR_CLOSE_REASON_NOT_FOUND:
      "Motivo de finalização não encontrado ou desativado.",
    ERR_CLOSE_REASON_DUPLICATED: "Já existe um motivo com esse nome.",
    ERR_CLOSE_REASON_INVALID_NAME:
      "O nome do motivo precisa ter de 2 a 120 caracteres.",
    ERR_INVALID_SCHEDULE_MEDIA:
      "Anexo do agendamento inválido. Envie o arquivo de novo.",
    ERR_SCHEDULE_NO_RECIPIENTS:
      "Escolha pelo menos um contato ou uma etiqueta.",
    ERR_SCHEDULE_TOO_MANY_RECIPIENTS:
      "Um agendamento pode ter no máximo 500 contatos.",
    ERR_NO_TAG_FOUND: "Etiqueta não encontrada.",
    ERR_NO_FILE: "Nenhum arquivo enviado.",
    ERR_OUT_OF_ACCESS_HOURS:
      "Seu usuário não tem acesso neste horário. Fale com o administrador.",
    ERR_INVALID_ACCESS_HOURS:
      "Horário de acesso inválido: escolha ao menos um dia e horários de início e fim diferentes.",
    ERR_KANBAN_TAG_NOT_FOUND: "Esta etiqueta não é uma coluna do Kanban.",
    ERR_INVALID_KANBAN_MOVE: "Movimento inválido no Kanban.",
    ERR_WALLET_GROUP_CONTACT: "Grupos não podem ter responsável de carteira.",
    ERR_INVALID_RECURRENCE: "Repetição inválida.",
    ERR_INVALID_RECURRENCE_END:
      "A data final da repetição precisa ser depois do primeiro envio."
  }
};

const en = {
  login: {
    welcome: "Sign in to your account",
    welcomeSubtitle: "Use the email and password set up by your administrator.",
    noAccount: "Don't have an account?",
    darkMode: "Use dark theme",
    lightMode: "Use light theme",
    hero: {
      title: "All your WhatsApp service in one place.",
      subtitle:
        "Queues, client wallet, Kanban and reply deadlines so the whole team serves from the same number.",
      points: {
        sla: "SLA panel",
        wallet: "Client wallet",
        kanban: "Kanban by tags"
      },
      preview: {
        client1: "Sample Client",
        message1: "Good morning! Could you send me the slip?",
        chipSla: "SLA",
        client2: "Avenue Bakery",
        message2: "I just sent the documents.",
        chipWallet: "Wallet",
        client3: "Fictional Store",
        message3: "Deal, I'll wait for your reply.",
        chipKanban: "In review"
      }
    }
  },
  mainDrawer: {
    collapseMenu: "Collapse menu",
    expandMenu: "Expand menu",
    listItems: {
      kanban: "Kanban",
      sla: "SLA panel",
      metrics: "Metrics",
      onlineUsers: "Users online",
      closeReasons: "Close reasons"
    }
  },
  kanban: {
    title: "Kanban",
    refresh: "Refresh",
    manageTags: "Manage tags",
    noKanbanTags:
      "No tag is a Kanban column yet. In Tags, edit a tag and turn on “Use as a Kanban column”.",
    truncated:
      "There are many open tickets; the board shows the 500 most recently updated.",
    openLane: "Open",
    emptyLane: "Drag tickets here",
    moveTo: "Move to",
    openTicket: "Open ticket",
    noAttendant: "No attendant"
  },
  sla: {
    title: "SLA panel",
    refresh: "Refresh",
    configSummary: "Reply deadline: {{sla}} · Old ticket alert: {{hours}} h",
    updatedAt: "updated at",
    disabled:
      "The SLA deadline is not set yet, so no ticket shows as breached.",
    goToSettings: "Set deadline",
    cards: {
      total: "Open",
      pending: "Waiting",
      open: "In service",
      breached: "SLA breached",
      old: "Open for +{{hours}} h",
      waitingClients: "Clients without reply",
      groups: "Open groups",
      waitingGroups: "Groups without reply"
    },
    byQueue: "Open by queue",
    byUser: "Open by attendant",
    tickets: "Tickets",
    table: {
      name: "Name",
      open: "Open",
      waiting: "No reply",
      breached: "Breached",
      old: "Old",
      client: "Client",
      ticket: "Ticket",
      queue: "Queue",
      owner: "Owner",
      status: "Status",
      waitingFor: "Waiting for",
      situation: "Situation"
    },
    filters: {
      all: "All",
      breached: "Breached",
      old: "Old",
      waiting: "No reply"
    },
    empty: "Nothing here.",
    noQueue: "No queue",
    noOwner: "No owner",
    group: "Group",
    answered: "Answered",
    status: {
      open: "In service",
      pending: "Waiting"
    },
    situation: {
      ok: "On time",
      breached: "Breached",
      old: "+{{hours}} h"
    },
    badge: "SLA",
    badgeTooltip: "SLA breached: client waiting for a reply for {{time}}"
  },
  settings: {
    credentials: {
      aiKey: "AI key",
      loading: "Checking configuration…",
      unavailable: "Unable to check the configuration.",
      configured: "Key configured. The saved value is never displayed.",
      notConfigured: "No key configured.",
      migrationPending:
        "The old key is awaiting migration to protected storage.",
      storageUnavailable:
        "Protected storage must be configured on the server before saving a key.",
      save: "Save new key",
      remove: "Remove key",
      confirmRemove: "Confirm removal",
      removeWarning:
        "Audio transcription using this key will be unavailable until a new key is added. Local removal does not revoke the key with the provider.",
      cancel: "Cancel",
      migrate: "Protect existing key",
      saved: "Configuration updated.",
      requestError: "Unable to update or check the key. Please try again."
    },
    closeReason: {
      group: "Closing tickets",
      required: "Require a reason to close",
      requiredHelper:
        "Applies when an agent closes a ticket; groups and automatic closes are left out.",
      options: {
        disabled: "Not required",
        enabled: "Required"
      }
    },
    sla: {
      group: "SLA and client wallet",
      minutes: "SLA deadline (minutes without reply)",
      minutesHelper: "0 turns the SLA alert off",
      oldTicketHours: "Old ticket alert (hours)",
      oldTicketHoursHelper: "Highlights tickets open for longer; 0 turns it off"
    },
    wallet: {
      autoAssign: "Tickets of wallet contacts",
      options: {
        disabled: "Follow the normal flow (chatbot and queues)",
        enabled: "Send straight to the owner"
      }
    }
  },
  tagModal: {
    form: {
      kanban: "Use as a Kanban column",
      queuesHelp:
        "Without sectors the tag is for everyone. With sectors, only they see and use it."
    }
  },
  tags: {
    table: {
      kanban: "Kanban",
      queues: "Sectors",
      allQueues: "All sectors"
    }
  },
  tagPicker: {
    action: "Tag",
    title: "Tags",
    empty: "No tags for this sector."
  },
  contactFilters: {
    tags: "Tags",
    wallet: "Wallet",
    all: "All",
    mine: "My wallet",
    none: "No owner"
  },
  wallet: {
    owner: "Owner (wallet)",
    ownerHelper: "Attendant responsible for this client",
    none: "No owner",
    myWallet: "My wallet",
    emptyMine:
      "No contacts in your wallet. An administrator sets the owner of each contact.",
    empty: "No contacts found.",
    column: "Wallet"
  },
  customerPanel: {
    title: "Customer panel",
    wallet: "Wallet",
    noWallet: "No owner",
    queue: "Queue",
    noQueue: "No queue",
    attendant: "Attendant",
    noAttendant: "No attendant",
    sla: "SLA",
    waiting: "Waiting for {{time}}",
    limit: "Deadline of {{minutes}} min",
    answered: "Answered",
    tags: "Tags",
    noTags: "No tags",
    notes: "Notes",
    edit: "Edit contact"
  },
  layoutMode: {
    title: "Layout",
    workspace: "Workspace",
    foco: "Focus",
    painel: "Panel",
    menu: "Menu",
    systemTheme: "System theme",
    more: "More",
    goTo: "Go to",
    tickets: "Tickets",
    searchPlaceholder: "Search ticket, contact or action",
    noResults: "Nothing found.",
    darkMode: "Dark mode"
  },
  accessHours: {
    restrict: "Restrict access hours",
    helper:
      "Outside these hours sign-in is refused and the open session ends. Administrators are never blocked.",
    weekdaysLabel: "Allowed days",
    weekdays: {
      0: "Sun",
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat"
    },
    start: "Start",
    end: "End",
    noDays: "Pick at least one day."
  },
  recurrence: {
    label: "Repeat",
    endAt: "Repeat until (optional)",
    endAtHelper: "Empty repeats with no end date",
    column: "Repeats",
    options: {
      none: "Does not repeat",
      daily: "Every day",
      weekly: "Every week",
      monthly: "Every month",
      yearly: "Every year"
    }
  },
  chatPage: {
    people: "Team",
    search: "Search a person or conversation",
    conversations: "Conversations",
    contacts: "Contacts",
    nobody: "Nobody found.",
    newGroup: "New group",
    editGroup: "Edit group",
    deleteGroup: "Delete group",
    deleteWarning:
      "The group and all its messages will be deleted for every member. This cannot be undone, confirm?",
    groupName: "Group name",
    participants: "Participants",
    close: "Close",
    save: "Save",
    needTitle: "Fill in the group name.",
    needUsers: "Select at least one person.",
    back: "Back to the list",
    pick: "Pick a conversation or a person",
    pickHint: "Click someone in the list to start chatting.",
    teamHint: "Company conversations and people",
    teamConversations: "Team conversations",
    clearSearch: "Clear search",
    loadingConversations: "Loading conversations and people…",
    conversationsError:
      "Could not load the full list. Available conversations and people were kept.",
    retry: "Try again",
    noResults: "No matching conversation or person.",
    searchHint: "Try another name, email or text from the latest message.",
    emptyTeamHint: "People in your company will appear here.",
    emptyPreview: "No messages yet",
    unreadMessages: "{{count}} unread messages",
    messages: "Conversation messages",
    loadingMessages: "Loading messages…",
    messagesError:
      "Could not load messages. Messages already displayed were kept.",
    loadMore: "Load earlier messages",
    emptyMessages: "Start this conversation",
    emptyMessagesHint: "Send a message to coordinate work with your team.",
    unknownSender: "Participant",
    messageInput: "Internal message",
    send: "Send message",
    sending: "Sending message…",
    sendError: "Could not send. Check your connection and try again.",
    composerHint: "Enter sends · Shift+Enter adds a line break",
    attachFiles: "Attach files",
    sendFiles: "Send files",
    cancelFiles: "Cancel attachments",
    recordAudio: "Record audio",
    cancelRecording: "Cancel recording",
    sendRecording: "Send recording",
    messageImage: "Message image",
    playVideo: "Play video",
    pauseVideo: "Pause video",
    openMedia: "Expand media",
    download: "Download file"
  },
  dashboardPage: {
    hello: "Hi, {{name}}!",
    helloAnonymous: "Hi!",
    subtitle: "See how support is doing now and in the chosen period.",
    now: "Now",
    inPeriod: "In the period",
    team: "Team in the period",
    teamOnline: "Team online",
    waiting: "Waiting",
    inService: "In service",
    done: "Closed tickets",
    online: "Online",
    offline: "Offline",
    nobodyOnline: "Nobody online right now.",
    nobodyWaiting: "Nobody waiting. All caught up!",
    nobodyInService: "No ticket in progress.",
    more: "+ {{count}} other queues",
    periods: {
      p0: "Custom",
      p3: "3 days",
      p7: "7 days",
      p15: "15 days",
      p30: "30 days",
      p90: "90 days"
    }
  },
  onlineUsers: {
    title: "Users online",
    subtitle:
      "Who of the team is connected now and how much each one is handling.",
    updatedAt: "Updated at {{time}}",
    refresh: "Refresh",
    team: "Team",
    showOffline: "Show who is offline",
    nobody: "Nobody online right now.",
    noQueues: "No queues",
    onlineNow: "Online now",
    onlineFor: "Online for {{time}}",
    seenAgo: "Seen {{time}} ago",
    seenNow: "Just left",
    neverSeen: "Never signed in",
    situation: {
      online: "Online",
      outsideHours: "Outside access hours",
      offline: "Offline"
    },
    summary: {
      online: "Online",
      inService: "In service",
      idle: "Online without tickets",
      offline: "Offline",
      outsideHours: "Outside hours"
    },
    numbers: {
      openCount: "in service",
      pausedCount: "paused",
      closedToday: "closed today"
    }
  },
  walletBulk: {
    transferButton: "Move wallet",
    selectAll: "Select every contact of the list",
    selectOne: "Select {{name}}",
    selected: "{{count}} contact(s) selected",
    owner: "Owner",
    assign: "Set owner",
    remove: "Remove from wallet",
    cancel: "Cancel",
    done: "Wallet updated on {{count}} contact(s).",
    nothing: "No contact was changed.",
    groups: "{{count}} group(s) skipped: groups have no wallet.",
    transferTitle: "Move wallet",
    transferHint:
      "Every contact of one owner goes to another, for example when someone leaves the team.",
    from: "From",
    to: "To",
    fromCount: "{{count}} contact(s) in this wallet",
    noOwner: "Contacts without owner",
    nobody: "Nobody (remove from wallet)",
    same: "Pick a different owner",
    transfer: "Move"
  },
  metrics: {
    title: "Metrics",
    subtitle:
      "How the team handled the period: volume, times, deadline and reasons.",
    export: "Export CSV",
    period: "Period",
    days: "{{count}} days",
    custom: "Custom",
    from: "From",
    to: "To",
    queue: "Queue",
    user: "Attendant",
    allQueues: "All queues",
    allUsers: "All attendants",
    loading: "Loading...",
    nothing: "Nothing in the period.",
    noQueue: "No queue",
    noUser: "No attendant",
    noReason: "No reason",
    byDay: "Tickets per day",
    byQueue: "Per queue",
    byUser: "Per attendant",
    closeReasons: "Close reasons",
    heatmap: "Busiest hours (tickets opened)",
    heatCell: "{{day}} at {{hour}}h: {{count}}",
    weekdays: "Sun,Mon,Tue,Wed,Thu,Fri,Sat",
    kpi: {
      created: "Tickets",
      finished: "Closed",
      avgWait: "Average wait",
      avgService: "Average service",
      sla: "Answered in time",
      slaHint: "{{minutes}} min deadline",
      slaOff: "SLA deadline off",
      newContacts: "New contacts",
      rating: "Average rating",
      ratingHint: "{{count}} rating(s)"
    },
    cols: {
      queue: "Queue",
      user: "Attendant",
      created: "Tickets",
      finished: "Closed",
      avgWait: "Avg wait",
      avgService: "Avg service",
      sla: "In time",
      rating: "Rating",
      count: "Count"
    }
  },
  transferContext: {
    noteLabel: "Context for the sector (optional)",
    notePlaceholder:
      "E.g.: client wants a copy of the October invoice; tax id already checked.",
    noteHint:
      "Internal note: the receiving sector sees it in the conversation. The client does not get it.",
    pickTitle: "Highlight messages in the note",
    us: "Us",
    client: "Client"
  },
  history: {
    previousTicket: "Previous ticket #{{id}}",
    currentTicket: "Current ticket #{{id}}",
    transferNote: "Transfer note",
    transferFromTo: "{{from}} → {{to}}",
    internalOnly: "visible to the team only"
  },
  clients: {
    title: "Clients",
    talk: "Talk",
    talkTo: "{{number}} · open conversation",
    syncSetting: "WhatsApp address book in Contacts",
    syncEnabled: "Import automatically",
    syncDisabled: "Do not import",
    syncHelper:
      "Contacts of the connected WhatsApp address book are added to Contacts, without renaming existing ones."
  },
  about: {
    licensesourcecode: "Source code of this version",
    basedOnTicketz: "Based on Ticketz (original code)"
  },
  tickets: {
    filters: {
      button: "Filters",
      title: "Filter tickets",
      connections: "Connection",
      attendants: "Attendant",
      tags: "Tags (all of them)",
      period: "Opened between",
      from: "From",
      to: "To",
      wallet: "Wallet",
      wallet_all: "All",
      wallet_mine: "My wallet",
      wallet_none: "No owner",
      unread: "Only with unread messages",
      sla: "Only breached SLA ({{minutes}} min deadline)",
      slaOff: "Only breached SLA (deadline off)",
      clear: "Clear",
      apply: "Apply"
    },
    bulk: {
      tag: "Tag",
      tagTitle: "Tag {{count}} ticket(s)",
      tagHelp: "The chosen tags are added to the ones the ticket already has.",
      tagConfirm: "Apply tags",
      select: "Select",
      selected: "{{count}} selected",
      all: "Select all ({{count}})",
      none: "Clear",
      accept: "Accept",
      acceptSome: "Accept {{count}}",
      transfer: "Transfer",
      close: "Close",
      cancel: "Cancel",
      transferTitle: "Transfer tickets",
      queue: "Queue",
      user: "Attendant",
      userHint: "Without an attendant they go back to the queue, waiting.",
      noUser: "No attendant (waiting)",
      closeTitle: "Close {{count}} ticket(s)",
      closeHint:
        "The reason and note apply to all of them. Clients do not get the rating survey.",
      done: "{{count}} ticket(s) updated.",
      failed:
        "{{count}} could not be changed (status changed or no permission)."
    },
    views: {
      label: "Ticket views",
      mine: "Mine",
      inService: "In service",
      waiting: "Waiting",
      queues: "Queue:"
    },
    tabs: {
      paused: { title: "Paused" }
    },
    paused: {
      badge: "Paused"
    }
  },
  messagesList: {
    header: {
      buttons: {
        pause: "Pause ticket",
        resume: "Resume",
        transfer: "Transfer",
        finish: "Close"
      }
    }
  },
  messagesInput: {
    placeholderPaused: "Ticket paused. Click Resume to reply."
  },
  closeReasons: {
    title: "Close reasons",
    add: "New reason",
    hint: "Agents pick one of these reasons when they close a ticket. The count shows tickets closed in the last {{days}} days.",
    empty: "No reasons yet.",
    onlyAdmin: "Only administrators can manage close reasons.",
    withoutReason: "Closed without a reason",
    edit: "Edit",
    delete: "Delete",
    table: {
      name: "Reason",
      usage: "Use in the last {{days}} days",
      active: "Active",
      actions: "Actions"
    },
    dialog: {
      addTitle: "New close reason",
      editTitle: "Edit reason",
      name: "Reason name",
      cancel: "Cancel",
      save: "Save"
    },
    confirmDelete: {
      title: "Delete the reason {{name}}?",
      message:
        "Tickets already closed with it will count as closed without a reason. To keep the history, deactivate it instead."
    },
    modal: {
      title: "Close ticket",
      subtitle:
        "Choose the reason for closing the conversation with {{contact}}.",
      noReasons:
        "No active reasons. Ask an administrator to add them under Close reasons.",
      reason: "Reason",
      note: "Note (optional)",
      cancel: "Cancel",
      confirm: "Close ticket"
    }
  },
  scheduleExtras: {
    contacts: "Contacts",
    tag: "Or every contact of a tag",
    noTag: "No tag",
    recipientsHelper:
      "The same message is scheduled for each contact. Contacts and tag add up, without repeats, up to 500 at a time.",
    required: "Choose at least one contact or tag.",
    businessDays: "Send on business days only",
    businessDaysHelper:
      "If it falls on a weekend or holiday, it goes on the next business day at the same time.",
    attach: "Attach file",
    attaching: "Uploading file…",
    attachmentHelper: "The file is sent with the message.",
    created: "{{count}} schedules created.",
    attachmentTooltip: "Attachment: {{name}}",
    businessDaysTooltip: "Business days only"
  },
  backendErrors: {
    ERR_NO_CHAT_FOUND: "Conversation not found or unavailable.",
    ERR_CHAT_DIRECT_READONLY:
      "Direct conversations cannot be edited or deleted.",
    ERR_INVALID_CHAT_USER: "Select valid participants from your company.",
    ERR_INVALID_CHAT_TITLE: "Enter a valid group name.",
    ERR_INVALID_CHAT_PAGE: "Invalid chat page.",
    ERR_INVALID_CHAT_MESSAGE: "Invalid message.",
    ERR_BULK_NO_TAGS: "Pick at least one tag (20 at most).",
    ERR_INVALID_TAG_FILTER: "Invalid tag filter.",
    ERR_TICKET_PAUSE_NOT_OPEN: "Only an ongoing ticket can be paused.",
    ERR_CLOSE_REASON_REQUIRED: "Choose a reason to close the ticket.",
    ERR_CLOSE_REASON_NOT_FOUND: "Close reason not found or inactive.",
    ERR_CLOSE_REASON_DUPLICATED: "A reason with this name already exists.",
    ERR_CLOSE_REASON_INVALID_NAME:
      "The reason name must have 2 to 120 characters.",
    ERR_INVALID_SCHEDULE_MEDIA:
      "Invalid schedule attachment. Upload the file again.",
    ERR_SCHEDULE_NO_RECIPIENTS: "Choose at least one contact or tag.",
    ERR_SCHEDULE_TOO_MANY_RECIPIENTS:
      "A schedule can have at most 500 contacts.",
    ERR_NO_TAG_FOUND: "Tag not found.",
    ERR_NO_FILE: "No file uploaded.",
    ERR_OUT_OF_ACCESS_HOURS:
      "Your user has no access at this time. Please talk to the administrator.",
    ERR_INVALID_ACCESS_HOURS:
      "Invalid access hours: pick at least one day and different start and end times.",
    ERR_KANBAN_TAG_NOT_FOUND: "This tag is not a Kanban column.",
    ERR_INVALID_KANBAN_MOVE: "Invalid Kanban move.",
    ERR_WALLET_GROUP_CONTACT: "Groups cannot have a wallet owner.",
    ERR_INVALID_RECURRENCE: "Invalid repetition.",
    ERR_INVALID_RECURRENCE_END:
      "The end date of the repetition must be after the first send."
  }
};

const es = {
  login: {
    welcome: "Inicie sesión en su cuenta",
    welcomeSubtitle:
      "Use el correo y la contraseña registrados por el administrador.",
    noAccount: "¿Aún no tiene cuenta?",
    darkMode: "Usar tema oscuro",
    lightMode: "Usar tema claro",
    hero: {
      title: "Toda la atención de WhatsApp en un solo lugar.",
      subtitle:
        "Colas, cartera de clientes, Kanban y plazos de respuesta para que todo el equipo atienda desde el mismo número.",
      points: {
        sla: "Panel de SLA",
        wallet: "Cartera de clientes",
        kanban: "Kanban por etiquetas"
      },
      preview: {
        client1: "Cliente Modelo",
        message1: "¡Buen día! ¿Me envía la boleta?",
        chipSla: "SLA",
        client2: "Panadería Avenida",
        message2: "Acabo de enviar los documentos.",
        chipWallet: "Cartera",
        client3: "Tienda Ficticia",
        message3: "De acuerdo, espero su respuesta.",
        chipKanban: "En análisis"
      }
    }
  },
  mainDrawer: {
    collapseMenu: "Contraer menú",
    expandMenu: "Expandir menú",
    listItems: {
      kanban: "Kanban",
      sla: "Panel de SLA",
      metrics: "Métricas",
      onlineUsers: "Usuarios en línea",
      closeReasons: "Motivos de cierre"
    }
  },
  kanban: {
    title: "Kanban",
    refresh: "Actualizar",
    manageTags: "Gestionar etiquetas",
    noKanbanTags:
      "Ninguna etiqueta es columna del Kanban. En Etiquetas, edite una etiqueta y active “Usar como columna del Kanban”.",
    truncated:
      "Hay muchas atenciones abiertas; el tablero muestra las 500 actualizadas más recientemente.",
    openLane: "Abiertas",
    emptyLane: "Arrastre atenciones aquí",
    moveTo: "Mover a",
    openTicket: "Abrir atención",
    noAttendant: "Sin agente"
  },
  sla: {
    title: "Panel de SLA",
    refresh: "Actualizar",
    configSummary:
      "Plazo de respuesta: {{sla}} · Alerta de antiguas: {{hours}} h",
    updatedAt: "actualizado a las",
    disabled:
      "El plazo de SLA aún no fue definido, por eso ninguna atención aparece como vencida.",
    goToSettings: "Definir plazo",
    cards: {
      total: "Abiertas",
      pending: "En espera",
      open: "En atención",
      breached: "SLA vencido",
      old: "Abiertas hace +{{hours}} h",
      waitingClients: "Clientes sin respuesta",
      groups: "Grupos abiertos",
      waitingGroups: "Grupos sin respuesta"
    },
    byQueue: "Abiertas por cola",
    byUser: "Abiertas por agente",
    tickets: "Atenciones",
    table: {
      name: "Nombre",
      open: "Abiertas",
      waiting: "Sin respuesta",
      breached: "Vencidas",
      old: "Antiguas",
      client: "Cliente",
      ticket: "Ticket",
      queue: "Cola",
      owner: "Responsable",
      status: "Estado",
      waitingFor: "Esperando hace",
      situation: "Situación"
    },
    filters: {
      all: "Todas",
      breached: "Vencidas",
      old: "Antiguas",
      waiting: "Sin respuesta"
    },
    empty: "Nada por aquí.",
    noQueue: "Sin cola",
    noOwner: "Sin responsable",
    group: "Grupo",
    answered: "Respondida",
    status: {
      open: "En atención",
      pending: "En espera"
    },
    situation: {
      ok: "En plazo",
      breached: "Vencida",
      old: "+{{hours}} h"
    },
    badge: "SLA",
    badgeTooltip: "SLA vencido: cliente esperando respuesta hace {{time}}"
  },
  settings: {
    credentials: {
      aiKey: "Clave de IA",
      loading: "Consultando configuración…",
      unavailable: "No se pudo consultar la configuración.",
      configured: "Clave configurada. El valor guardado no se muestra.",
      notConfigured: "Ninguna clave configurada.",
      migrationPending:
        "La clave anterior está pendiente de migración al almacenamiento protegido.",
      storageUnavailable:
        "El almacenamiento protegido debe configurarse en el servidor antes de guardar una clave.",
      save: "Guardar nueva clave",
      remove: "Eliminar clave",
      confirmRemove: "Confirmar eliminación",
      removeWarning:
        "La transcripción de audio que usa esta clave no estará disponible hasta que se registre una nueva. La eliminación local no revoca la clave en el proveedor.",
      cancel: "Cancelar",
      migrate: "Proteger clave existente",
      saved: "Configuración actualizada.",
      requestError:
        "No se pudo actualizar o consultar la clave. Inténtalo de nuevo."
    },
    closeReason: {
      group: "Cierre de atenciones",
      required: "Exigir motivo al cerrar",
      requiredHelper:
        "Vale cuando un agente cierra; los grupos y los cierres automáticos quedan fuera.",
      options: {
        disabled: "No exigir",
        enabled: "Exigir"
      }
    },
    sla: {
      group: "SLA y cartera de clientes",
      minutes: "Plazo de SLA (minutos sin respuesta)",
      minutesHelper: "0 desactiva la alerta de SLA",
      oldTicketHours: "Alerta de antiguas (horas)",
      oldTicketHoursHelper:
        "Destaca atenciones abiertas hace más tiempo; 0 desactiva"
    },
    wallet: {
      autoAssign: "Atención de contactos de la cartera",
      options: {
        disabled: "Seguir el flujo normal (chatbot y colas)",
        enabled: "Enviar directo al responsable"
      }
    }
  },
  tagModal: {
    form: {
      kanban: "Usar como columna del Kanban",
      queuesHelp:
        "Sin sector, la etiqueta vale para todos. Con sectores, solo ellos la ven y la usan."
    }
  },
  tags: {
    table: {
      kanban: "Kanban",
      queues: "Sectores",
      allQueues: "Todos los sectores"
    }
  },
  tagPicker: {
    action: "Etiquetar",
    title: "Etiquetas",
    empty: "Ninguna etiqueta para este sector."
  },
  contactFilters: {
    tags: "Etiquetas",
    wallet: "Cartera",
    all: "Todos",
    mine: "Mi cartera",
    none: "Sin responsable"
  },
  wallet: {
    owner: "Responsable (cartera)",
    ownerHelper: "Agente responsable de este cliente",
    none: "Sin responsable",
    myWallet: "Mi cartera",
    emptyMine:
      "Ningún contacto en tu cartera. El administrador define el responsable de cada contacto.",
    empty: "No se encontraron contactos.",
    column: "Cartera"
  },
  customerPanel: {
    title: "Panel del cliente",
    wallet: "Cartera",
    noWallet: "Sin responsable",
    queue: "Cola",
    noQueue: "Sin cola",
    attendant: "Atendente",
    noAttendant: "Sin atendente",
    sla: "SLA",
    waiting: "Esperando hace {{time}}",
    limit: "Plazo de {{minutes}} min",
    answered: "Respondido",
    tags: "Etiquetas",
    noTags: "Sin etiquetas",
    notes: "Notas",
    edit: "Editar contacto"
  },
  layoutMode: {
    title: "Diseño",
    workspace: "Workspace",
    foco: "Foco",
    painel: "Panel",
    menu: "Menú",
    systemTheme: "Tema del sistema",
    more: "Más",
    goTo: "Ir a",
    tickets: "Atenciones",
    searchPlaceholder: "Buscar atención, contacto o acción",
    noResults: "No se encontró nada.",
    darkMode: "Modo oscuro"
  },
  accessHours: {
    restrict: "Restringir horario de acceso",
    helper:
      "Fuera del horario se rechaza el inicio de sesión y la sesión abierta termina. Los administradores no se bloquean.",
    weekdaysLabel: "Días permitidos",
    weekdays: {
      0: "Dom",
      1: "Lun",
      2: "Mar",
      3: "Mié",
      4: "Jue",
      5: "Vie",
      6: "Sáb"
    },
    start: "Inicio",
    end: "Fin",
    noDays: "Elija al menos un día."
  },
  recurrence: {
    label: "Repetir",
    endAt: "Repetir hasta (opcional)",
    endAtHelper: "En blanco repite sin fecha final",
    column: "Repetición",
    options: {
      none: "No se repite",
      daily: "Todos los días",
      weekly: "Todas las semanas",
      monthly: "Todos los meses",
      yearly: "Todos los años"
    }
  },
  chatPage: {
    people: "Equipo",
    search: "Buscar persona o conversación",
    conversations: "Conversaciones",
    contacts: "Contactos",
    nobody: "No se encontró a nadie.",
    newGroup: "Nuevo grupo",
    editGroup: "Editar grupo",
    deleteGroup: "Eliminar grupo",
    deleteWarning:
      "El grupo y todos sus mensajes se borrarán para todos los participantes. Esta acción no se puede revertir, ¿confirmar?",
    groupName: "Nombre del grupo",
    participants: "Participantes",
    close: "Cerrar",
    save: "Guardar",
    needTitle: "Complete el nombre del grupo.",
    needUsers: "Seleccione al menos una persona.",
    back: "Volver a la lista",
    pick: "Elija una conversación o una persona",
    pickHint: "Haga clic en alguien de la lista para empezar a conversar.",
    teamHint: "Conversaciones y personas de la empresa",
    teamConversations: "Conversaciones del equipo",
    clearSearch: "Limpiar búsqueda",
    loadingConversations: "Cargando conversaciones y personas…",
    conversationsError:
      "No se pudo cargar toda la lista. Se conservaron las conversaciones y personas disponibles.",
    retry: "Intentar de nuevo",
    noResults: "No se encontró una conversación o persona.",
    searchHint: "Pruebe otro nombre, correo o texto del último mensaje.",
    emptyTeamHint: "Las personas de su empresa aparecerán aquí.",
    emptyPreview: "Conversación sin mensajes",
    unreadMessages: "{{count}} mensajes sin leer",
    messages: "Mensajes de la conversación",
    loadingMessages: "Cargando mensajes…",
    messagesError:
      "No se pudieron cargar los mensajes. Se conservaron los mensajes ya mostrados.",
    loadMore: "Cargar mensajes anteriores",
    emptyMessages: "Empiece esta conversación",
    emptyMessagesHint:
      "Envíe un mensaje para coordinar el trabajo con el equipo.",
    unknownSender: "Participante",
    messageInput: "Mensaje interno",
    send: "Enviar mensaje",
    sending: "Enviando mensaje…",
    sendError: "No se pudo enviar. Revise la conexión e intente de nuevo.",
    composerHint: "Enter envía · Shift+Enter añade un salto de línea",
    attachFiles: "Adjuntar archivos",
    sendFiles: "Enviar archivos",
    cancelFiles: "Cancelar adjuntos",
    recordAudio: "Grabar audio",
    cancelRecording: "Cancelar grabación",
    sendRecording: "Enviar grabación",
    messageImage: "Imagen del mensaje",
    playVideo: "Reproducir vídeo",
    pauseVideo: "Pausar vídeo",
    openMedia: "Ampliar multimedia",
    download: "Descargar archivo"
  },
  dashboardPage: {
    hello: "¡Hola, {{name}}!",
    helloAnonymous: "¡Hola!",
    subtitle: "Vea cómo está la atención ahora y en el período elegido.",
    now: "Ahora",
    inPeriod: "En el período",
    team: "Equipo en el período",
    teamOnline: "Equipo en línea",
    waiting: "Esperando atención",
    inService: "En atención",
    done: "Atenciones finalizadas",
    online: "En línea",
    offline: "Desconectado",
    nobodyOnline: "Nadie en línea ahora.",
    nobodyWaiting: "Nadie esperando. ¡Todo al día!",
    nobodyInService: "Ninguna atención en curso.",
    more: "+ {{count}} otras colas",
    periods: {
      p0: "Personalizado",
      p3: "3 días",
      p7: "7 días",
      p15: "15 días",
      p30: "30 días",
      p90: "90 días"
    }
  },
  onlineUsers: {
    title: "Usuarios en línea",
    subtitle: "Quién del equipo está conectado ahora y cuánto tiene cada uno.",
    updatedAt: "Actualizado a las {{time}}",
    refresh: "Actualizar",
    team: "Equipo",
    showOffline: "Mostrar quién está desconectado",
    nobody: "Nadie en línea ahora.",
    noQueues: "Sin colas",
    onlineNow: "En línea ahora",
    onlineFor: "En línea hace {{time}}",
    seenAgo: "Visto hace {{time}}",
    seenNow: "Acaba de salir",
    neverSeen: "Nunca entró",
    situation: {
      online: "En línea",
      outsideHours: "Fuera del horario de acceso",
      offline: "Desconectado"
    },
    summary: {
      online: "En línea",
      inService: "En atención",
      idle: "En línea sin atenciones",
      offline: "Desconectado",
      outsideHours: "Fuera del horario"
    },
    numbers: {
      openCount: "en atención",
      pausedCount: "pausadas",
      closedToday: "finalizadas hoy"
    }
  },
  walletBulk: {
    transferButton: "Transferir cartera",
    selectAll: "Marcar todos los contactos de la lista",
    selectOne: "Marcar {{name}}",
    selected: "{{count}} contacto(s) marcado(s)",
    owner: "Responsable",
    assign: "Definir responsable",
    remove: "Quitar de la cartera",
    cancel: "Cancelar",
    done: "Cartera actualizada en {{count}} contacto(s).",
    nothing: "Ningún contacto fue cambiado.",
    groups: "{{count}} grupo(s) ignorado(s): los grupos no tienen cartera.",
    transferTitle: "Transferir cartera",
    transferHint:
      "Todos los contactos de un responsable pasan a otro, por ejemplo cuando alguien deja el equipo.",
    from: "De",
    to: "Para",
    fromCount: "{{count}} contacto(s) en esta cartera",
    noOwner: "Contactos sin responsable",
    nobody: "Nadie (quitar de la cartera)",
    same: "Elija un responsable diferente",
    transfer: "Transferir"
  },
  metrics: {
    title: "Métricas",
    subtitle:
      "Cómo atendió el equipo en el período: volumen, tiempos, plazo y motivos.",
    export: "Exportar CSV",
    period: "Período",
    days: "{{count}} días",
    custom: "Personalizado",
    from: "Desde",
    to: "Hasta",
    queue: "Cola",
    user: "Atendente",
    allQueues: "Todas las colas",
    allUsers: "Todos los atendentes",
    loading: "Cargando...",
    nothing: "Nada en el período.",
    noQueue: "Sin cola",
    noUser: "Sin atendente",
    noReason: "Sin motivo",
    byDay: "Atenciones por día",
    byQueue: "Por cola",
    byUser: "Por atendente",
    closeReasons: "Motivos de finalización",
    heatmap: "Horarios de mayor movimiento (atenciones abiertas)",
    heatCell: "{{day}} a las {{hour}}h: {{count}}",
    weekdays: "Dom,Lun,Mar,Mié,Jue,Vie,Sáb",
    kpi: {
      created: "Atenciones",
      finished: "Finalizadas",
      avgWait: "Espera media",
      avgService: "Atención media",
      sla: "Respondidas en plazo",
      slaHint: "Plazo de {{minutes}} min",
      slaOff: "Plazo de SLA desactivado",
      newContacts: "Contactos nuevos",
      rating: "Nota media",
      ratingHint: "{{count}} evaluación(es)"
    },
    cols: {
      queue: "Cola",
      user: "Atendente",
      created: "Atenciones",
      finished: "Finalizadas",
      avgWait: "Espera media",
      avgService: "Atención media",
      sla: "En plazo",
      rating: "Nota",
      count: "Cantidad"
    }
  },
  transferContext: {
    noteLabel: "Contexto para el sector (opcional)",
    notePlaceholder:
      "Ej.: el cliente quiere la 2ª vía de la factura de octubre; ya verifiqué el CNPJ.",
    noteHint:
      "Nota interna: el sector que recibe la ve en la conversación. El cliente no la recibe.",
    pickTitle: "Destacar mensajes en la nota",
    us: "Nosotros",
    client: "Cliente"
  },
  history: {
    previousTicket: "Atención anterior #{{id}}",
    currentTicket: "Atención actual #{{id}}",
    transferNote: "Nota de transferencia",
    transferFromTo: "{{from}} → {{to}}",
    internalOnly: "visible solo para el equipo"
  },
  clients: {
    title: "Clientes",
    talk: "Conversar",
    talkTo: "{{number}} · abrir conversación",
    syncSetting: "Agenda de WhatsApp en Contactos",
    syncEnabled: "Importar automáticamente",
    syncDisabled: "No importar",
    syncHelper:
      "Los contactos de la agenda del WhatsApp conectado entran en Contactos, sin cambiar nombres ya registrados."
  },
  about: {
    licensesourcecode: "Código fuente de esta versión",
    basedOnTicketz: "Basado en Ticketz (código original)"
  },
  tickets: {
    filters: {
      button: "Filtros",
      title: "Filtrar atenciones",
      connections: "Conexión",
      attendants: "Atendente",
      tags: "Etiquetas (todas)",
      period: "Abierta entre",
      from: "Desde",
      to: "Hasta",
      wallet: "Cartera",
      wallet_all: "Todas",
      wallet_mine: "Mi cartera",
      wallet_none: "Sin responsable",
      unread: "Solo con mensajes no leídos",
      sla: "Solo SLA vencido (plazo de {{minutes}} min)",
      slaOff: "Solo SLA vencido (plazo desactivado)",
      clear: "Limpiar",
      apply: "Aplicar"
    },
    bulk: {
      tag: "Etiquetar",
      tagTitle: "Etiquetar {{count}} atención(es)",
      tagHelp:
        "Las etiquetas elegidas se suman a las que la atención ya tiene.",
      tagConfirm: "Aplicar etiquetas",
      select: "Seleccionar",
      selected: "{{count}} seleccionado(s)",
      all: "Marcar todos ({{count}})",
      none: "Desmarcar",
      accept: "Aceptar",
      acceptSome: "Aceptar {{count}}",
      transfer: "Transferir",
      close: "Finalizar",
      cancel: "Cancelar",
      transferTitle: "Transferir atenciones",
      queue: "Cola",
      user: "Atendente",
      userHint: "Sin atendente, vuelven a la cola, esperando.",
      noUser: "Sin atendente (esperando)",
      closeTitle: "Finalizar {{count}} atención(es)",
      closeHint:
        "El motivo y la observación valen para todas. Los clientes no reciben la encuesta de evaluación.",
      done: "{{count}} atención(es) actualizada(s).",
      failed:
        "{{count}} no se pudieron cambiar (la situación cambió o sin permiso)."
    },
    views: {
      label: "Vistas de atenciones",
      mine: "Míos",
      inService: "En atención",
      waiting: "En espera",
      queues: "Cola:"
    },
    tabs: {
      paused: { title: "Pausados" }
    },
    paused: {
      badge: "Pausado"
    }
  },
  messagesList: {
    header: {
      buttons: {
        pause: "Pausar atención",
        resume: "Retomar",
        transfer: "Transferir",
        finish: "Cerrar"
      }
    }
  },
  messagesInput: {
    placeholderPaused: "Atención pausada. Haga clic en Retomar para responder."
  },
  closeReasons: {
    title: "Motivos de cierre",
    add: "Nuevo motivo",
    hint: "El agente elige uno de estos motivos al cerrar. El conteo muestra las atenciones cerradas en los últimos {{days}} días.",
    empty: "Aún no hay motivos.",
    onlyAdmin: "Solo los administradores gestionan los motivos de cierre.",
    withoutReason: "Cerradas sin motivo",
    edit: "Editar",
    delete: "Eliminar",
    table: {
      name: "Motivo",
      usage: "Uso en los últimos {{days}} días",
      active: "Activo",
      actions: "Acciones"
    },
    dialog: {
      addTitle: "Nuevo motivo de cierre",
      editTitle: "Editar motivo",
      name: "Nombre del motivo",
      cancel: "Cancelar",
      save: "Guardar"
    },
    confirmDelete: {
      title: "¿Eliminar el motivo {{name}}?",
      message:
        "Las atenciones ya cerradas con él pasan a contar como sin motivo. Para conservar el historial, desactívelo en lugar de eliminarlo."
    },
    modal: {
      title: "Cerrar atención",
      subtitle: "Elija el motivo para cerrar la conversación con {{contact}}.",
      noReasons:
        "No hay motivos activos. Pida al administrador que los registre en Motivos de cierre.",
      reason: "Motivo",
      note: "Observación (opcional)",
      cancel: "Cancelar",
      confirm: "Cerrar"
    }
  },
  scheduleExtras: {
    contacts: "Contactos",
    tag: "O todos los contactos de una etiqueta",
    noTag: "Ninguna etiqueta",
    recipientsHelper:
      "El mismo mensaje se programa para cada contacto. Contactos y etiqueta se suman, sin repetir, hasta 500 por vez.",
    required: "Elija al menos un contacto o una etiqueta.",
    businessDays: "Enviar solo en día hábil",
    businessDaysHelper:
      "Si cae en fin de semana o feriado, sale el siguiente día hábil, a la misma hora.",
    attach: "Adjuntar archivo",
    attaching: "Enviando archivo…",
    attachmentHelper: "El archivo se envía junto con el mensaje.",
    created: "{{count}} programaciones creadas.",
    attachmentTooltip: "Adjunto: {{name}}",
    businessDaysTooltip: "Solo en día hábil"
  },
  backendErrors: {
    ERR_NO_CHAT_FOUND: "Conversación no encontrada o no disponible.",
    ERR_CHAT_DIRECT_READONLY:
      "Las conversaciones directas no se pueden editar ni eliminar.",
    ERR_INVALID_CHAT_USER: "Seleccione participantes válidos de su empresa.",
    ERR_INVALID_CHAT_TITLE: "Introduzca un nombre de grupo válido.",
    ERR_INVALID_CHAT_PAGE: "Página del chat no válida.",
    ERR_INVALID_CHAT_MESSAGE: "Mensaje no válido.",
    ERR_BULK_NO_TAGS: "Elija al menos una etiqueta (máximo 20).",
    ERR_INVALID_TAG_FILTER: "Filtro de etiquetas no válido.",
    ERR_TICKET_PAUSE_NOT_OPEN: "Solo se puede pausar una atención en curso.",
    ERR_CLOSE_REASON_REQUIRED: "Elija el motivo para cerrar la atención.",
    ERR_CLOSE_REASON_NOT_FOUND: "Motivo de cierre no encontrado o inactivo.",
    ERR_CLOSE_REASON_DUPLICATED: "Ya existe un motivo con ese nombre.",
    ERR_CLOSE_REASON_INVALID_NAME:
      "El nombre del motivo debe tener de 2 a 120 caracteres.",
    ERR_INVALID_SCHEDULE_MEDIA:
      "Adjunto de la programación inválido. Envíe el archivo de nuevo.",
    ERR_SCHEDULE_NO_RECIPIENTS: "Elija al menos un contacto o una etiqueta.",
    ERR_SCHEDULE_TOO_MANY_RECIPIENTS:
      "Una programación puede tener como máximo 500 contactos.",
    ERR_NO_TAG_FOUND: "Etiqueta no encontrada.",
    ERR_NO_FILE: "Ningún archivo enviado.",
    ERR_OUT_OF_ACCESS_HOURS:
      "Su usuario no tiene acceso en este horario. Hable con el administrador.",
    ERR_INVALID_ACCESS_HOURS:
      "Horario de acceso inválido: elija al menos un día y horas de inicio y fin diferentes.",
    ERR_KANBAN_TAG_NOT_FOUND: "Esta etiqueta no es una columna del Kanban.",
    ERR_INVALID_KANBAN_MOVE: "Movimiento inválido en el Kanban.",
    ERR_WALLET_GROUP_CONTACT:
      "Los grupos no pueden tener responsable de cartera.",
    ERR_INVALID_RECURRENCE: "Repetición inválida.",
    ERR_INVALID_RECURRENCE_END:
      "La fecha final de la repetición debe ser posterior al primer envío."
  }
};

// Zap Komunick: security screens (RF-016).
const securityMessages = {
  pt: {
    securityIp: {
      title: "IPs permitidos",
      subtitle:
        "Restrinja o acesso da empresa aos IPs ou redes informados. O superusuário da instalação mantém acesso.",
      enabled: "Restringir acesso aos IPs da lista",
      listLabel: "IPs e redes permitidos",
      listHelp:
        "Um IP (IPv4 ou IPv6) ou uma rede CIDR por linha. Até 100 entradas. Inclua seu IP para manter o acesso.",
      currentIp: "Seu IP atual: {{ip}}",
      unknownIp: "não identificado",
      addCurrent: "Adicionar meu IP",
      save: "Salvar",
      saving: "Salvando…",
      saved: "Lista de IPs permitidos salva.",
      loading: "Carregando configurações…",
      loadError: "Não foi possível carregar os IPs permitidos.",
      saveError: "Não foi possível salvar. Confira a lista e tente novamente.",
      retry: "Tentar novamente",
      onlyAdmin: "Somente administradores podem gerenciar os IPs permitidos."
    },
    audit: {
      title: "Auditoria",
      subtitle:
        "Consulte os acessos e as alterações de segurança e configurações da empresa.",
      from: "Data inicial",
      to: "Data final",
      user: "Usuário",
      action: "Ação",
      all: "Todos",
      apply: "Filtrar",
      clear: "Limpar",
      refresh: "Atualizar",
      loading: "Carregando registros…",
      loadError: "Não foi possível carregar a auditoria. Tente atualizar.",
      usersError:
        "Não foi possível carregar os usuários do filtro. Os outros filtros continuam disponíveis.",
      empty: "Nenhum registro encontrado para estes filtros.",
      invalidDates: "A data final deve ser igual ou posterior à inicial.",
      total: "Registros: {{count}}",
      previous: "Anterior",
      next: "Próxima",
      page: "Página {{page}}",
      details: "Detalhes",
      openDetails: "Ver detalhes do registro {{id}}",
      close: "Fechar",
      noUser: "Não identificado",
      userId: "Usuário #{{id}}",
      unavailable: "Não informado",
      noDetails: "Sem detalhes adicionais.",
      date: "Data e hora",
      ip: "IP",
      entity: "Registro afetado",
      userAgent: "Navegador",
      onlyAdmin: "Somente administradores podem consultar a auditoria.",
      families: {
        auth: "Acessos",
        security: "Segurança",
        user: "Usuários",
        setting: "Configurações"
      },
      entities: {
        user: "Usuário",
        company: "Empresa",
        setting: "Configuração"
      },
      actions: {
        auth_login: "Entrada na conta",
        auth_login_failed: "Tentativa de entrada recusada",
        auth_logout: "Saída da conta",
        auth_ip_blocked: "Acesso bloqueado por IP",
        auth_2fa_failed: "Verificação em duas etapas recusada",
        auth_impersonate: "Acesso por superusuário",
        security_2fa_enabled: "Verificação em duas etapas ativada",
        security_2fa_disabled: "Verificação em duas etapas desativada",
        security_2fa_reset: "Verificação em duas etapas redefinida",
        security_2fa_recovery_codes: "Códigos de recuperação renovados",
        security_ip_allowlist_updated: "IPs permitidos atualizados",
        user_created: "Usuário criado",
        user_updated: "Usuário alterado",
        user_deleted: "Usuário excluído",
        setting_updated: "Configuração alterada"
      }
    },
    usersTwoFactor: {
      column: "Verificação em duas etapas",
      enabled: "Ativada",
      disabled: "Desativada",
      unknown: "Não informado",
      reset: "Redefinir verificação em duas etapas",
      resetFor: "Redefinir verificação em duas etapas de {{name}}",
      resetTitle: "Redefinir verificação em duas etapas?",
      resetMessage:
        "A verificação em duas etapas de {{name}} será desativada e os códigos de recuperação deixarão de funcionar. A pessoa precisará configurá-la novamente em Segurança da conta.",
      cancel: "Cancelar",
      confirm: "Redefinir",
      resetting: "Redefinindo…",
      resetDone: "Verificação em duas etapas redefinida.",
      resetError: "Não foi possível redefinir. Tente novamente."
    },
    accountSecurity: {
      title: "Segurança da conta",
      loading: "Carregando segurança…",
      twoFactorTitle: "Verificação em duas etapas",
      description:
        "Proteja sua conta com um código do aplicativo autenticador, além da senha.",
      enabled: "Ativada",
      disabled: "Desativada",
      remaining: "Códigos de recuperação restantes: {{count}}",
      freshCode:
        "Use um novo código do aplicativo a cada confirmação. Códigos já utilizados não são aceitos.",
      start: "Configurar verificação em duas etapas",
      scan: "Leia este QR no seu aplicativo autenticador ou informe a chave manualmente.",
      qrLabel: "QR para configurar o autenticador",
      secret: "Chave de configuração",
      secretHelp:
        "Esta chave permite gerar códigos de acesso. Não compartilhe nem publique o QR.",
      code: "Código do autenticador",
      confirm: "Confirmar",
      cancel: "Cancelar",
      regenerate: "Gerar novos códigos de recuperação",
      disable: "Desativar verificação em duas etapas",
      disableHelp:
        "Confirme sua senha e um código do aplicativo ou de recuperação para desativar.",
      regenerateHelp:
        "Confirme com um código novo do aplicativo. Os códigos de recuperação anteriores serão invalidados.",
      password: "Senha atual",
      secondFactor: "Código do aplicativo ou de recuperação",
      recoveryTitle: "Guarde seus códigos de recuperação",
      recoveryHelp:
        "Cada código funciona uma vez. Eles são mostrados somente agora. Guarde em um local seguro antes de continuar.",
      download: "Baixar códigos",
      saved: "Guardei os códigos",
      requestError: "Não foi possível concluir a solicitação. Tente novamente.",
      retry: "Tentar novamente"
    },
    login2fa: {
      title: "Verificação em duas etapas",
      subtitle: "Confirme sua identidade para concluir o acesso.",
      code: "Código do autenticador",
      codeHelp: "Digite os 6 dígitos exibidos no seu aplicativo.",
      recoveryCode: "Código de recuperação",
      recoveryHelp:
        "Use um dos códigos salvos ao ativar a verificação. Cada código funciona uma vez.",
      verify: "Confirmar e entrar",
      verifying: "Verificando…",
      signingIn: "Entrando…",
      useRecovery: "Usar código de recuperação",
      useAuthenticator: "Usar aplicativo autenticador",
      back: "Voltar / trocar conta",
      expiresIn: "Esta verificação expira em {{time}}.",
      errors: {
        invalid: "Código inválido ou já utilizado. Confira e tente novamente.",
        expired:
          "A verificação expirou. Volte e entre com sua senha novamente.",
        locked:
          "Limite de tentativas atingido. Aguarde {{minutes}} minutos e entre novamente.",
        unavailable: "Não foi possível verificar o código. Tente novamente.",
        ip: "Este endereço IP não tem permissão para acessar.",
        hours: "O acesso não está permitido neste horário.",
        codeFormat: "Digite um código de 6 dígitos.",
        recoveryFormat: "Digite um código de recuperação completo (XXXX-XXXX)."
      }
    },
    backendErrors: {
      ERR_2FA_ALREADY_ENABLED: "A verificação em duas etapas já está ativada.",
      ERR_2FA_CHALLENGE_EXPIRED:
        "A verificação expirou. Entre com sua senha novamente.",
      ERR_2FA_INVALID_CODE:
        "Código inválido ou já utilizado. Aguarde um novo código e tente novamente.",
      ERR_2FA_NOT_ENABLED: "A verificação em duas etapas não está ativada.",
      ERR_2FA_NOT_STARTED: "Inicie a configuração do autenticador novamente.",
      ERR_2FA_TOO_MANY_ATTEMPTS:
        "Limite de tentativas atingido. Aguarde dez minutos.",
      ERR_2FA_USE_SELF_DISABLE:
        "Para sua própria conta, desative a verificação em Segurança da conta.",
      ERR_IP_ALLOWLIST_EMPTY:
        "Inclua ao menos um IP ou rede antes de ativar a restrição.",
      ERR_IP_ALLOWLIST_INVALID: "A lista contém um IP ou uma rede inválida.",
      ERR_IP_ALLOWLIST_LOCKOUT:
        "A lista precisa permitir seu IP atual para manter seu acesso.",
      ERR_IP_ALLOWLIST_TOO_MANY: "A lista permite no máximo 100 entradas.",
      ERR_IP_NOT_ALLOWED:
        "Este IP não tem permissão de acesso. Fale com o administrador.",
      ERR_AUDIT_INVALID_DATE: "Informe um período válido para a auditoria.",
      ERR_AUDIT_INVALID_FILTER: "Filtro de auditoria inválido.",
      ERR_USE_SECURITY_ROUTE:
        "Altere os IPs permitidos na página própria de segurança."
    }
  },
  en: {
    securityIp: {
      title: "Allowed IPs",
      subtitle:
        "Restrict company access to the listed IP addresses or networks. The installation superuser retains access.",
      enabled: "Restrict access to the listed IPs",
      listLabel: "Allowed IP addresses and networks",
      listHelp:
        "One IPv4 or IPv6 address or CIDR network per line. Up to 100 entries. Include your IP to keep access.",
      currentIp: "Your current IP: {{ip}}",
      unknownIp: "unidentified",
      addCurrent: "Add my IP",
      save: "Save",
      saving: "Saving…",
      saved: "Allowed IP list saved.",
      loading: "Loading settings…",
      loadError: "Could not load allowed IPs.",
      saveError: "Could not save. Check the list and try again.",
      retry: "Try again",
      onlyAdmin: "Only administrators can manage allowed IPs."
    },
    audit: {
      title: "Audit log",
      subtitle: "Review sign-ins and changes to company security and settings.",
      from: "Start date",
      to: "End date",
      user: "User",
      action: "Action",
      all: "All",
      apply: "Filter",
      clear: "Clear",
      refresh: "Refresh",
      loading: "Loading records…",
      loadError: "Could not load the audit log. Try refreshing.",
      usersError:
        "Could not load the user filter. The other filters are still available.",
      empty: "No records found for these filters.",
      invalidDates: "The end date must be on or after the start date.",
      total: "Records: {{count}}",
      previous: "Previous",
      next: "Next",
      page: "Page {{page}}",
      details: "Details",
      openDetails: "View details of record {{id}}",
      close: "Close",
      noUser: "Unidentified",
      userId: "User #{{id}}",
      unavailable: "Not provided",
      noDetails: "No additional details.",
      date: "Date and time",
      ip: "IP",
      entity: "Affected record",
      userAgent: "Browser",
      onlyAdmin: "Only administrators can view the audit log.",
      families: {
        auth: "Access",
        security: "Security",
        user: "Users",
        setting: "Settings"
      },
      entities: {
        user: "User",
        company: "Company",
        setting: "Setting"
      },
      actions: {
        auth_login: "Signed in",
        auth_login_failed: "Sign-in attempt rejected",
        auth_logout: "Signed out",
        auth_ip_blocked: "Access blocked by IP",
        auth_2fa_failed: "Two-factor verification rejected",
        auth_impersonate: "Superuser access",
        security_2fa_enabled: "Two-factor verification enabled",
        security_2fa_disabled: "Two-factor verification disabled",
        security_2fa_reset: "Two-factor verification reset",
        security_2fa_recovery_codes: "Recovery codes regenerated",
        security_ip_allowlist_updated: "Allowed IPs updated",
        user_created: "User created",
        user_updated: "User updated",
        user_deleted: "User deleted",
        setting_updated: "Setting updated"
      }
    },
    usersTwoFactor: {
      column: "Two-factor verification",
      enabled: "Enabled",
      disabled: "Disabled",
      unknown: "Not provided",
      reset: "Reset two-factor verification",
      resetFor: "Reset two-factor verification for {{name}}",
      resetTitle: "Reset two-factor verification?",
      resetMessage:
        "Two-factor verification for {{name}} will be disabled and their recovery codes will stop working. They will need to set it up again in Account security.",
      cancel: "Cancel",
      confirm: "Reset",
      resetting: "Resetting…",
      resetDone: "Two-factor verification reset.",
      resetError: "Could not reset two-factor verification. Try again."
    },
    accountSecurity: {
      title: "Account security",
      loading: "Loading security…",
      twoFactorTitle: "Two-step verification",
      description:
        "Protect your account with an authenticator app code as well as your password.",
      enabled: "Enabled",
      disabled: "Disabled",
      remaining: "Recovery codes remaining: {{count}}",
      freshCode:
        "Use a new app code for each confirmation. Previously used codes are not accepted.",
      start: "Set up two-step verification",
      scan: "Scan this QR in your authenticator app or enter the key manually.",
      qrLabel: "QR for authenticator setup",
      secret: "Setup key",
      secretHelp:
        "This key can generate sign-in codes. Do not share it or publish the QR.",
      code: "Authenticator code",
      confirm: "Confirm",
      cancel: "Cancel",
      regenerate: "Generate new recovery codes",
      disable: "Disable two-step verification",
      disableHelp:
        "Confirm your password and an app or recovery code to disable verification.",
      regenerateHelp:
        "Confirm with a new app code. Previous recovery codes will be invalidated.",
      password: "Current password",
      secondFactor: "App or recovery code",
      recoveryTitle: "Save your recovery codes",
      recoveryHelp:
        "Each code works once. They are shown only now. Store them safely before continuing.",
      download: "Download codes",
      saved: "I saved the codes",
      requestError: "Could not complete the request. Please try again.",
      retry: "Try again"
    },
    login2fa: {
      title: "Two-step verification",
      subtitle: "Confirm your identity to finish signing in.",
      code: "Authenticator code",
      codeHelp: "Enter the 6 digits shown in your app.",
      recoveryCode: "Recovery code",
      recoveryHelp:
        "Use one of the codes saved when you enabled verification. Each code works once.",
      verify: "Verify and sign in",
      verifying: "Verifying…",
      signingIn: "Signing in…",
      useRecovery: "Use a recovery code",
      useAuthenticator: "Use authenticator app",
      back: "Back / switch account",
      expiresIn: "This verification expires in {{time}}.",
      errors: {
        invalid: "Invalid or already used code. Check it and try again.",
        expired:
          "Verification expired. Go back and sign in with your password again.",
        locked:
          "Too many attempts. Wait {{minutes}} minutes and sign in again.",
        unavailable: "Could not verify the code. Please try again.",
        ip: "This IP address is not allowed to sign in.",
        hours: "Sign-in is not allowed at this time.",
        codeFormat: "Enter a 6-digit code.",
        recoveryFormat: "Enter a complete recovery code (XXXX-XXXX)."
      }
    },
    backendErrors: {
      ERR_2FA_ALREADY_ENABLED: "Two-step verification is already enabled.",
      ERR_2FA_CHALLENGE_EXPIRED:
        "Verification expired. Sign in with your password again.",
      ERR_2FA_INVALID_CODE:
        "Invalid or already used code. Wait for a new code and try again.",
      ERR_2FA_NOT_ENABLED: "Two-step verification is not enabled.",
      ERR_2FA_NOT_STARTED: "Start authenticator setup again.",
      ERR_2FA_TOO_MANY_ATTEMPTS: "Too many attempts. Wait ten minutes.",
      ERR_2FA_USE_SELF_DISABLE:
        "Disable verification for your own account in Account security.",
      ERR_IP_ALLOWLIST_EMPTY:
        "Add at least one IP or network before enabling restrictions.",
      ERR_IP_ALLOWLIST_INVALID:
        "The list contains an invalid IP address or network.",
      ERR_IP_ALLOWLIST_LOCKOUT:
        "The list must allow your current IP to keep access.",
      ERR_IP_ALLOWLIST_TOO_MANY: "The list allows up to 100 entries.",
      ERR_IP_NOT_ALLOWED: "This IP is not allowed. Contact your administrator.",
      ERR_AUDIT_INVALID_DATE: "Enter a valid audit date range.",
      ERR_AUDIT_INVALID_FILTER: "Invalid audit filter.",
      ERR_USE_SECURITY_ROUTE:
        "Change allowed IPs on the dedicated security page."
    }
  },
  es: {
    securityIp: {
      title: "IP permitidas",
      subtitle:
        "Restrinja el acceso de la empresa a las direcciones IP o redes indicadas. El superusuario de la instalación conserva el acceso.",
      enabled: "Restringir el acceso a las IP de la lista",
      listLabel: "Direcciones IP y redes permitidas",
      listHelp:
        "Una dirección IPv4 o IPv6 o red CIDR por línea. Hasta 100 entradas. Incluya su IP para conservar el acceso.",
      currentIp: "Su IP actual: {{ip}}",
      unknownIp: "no identificada",
      addCurrent: "Añadir mi IP",
      save: "Guardar",
      saving: "Guardando…",
      saved: "Lista de IP permitidas guardada.",
      loading: "Cargando configuración…",
      loadError: "No se pudieron cargar las IP permitidas.",
      saveError: "No se pudo guardar. Revise la lista e inténtelo de nuevo.",
      retry: "Reintentar",
      onlyAdmin: "Solo los administradores pueden gestionar las IP permitidas."
    },
    audit: {
      title: "Auditoría",
      subtitle:
        "Consulte los accesos y los cambios de seguridad y configuración de la empresa.",
      from: "Fecha inicial",
      to: "Fecha final",
      user: "Usuario",
      action: "Acción",
      all: "Todos",
      apply: "Filtrar",
      clear: "Limpiar",
      refresh: "Actualizar",
      loading: "Cargando registros…",
      loadError: "No se pudo cargar la auditoría. Intente actualizar.",
      usersError:
        "No se pudieron cargar los usuarios del filtro. Los otros filtros siguen disponibles.",
      empty: "No se encontraron registros con estos filtros.",
      invalidDates: "La fecha final debe ser igual o posterior a la inicial.",
      total: "Registros: {{count}}",
      previous: "Anterior",
      next: "Siguiente",
      page: "Página {{page}}",
      details: "Detalles",
      openDetails: "Ver detalles del registro {{id}}",
      close: "Cerrar",
      noUser: "No identificado",
      userId: "Usuario #{{id}}",
      unavailable: "No informado",
      noDetails: "Sin detalles adicionales.",
      date: "Fecha y hora",
      ip: "IP",
      entity: "Registro afectado",
      userAgent: "Navegador",
      onlyAdmin: "Solo los administradores pueden consultar la auditoría.",
      families: {
        auth: "Accesos",
        security: "Seguridad",
        user: "Usuarios",
        setting: "Configuración"
      },
      entities: {
        user: "Usuario",
        company: "Empresa",
        setting: "Configuración"
      },
      actions: {
        auth_login: "Inicio de sesión",
        auth_login_failed: "Intento de acceso rechazado",
        auth_logout: "Cierre de sesión",
        auth_ip_blocked: "Acceso bloqueado por IP",
        auth_2fa_failed: "Verificación en dos pasos rechazada",
        auth_impersonate: "Acceso del superusuario",
        security_2fa_enabled: "Verificación en dos pasos activada",
        security_2fa_disabled: "Verificación en dos pasos desactivada",
        security_2fa_reset: "Verificación en dos pasos restablecida",
        security_2fa_recovery_codes: "Códigos de recuperación renovados",
        security_ip_allowlist_updated: "IP permitidas actualizadas",
        user_created: "Usuario creado",
        user_updated: "Usuario modificado",
        user_deleted: "Usuario eliminado",
        setting_updated: "Configuración modificada"
      }
    },
    usersTwoFactor: {
      column: "Verificación en dos pasos",
      enabled: "Activada",
      disabled: "Desactivada",
      unknown: "No informado",
      reset: "Restablecer verificación en dos pasos",
      resetFor: "Restablecer la verificación en dos pasos de {{name}}",
      resetTitle: "¿Restablecer la verificación en dos pasos?",
      resetMessage:
        "Se desactivará la verificación en dos pasos de {{name}} y sus códigos de recuperación dejarán de funcionar. La persona deberá configurarla de nuevo en Seguridad de la cuenta.",
      cancel: "Cancelar",
      confirm: "Restablecer",
      resetting: "Restableciendo…",
      resetDone: "Verificación en dos pasos restablecida.",
      resetError: "No se pudo restablecer. Inténtelo de nuevo."
    },
    accountSecurity: {
      title: "Seguridad de la cuenta",
      loading: "Cargando seguridad…",
      twoFactorTitle: "Verificación en dos pasos",
      description:
        "Protege tu cuenta con un código de la aplicación autenticadora, además de la contraseña.",
      enabled: "Activada",
      disabled: "Desactivada",
      remaining: "Códigos de recuperación restantes: {{count}}",
      freshCode:
        "Usa un código nuevo de la aplicación en cada confirmación. No se aceptan códigos ya utilizados.",
      start: "Configurar verificación en dos pasos",
      scan: "Escanea este QR con la aplicación autenticadora o introduce la clave manualmente.",
      qrLabel: "QR para configurar el autenticador",
      secret: "Clave de configuración",
      secretHelp:
        "Esta clave permite generar códigos de acceso. No la compartas ni publiques el QR.",
      code: "Código del autenticador",
      confirm: "Confirmar",
      cancel: "Cancelar",
      regenerate: "Generar nuevos códigos de recuperación",
      disable: "Desactivar verificación en dos pasos",
      disableHelp:
        "Confirma tu contraseña y un código de la aplicación o de recuperación para desactivarla.",
      regenerateHelp:
        "Confirma con un código nuevo de la aplicación. Se invalidarán los códigos de recuperación anteriores.",
      password: "Contraseña actual",
      secondFactor: "Código de la aplicación o de recuperación",
      recoveryTitle: "Guarda tus códigos de recuperación",
      recoveryHelp:
        "Cada código funciona una vez. Solo se muestran ahora. Guárdalos en un lugar seguro antes de continuar.",
      download: "Descargar códigos",
      saved: "He guardado los códigos",
      requestError: "No se pudo completar la solicitud. Inténtalo de nuevo.",
      retry: "Reintentar"
    },
    login2fa: {
      title: "Verificación en dos pasos",
      subtitle: "Confirma tu identidad para completar el acceso.",
      code: "Código del autenticador",
      codeHelp: "Introduce los 6 dígitos que aparecen en tu aplicación.",
      recoveryCode: "Código de recuperación",
      recoveryHelp:
        "Usa uno de los códigos guardados al activar la verificación. Cada código funciona una vez.",
      verify: "Verificar y entrar",
      verifying: "Verificando…",
      signingIn: "Entrando…",
      useRecovery: "Usar código de recuperación",
      useAuthenticator: "Usar aplicación autenticadora",
      back: "Volver / cambiar cuenta",
      expiresIn: "Esta verificación caduca en {{time}}.",
      errors: {
        invalid:
          "Código no válido o ya utilizado. Revísalo e inténtalo de nuevo.",
        expired:
          "La verificación ha caducado. Vuelve e introduce tu contraseña de nuevo.",
        locked:
          "Demasiados intentos. Espera {{minutes}} minutos e inicia sesión de nuevo.",
        unavailable: "No se pudo verificar el código. Inténtalo de nuevo.",
        ip: "Esta dirección IP no tiene permiso para acceder.",
        hours: "No se permite acceder en este horario.",
        codeFormat: "Introduce un código de 6 dígitos.",
        recoveryFormat:
          "Introduce un código de recuperación completo (XXXX-XXXX)."
      }
    },
    backendErrors: {
      ERR_2FA_ALREADY_ENABLED: "La verificación en dos pasos ya está activada.",
      ERR_2FA_CHALLENGE_EXPIRED:
        "La verificación ha caducado. Introduce tu contraseña de nuevo.",
      ERR_2FA_INVALID_CODE:
        "Código no válido o ya utilizado. Espera un código nuevo e inténtalo de nuevo.",
      ERR_2FA_NOT_ENABLED: "La verificación en dos pasos no está activada.",
      ERR_2FA_NOT_STARTED: "Inicia la configuración del autenticador de nuevo.",
      ERR_2FA_TOO_MANY_ATTEMPTS: "Demasiados intentos. Espera diez minutos.",
      ERR_2FA_USE_SELF_DISABLE:
        "Desactiva la verificación de tu propia cuenta en Seguridad de la cuenta.",
      ERR_IP_ALLOWLIST_EMPTY:
        "Añade al menos una IP o red antes de activar la restricción.",
      ERR_IP_ALLOWLIST_INVALID: "La lista contiene una IP o red no válida.",
      ERR_IP_ALLOWLIST_LOCKOUT:
        "La lista debe permitir tu IP actual para conservar el acceso.",
      ERR_IP_ALLOWLIST_TOO_MANY: "La lista permite un máximo de 100 entradas.",
      ERR_IP_NOT_ALLOWED:
        "Esta IP no tiene permiso de acceso. Contacta con el administrador.",
      ERR_AUDIT_INVALID_DATE: "Introduce un período válido para la auditoría.",
      ERR_AUDIT_INVALID_FILTER: "Filtro de auditoría no válido.",
      ERR_USE_SECURITY_ROUTE:
        "Modifica las IP permitidas en la página específica de seguridad."
    }
  }
};

[
  ["pt", pt],
  ["en", en],
  ["es", es]
].forEach(([language, target]) => {
  const { backendErrors, ...screens } = securityMessages[language];
  Object.assign(target, screens);
  Object.assign(target.backendErrors, backendErrors);
});

const credentialErrors = {
  pt: {
    ERR_INVALID_CREDENTIAL_KEY: "Identificador de credencial inválido.",
    ERR_INVALID_CREDENTIAL_VALUE: "Informe uma chave válida.",
    ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE:
      "O armazenamento protegido precisa ser configurado no servidor.",
    ERR_CREDENTIAL_DECRYPTION_FAILED:
      "Não foi possível abrir a credencial protegida. Contate o responsável pelo servidor.",
    ERR_CREDENTIAL_STORAGE_UNAVAILABLE:
      "O armazenamento de credenciais está indisponível. Tente novamente.",
    ERR_CREDENTIAL_MIGRATION_CONFLICT:
      "Há configurações diferentes para a mesma chave. O responsável precisa resolver o conflito antes da migração.",
    ERR_USE_CREDENTIALS_ROUTE:
      "Use o formulário específico de credenciais para alterar esta chave."
  },
  en: {
    ERR_INVALID_CREDENTIAL_KEY: "Invalid credential identifier.",
    ERR_INVALID_CREDENTIAL_VALUE: "Enter a valid key.",
    ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE:
      "Protected storage must be configured on the server.",
    ERR_CREDENTIAL_DECRYPTION_FAILED:
      "Unable to open the protected credential. Contact the server administrator.",
    ERR_CREDENTIAL_STORAGE_UNAVAILABLE:
      "Credential storage is unavailable. Please try again.",
    ERR_CREDENTIAL_MIGRATION_CONFLICT:
      "There are different values for the same key. An administrator must resolve the conflict before migration.",
    ERR_USE_CREDENTIALS_ROUTE:
      "Use the dedicated credential form to change this key."
  },
  es: {
    ERR_INVALID_CREDENTIAL_KEY: "Identificador de credencial no válido.",
    ERR_INVALID_CREDENTIAL_VALUE: "Introduce una clave válida.",
    ERR_CREDENTIALS_MASTER_KEY_UNAVAILABLE:
      "El almacenamiento protegido debe configurarse en el servidor.",
    ERR_CREDENTIAL_DECRYPTION_FAILED:
      "No se pudo abrir la credencial protegida. Contacta con el administrador del servidor.",
    ERR_CREDENTIAL_STORAGE_UNAVAILABLE:
      "El almacenamiento de credenciales no está disponible. Inténtalo de nuevo.",
    ERR_CREDENTIAL_MIGRATION_CONFLICT:
      "Hay valores diferentes para la misma clave. Un administrador debe resolver el conflicto antes de la migración.",
    ERR_USE_CREDENTIALS_ROUTE:
      "Usa el formulario específico de credenciales para modificar esta clave."
  }
};

[
  ["pt", pt],
  ["en", en],
  ["es", es]
].forEach(([language, target]) => {
  Object.assign(target.backendErrors, credentialErrors[language]);
});

// Zap Komunick P1: mock assistance always requires human review.
pt.assistant = {
  settingConflict:
    "Há configurações divergentes. O assistente permanece desativado; salve a opção desejada para regularizar.",
  composerDraft: "Rascunho da mensagem",
  button: "Assistente",
  open: "Abrir assistente deste atendimento",
  title: "Assistente deste atendimento",
  simulation: "Simulação",
  scope:
    "Usa somente as mensagens de texto deste atendimento. Não consulta notas, anexos ou sistemas externos.",
  reviewRequired:
    "Conteúdo simulado. Revise as referências e confirme as informações antes de usar. Nenhuma mensagem será enviada automaticamente.",
  summary: "Resumir atendimento",
  reply: "Sugerir resposta",
  draft: "Rascunho para revisão",
  useDraft: "Usar no rascunho",
  appendHint:
    "O texto será acrescentado ao rascunho atual. Revise antes de enviar.",
  cancel: "Cancelar",
  loading: "Processando solicitação…",
  references: "Mensagens de referência",
  noReferences: "Nenhuma mensagem de referência disponível.",
  partial:
    "Contexto parcial: somente parte das mensagens deste atendimento foi considerada.",
  insufficient:
    "As mensagens disponíveis não confirmam todas as informações necessárias. Confira com o cliente.",
  noMessages:
    "Não há mensagens de texto disponíveis para fundamentar a solicitação.",
  disabled: "O assistente está desabilitado para esta empresa ou ambiente.",
  contextChanged:
    "O atendimento mudou durante a solicitação. Gere uma nova versão.",
  invalidOutput: "O resultado recebido não pôde ser validado. Tente novamente.",
  unavailable: "O assistente está indisponível. Tente novamente mais tarde.",
  noPermission: "Você não tem acesso ao contexto deste atendimento.",
  requestError:
    "Não foi possível concluir a solicitação. Seu rascunho foi preservado.",
  timeout: "A solicitação demorou além do limite. Seu rascunho foi preservado.",
  composerBlocked: "Volte ao modo de mensagem de texto para usar a sugestão.",
  settingsTitle: "Assistente de resumo e rascunho (simulação)",
  settingsHint:
    "Disponibiliza o assistente simulado para esta empresa no ambiente autorizado. As sugestões exigem revisão humana e nunca são enviadas automaticamente.",
  settingError:
    "Não foi possível alterar o assistente. A configuração anterior foi preservada."
};
en.assistant = {
  settingConflict:
    "Conflicting settings exist. The assistant remains disabled; save the desired option to resolve them.",
  composerDraft: "Message draft",
  button: "Assistant",
  open: "Open assistant for this conversation",
  title: "Assistant for this conversation",
  simulation: "Simulation",
  scope:
    "Uses only text messages in this conversation. Notes, attachments and external systems are excluded.",
  reviewRequired:
    "Simulated content. Review the references and verify the information before use. No message is sent automatically.",
  summary: "Summarize conversation",
  reply: "Suggest a reply",
  draft: "Draft for review",
  useDraft: "Use in draft",
  appendHint:
    "Text will be added to your current draft. Review it before sending.",
  cancel: "Cancel",
  loading: "Processing request…",
  references: "Reference messages",
  noReferences: "No reference messages available.",
  partial:
    "Partial context: only some messages in this conversation were considered.",
  insufficient:
    "Available messages do not confirm all required information. Check with the customer.",
  noMessages: "No text messages are available to support this request.",
  disabled: "The assistant is disabled for this company or environment.",
  contextChanged:
    "The conversation changed during the request. Generate a new version.",
  invalidOutput:
    "The received result could not be validated. Please try again.",
  unavailable: "The assistant is unavailable. Please try again later.",
  noPermission: "You cannot access this conversation's context.",
  requestError: "The request could not be completed. Your draft was preserved.",
  timeout: "The request timed out. Your draft was preserved.",
  composerBlocked: "Return to text message mode to use the suggestion.",
  settingsTitle: "Summary and draft assistant (simulation)",
  settingsHint:
    "Enables the simulated assistant for this company in the authorized environment. Suggestions require human review and are never sent automatically.",
  settingError:
    "Unable to change the assistant. The previous setting was preserved."
};
es.assistant = {
  settingConflict:
    "Hay configuraciones distintas. El asistente sigue desactivado; guarda la opción deseada para resolverlas.",
  composerDraft: "Borrador del mensaje",
  button: "Asistente",
  open: "Abrir asistente de esta conversación",
  title: "Asistente de esta conversación",
  simulation: "Simulación",
  scope:
    "Solo usa mensajes de texto de esta conversación. No consulta notas, archivos ni sistemas externos.",
  reviewRequired:
    "Contenido simulado. Revisa las referencias y confirma la información antes de usarlo. Ningún mensaje se envía automáticamente.",
  summary: "Resumir conversación",
  reply: "Sugerir respuesta",
  draft: "Borrador para revisión",
  useDraft: "Usar en el borrador",
  appendHint:
    "El texto se añadirá al borrador actual. Revísalo antes de enviarlo.",
  cancel: "Cancelar",
  loading: "Procesando solicitud…",
  references: "Mensajes de referencia",
  noReferences: "No hay mensajes de referencia disponibles.",
  partial:
    "Contexto parcial: solo se consideró parte de los mensajes de esta conversación.",
  insufficient:
    "Los mensajes disponibles no confirman toda la información necesaria. Consulta con el cliente.",
  noMessages: "No hay mensajes de texto para fundamentar la solicitud.",
  disabled: "El asistente está desactivado para esta empresa o entorno.",
  contextChanged:
    "La conversación cambió durante la solicitud. Genera una nueva versión.",
  invalidOutput:
    "No se pudo validar el resultado recibido. Inténtalo de nuevo.",
  unavailable: "El asistente no está disponible. Inténtalo más tarde.",
  noPermission: "No tienes acceso al contexto de esta conversación.",
  requestError: "No se pudo completar la solicitud. Tu borrador se conservó.",
  timeout: "Se agotó el tiempo de la solicitud. Tu borrador se conservó.",
  composerBlocked:
    "Vuelve al modo de mensaje de texto para usar la sugerencia.",
  settingsTitle: "Asistente de resumen y borrador (simulación)",
  settingsHint:
    "Habilita el asistente simulado para esta empresa en el entorno autorizado. Las sugerencias requieren revisión humana y nunca se envían automáticamente.",
  settingError:
    "No se pudo cambiar el asistente. Se conservó la configuración anterior."
};

pt.acessorias = {
  button: "Acessórias",
  open: "Abrir Acessórias deste atendimento",
  title: "Acessórias deste atendimento",
  simulation: "Simulação",
  scope:
    "Dados fictícios locais. Esta consulta não comprova situação fiscal, cumprimento de obrigação ou prazo real. Nenhum dado é enviado ao Acessórias.",
  refreshLinks: "Atualizar vínculos",
  linkClient: "Vincular cliente",
  loading: "Consultando simulação…",
  noLinks: "Este contato ainda não tem clientes vinculados.",
  selectedClient: "Cliente vinculado",
  chooseClient: "Escolha um cliente vinculado",
  localLinks: "Vínculos locais do contato",
  catalog: "Catálogo simulado da empresa",
  linkNamed: "Vincular {{name}}",
  unlinkNamed: "Desvincular {{name}}",
  link: "Vincular",
  unlink: "Desvincular",
  alreadyLinked: "Já vinculado",
  registration: "Cadastro do cliente",
  pending: "Pendências simuladas",
  noPending: "Nenhuma pendência nesta simulação.",
  previous: "Página anterior",
  next: "Próxima página",
  page: "Página {{page}}",
  retry: "Tentar novamente",
  source: "Origem e atualização",
  updatedAt: "Atualizado em {{date}}",
  fetchedAt: "Consultado em {{date}}",
  stale:
    "Dados desatualizados: esta simulação usa uma versão antiga. Confirme as informações antes de usar.",
  close: "Fechar",
  cancelQuery: "Cancelar consulta",
  cancel: "Cancelar",
  confirmLinkTitle: "Confirmar vínculo local",
  confirmUnlinkTitle: "Confirmar desvinculação local",
  confirmLink: "Confirmar vínculo",
  confirmUnlink: "Confirmar desvinculação",
  localOnly:
    "Esta ação altera somente o vínculo local deste contato. Não modifica o cadastro nem as pendências no fornecedor.",
  disabled:
    "A consulta Acessórias está desabilitada para esta empresa ou ambiente.",
  permission: "Você não tem permissão para esta consulta ou ação.",
  notLinked:
    "O cliente não está mais vinculado a este contato. Atualize os vínculos.",
  notFound: "O cliente simulado não foi encontrado.",
  contextChanged:
    "O atendimento ou vínculo mudou durante a consulta. Atualize os vínculos.",
  functionalError:
    "A simulação informou uma falha na consulta. Nenhum resultado foi aproveitado.",
  invalidOutput: "O resultado recebido não pôde ser validado.",
  upstreamUnauthorized:
    "A simulação de autorização do fornecedor recusou a consulta.",
  rateLimited:
    "A simulação atingiu o limite de consultas. Tente novamente mais tarde.",
  timeout:
    "A consulta demorou além do limite. Nenhum resultado foi aproveitado.",
  unavailable:
    "A consulta simulada está indisponível. Tente novamente mais tarde.",
  requestError:
    "Não foi possível concluir a consulta. Nenhum resultado anterior será apresentado como atualizado.",
  settingsTitle: "Consultas Acessórias (simulação)",
  settingsHint:
    "Habilita consultas fictícias e vínculos locais por empresa no ambiente autorizado. Não conecta o fornecedor nem habilita IA ou envio de mensagens.",
  settingError:
    "Não foi possível alterar a configuração. O valor anterior foi preservado.",
  settingConflict:
    "Há configurações divergentes. A consulta permanece desativada; salve a opção desejada para regularizar."
};
en.acessorias = {
  button: "Acessórias",
  open: "Open Acessórias for this conversation",
  title: "Acessórias for this conversation",
  simulation: "Simulation",
  scope:
    "Local fictitious data. This query does not confirm tax status, completed obligations or real deadlines. No data is sent to Acessórias.",
  refreshLinks: "Refresh links",
  linkClient: "Link client",
  loading: "Loading simulation…",
  noLinks: "This contact has no linked clients yet.",
  selectedClient: "Linked client",
  chooseClient: "Choose a linked client",
  localLinks: "Contact's local links",
  catalog: "Company's simulated catalog",
  linkNamed: "Link {{name}}",
  unlinkNamed: "Unlink {{name}}",
  link: "Link",
  unlink: "Unlink",
  alreadyLinked: "Already linked",
  registration: "Client registration",
  pending: "Simulated pending items",
  noPending: "No pending items in this simulation.",
  previous: "Previous page",
  next: "Next page",
  page: "Page {{page}}",
  retry: "Try again",
  source: "Source and freshness",
  updatedAt: "Updated on {{date}}",
  fetchedAt: "Retrieved on {{date}}",
  stale:
    "Outdated data: this simulation uses an old version. Verify the information before use.",
  close: "Close",
  cancelQuery: "Cancel query",
  cancel: "Cancel",
  confirmLinkTitle: "Confirm local link",
  confirmUnlinkTitle: "Confirm local unlink",
  confirmLink: "Confirm link",
  confirmUnlink: "Confirm unlink",
  localOnly:
    "This action only changes this contact's local link. It does not modify provider registration or pending items.",
  disabled: "Acessórias queries are disabled for this company or environment.",
  permission: "You do not have permission for this query or action.",
  notLinked:
    "This client is no longer linked to this contact. Refresh the links.",
  notFound: "The simulated client was not found.",
  contextChanged:
    "The conversation or link changed during the query. Refresh the links.",
  functionalError:
    "The simulation reported a query failure. No result was used.",
  invalidOutput: "The received result could not be validated.",
  upstreamUnauthorized:
    "The simulated provider authorization denied the query.",
  rateLimited: "The simulation reached its query limit. Try again later.",
  timeout: "The query timed out. No result was used.",
  unavailable: "The simulated query is unavailable. Try again later.",
  requestError:
    "The query could not be completed. Previous results will not be shown as up to date.",
  settingsTitle: "Acessórias queries (simulation)",
  settingsHint:
    "Enables fictitious queries and local links for this company in the authorized environment. It does not connect to the provider or enable AI or messaging.",
  settingError:
    "Unable to change the setting. The previous value was preserved.",
  settingConflict:
    "Conflicting settings exist. Queries remain disabled; save the desired option to resolve them."
};
es.acessorias = {
  button: "Acessórias",
  open: "Abrir Acessórias de esta conversación",
  title: "Acessórias de esta conversación",
  simulation: "Simulación",
  scope:
    "Datos ficticios locales. Esta consulta no confirma situación fiscal, obligaciones cumplidas ni plazos reales. No se envían datos a Acessórias.",
  refreshLinks: "Actualizar vínculos",
  linkClient: "Vincular cliente",
  loading: "Consultando simulación…",
  noLinks: "Este contacto aún no tiene clientes vinculados.",
  selectedClient: "Cliente vinculado",
  chooseClient: "Elige un cliente vinculado",
  localLinks: "Vínculos locales del contacto",
  catalog: "Catálogo simulado de la empresa",
  linkNamed: "Vincular {{name}}",
  unlinkNamed: "Desvincular {{name}}",
  link: "Vincular",
  unlink: "Desvincular",
  alreadyLinked: "Ya vinculado",
  registration: "Registro del cliente",
  pending: "Pendientes simulados",
  noPending: "No hay pendientes en esta simulación.",
  previous: "Página anterior",
  next: "Página siguiente",
  page: "Página {{page}}",
  retry: "Intentar de nuevo",
  source: "Origen y actualización",
  updatedAt: "Actualizado el {{date}}",
  fetchedAt: "Consultado el {{date}}",
  stale:
    "Datos desactualizados: esta simulación usa una versión antigua. Confirma la información antes de usarla.",
  close: "Cerrar",
  cancelQuery: "Cancelar consulta",
  cancel: "Cancelar",
  confirmLinkTitle: "Confirmar vínculo local",
  confirmUnlinkTitle: "Confirmar desvinculación local",
  confirmLink: "Confirmar vínculo",
  confirmUnlink: "Confirmar desvinculación",
  localOnly:
    "Esta acción solo cambia el vínculo local de este contacto. No modifica el registro ni los pendientes del proveedor.",
  disabled:
    "Las consultas Acessórias están desactivadas para esta empresa o entorno.",
  permission: "No tienes permiso para esta consulta o acción.",
  notLinked:
    "El cliente ya no está vinculado a este contacto. Actualiza los vínculos.",
  notFound: "No se encontró el cliente simulado.",
  contextChanged:
    "La conversación o el vínculo cambió durante la consulta. Actualiza los vínculos.",
  functionalError:
    "La simulación informó un fallo en la consulta. No se utilizó ningún resultado.",
  invalidOutput: "No se pudo validar el resultado recibido.",
  upstreamUnauthorized:
    "La autorización simulada del proveedor rechazó la consulta.",
  rateLimited:
    "La simulación alcanzó el límite de consultas. Inténtalo más tarde.",
  timeout: "Se agotó el tiempo de consulta. No se utilizó ningún resultado.",
  unavailable: "La consulta simulada no está disponible. Inténtalo más tarde.",
  requestError:
    "No se pudo completar la consulta. No se mostrarán datos anteriores como actualizados.",
  settingsTitle: "Consultas Acessórias (simulación)",
  settingsHint:
    "Habilita consultas ficticias y vínculos locales para esta empresa en el entorno autorizado. No conecta con el proveedor ni habilita IA o mensajes.",
  settingError:
    "No se pudo cambiar la configuración. Se conservó el valor anterior.",
  settingConflict:
    "Hay configuraciones distintas. La consulta sigue desactivada; guarda la opción deseada para resolverlas."
};

pt.attachments = {
  refresh: "Atualizar",
  open: "Arquivos",
  title: "Arquivos da conversa",
  file: "Arquivo",
  scope:
    "Arquivos disponíveis no contexto deste atendimento. A busca considera apenas os arquivos carregados.",
  filter: "Tipo de arquivo",
  search: "Buscar nos arquivos carregados",
  kinds: {
    all: "Todos",
    pdf: "PDFs",
    image: "Imagens",
    video: "Vídeos",
    other: "Outros arquivos"
  },
  loading: "Carregando arquivo…",
  empty: "Nenhum arquivo disponível.",
  noMatches: "Nenhum arquivo carregado corresponde à busca.",
  unknownSize: "Tamanho não informado",
  view: "Visualizar / baixar",
  viewNamed: "Visualizar {{name}}",
  viewPdf: "Visualizar PDF",
  viewImage: "Ampliar imagem",
  image: "Imagem da mensagem",
  video: "Vídeo da mensagem",
  sticker: "Figurinha",
  expand: "Ampliar vídeo",
  loadMore: "Carregar mais",
  retry: "Tentar novamente",
  close: "Fechar",
  closeViewer: "Fechar visualizador",
  previous: "Arquivo anterior",
  next: "Próximo arquivo",
  openOriginal: "Abrir original",
  download: "Baixar arquivo",
  zoomIn: "Aumentar zoom",
  zoomOut: "Diminuir zoom",
  rotateLeft: "Girar à esquerda",
  rotateRight: "Girar à direita",
  codec:
    "O navegador não conseguiu reproduzir este vídeo. Você pode baixar o arquivo pelo visualizador.",
  access: "Arquivo indisponível ou acesso não permitido. Atualize a conversa.",
  failed: "Não foi possível carregar este arquivo.",
  timeout: "O carregamento demorou demais. Feche e tente novamente.",
  tooLarge: "Este arquivo excede o limite de prévia de 25 MiB.",
  reason: {
    available: "Arquivo disponível.",
    too_large:
      "Arquivo maior que o limite de prévia de 25 MiB. Use Abrir original se desejar continuar.",
    unsupported:
      "Este tipo de arquivo não possui prévia. Use Abrir original se desejar continuar.",
    external: "Arquivo externo. Abrir original acessará o endereço informado.",
    missing: "O arquivo não está mais disponível."
  },
  pdf: {
    previous: "Página anterior",
    next: "Próxima página",
    zoomIn: "Aumentar zoom do PDF",
    zoomOut: "Diminuir zoom do PDF",
    fit: "Ajustar à largura",
    page: "Página",
    loading: "Carregando PDF…",
    failed: "Não foi possível exibir este PDF.",
    password:
      "Este PDF exige uma senha. Baixe o arquivo para abri-lo em um leitor compatível.",
    pageCount: "Página {{page}} de {{count}}"
  }
};

en.attachments = {
  refresh: "Refresh",
  open: "Files",
  title: "Conversation files",
  file: "File",
  scope:
    "Files available in this conversation's authorized context. Search covers loaded files only.",
  filter: "File type",
  search: "Search loaded files",
  kinds: {
    all: "All",
    pdf: "PDFs",
    image: "Images",
    video: "Videos",
    other: "Other files"
  },
  loading: "Loading file…",
  empty: "No files available.",
  noMatches: "No loaded files match this search.",
  unknownSize: "Unknown size",
  view: "View / download",
  viewNamed: "View {{name}}",
  viewPdf: "View PDF",
  viewImage: "Enlarge image",
  image: "Message image",
  video: "Message video",
  sticker: "Sticker",
  expand: "Enlarge video",
  loadMore: "Load more",
  retry: "Try again",
  close: "Close",
  closeViewer: "Close viewer",
  previous: "Previous file",
  next: "Next file",
  openOriginal: "Open original",
  download: "Download file",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  rotateLeft: "Rotate left",
  rotateRight: "Rotate right",
  codec:
    "The browser could not play this video. You can download it from the viewer.",
  access: "File unavailable or access denied. Refresh the conversation.",
  failed: "Unable to load this file.",
  timeout: "Loading timed out. Close and try again.",
  tooLarge: "This file exceeds the 25 MiB preview limit.",
  reason: {
    available: "File available.",
    too_large:
      "File exceeds the 25 MiB preview limit. Use Open original to continue.",
    unsupported:
      "This file type has no preview. Use Open original to continue.",
    external: "External file. Open original will access the provided address.",
    missing: "The file is no longer available."
  },
  pdf: {
    previous: "Previous page",
    next: "Next page",
    zoomIn: "Zoom PDF in",
    zoomOut: "Zoom PDF out",
    fit: "Fit width",
    page: "Page",
    loading: "Loading PDF…",
    failed: "Unable to display this PDF.",
    password:
      "This PDF requires a password. Download it to open in a compatible reader.",
    pageCount: "Page {{page}} of {{count}}"
  }
};

es.attachments = {
  refresh: "Actualizar",
  open: "Archivos",
  title: "Archivos de la conversación",
  file: "Archivo",
  scope:
    "Archivos disponibles en el contexto autorizado de esta conversación. La búsqueda solo considera los archivos cargados.",
  filter: "Tipo de archivo",
  search: "Buscar en los archivos cargados",
  kinds: {
    all: "Todos",
    pdf: "PDFs",
    image: "Imágenes",
    video: "Vídeos",
    other: "Otros archivos"
  },
  loading: "Cargando archivo…",
  empty: "No hay archivos disponibles.",
  noMatches: "Ningún archivo cargado coincide con la búsqueda.",
  unknownSize: "Tamaño no informado",
  view: "Ver / descargar",
  viewNamed: "Ver {{name}}",
  viewPdf: "Ver PDF",
  viewImage: "Ampliar imagen",
  image: "Imagen del mensaje",
  video: "Vídeo del mensaje",
  sticker: "Sticker",
  expand: "Ampliar vídeo",
  loadMore: "Cargar más",
  retry: "Intentar de nuevo",
  close: "Cerrar",
  closeViewer: "Cerrar visor",
  previous: "Archivo anterior",
  next: "Archivo siguiente",
  openOriginal: "Abrir original",
  download: "Descargar archivo",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  rotateLeft: "Girar a la izquierda",
  rotateRight: "Girar a la derecha",
  codec:
    "El navegador no pudo reproducir este vídeo. Puedes descargarlo desde el visor.",
  access: "Archivo no disponible o acceso denegado. Actualiza la conversación.",
  failed: "No se pudo cargar este archivo.",
  timeout: "Se agotó el tiempo de carga. Cierra e inténtalo de nuevo.",
  tooLarge: "Este archivo supera el límite de vista previa de 25 MiB.",
  reason: {
    available: "Archivo disponible.",
    too_large:
      "El archivo supera el límite de vista previa de 25 MiB. Usa Abrir original para continuar.",
    unsupported:
      "Este tipo de archivo no tiene vista previa. Usa Abrir original para continuar.",
    external:
      "Archivo externo. Abrir original accederá a la dirección indicada.",
    missing: "El archivo ya no está disponible."
  },
  pdf: {
    previous: "Página anterior",
    next: "Página siguiente",
    zoomIn: "Acercar PDF",
    zoomOut: "Alejar PDF",
    fit: "Ajustar al ancho",
    page: "Página",
    loading: "Cargando PDF…",
    failed: "No se pudo mostrar este PDF.",
    password:
      "Este PDF requiere una contraseña. Descárgalo para abrirlo en un lector compatible.",
    pageCount: "Página {{page}} de {{count}}"
  }
};

pt.sci = {
  button: "SCI",
  open: "Abrir SCI deste atendimento",
  title: "SCI — Simulação",
  simulation: "Simulação",
  scope:
    "Publicações inteiramente fictícias para testar o painel. Não representam documentos ou confirmações da SCI.",
  refreshLinks: "Atualizar vínculos",
  linkClient: "Vincular cliente",
  loading: "Consultando simulação…",
  noLinks: "Este contato ainda não tem clientes vinculados.",
  selectedClient: "Cliente vinculado",
  chooseClient: "Escolha um cliente vinculado",
  localLinks: "Vínculos locais do contato",
  catalog: "Catálogo simulado da empresa",
  linkNamed: "Vincular {{name}}",
  unlinkNamed: "Desvincular {{name}}",
  link: "Vincular",
  unlink: "Desvincular",
  alreadyLinked: "Já vinculado",
  registration: "Cadastro do cliente",
  publications: "Publicações simuladas",
  noPublications: "Nenhuma publicação nesta simulação.",
  previous: "Página anterior",
  next: "Próxima página",
  page: "Página {{page}}",
  retry: "Tentar novamente",
  source: "Origem e atualização",
  publishedAt: "Publicado em {{date}}",
  updatedAt: "Atualizado em {{date}}",
  fetchedAt: "Consultado em {{date}}",
  stale:
    "Dados desatualizados: esta simulação usa uma versão antiga. Confirme as informações antes de usar.",
  close: "Fechar",
  cancelQuery: "Cancelar consulta",
  cancel: "Cancelar",
  confirmLinkTitle: "Confirmar vínculo local",
  confirmUnlinkTitle: "Confirmar desvinculação local",
  confirmLink: "Confirmar vínculo",
  confirmUnlink: "Confirmar desvinculação",
  localOnly:
    "Esta ação altera somente o vínculo local deste contato na simulação SCI. Não modifica o cadastro ou as publicações do fornecedor.",
  disabled: "A consulta SCI está desabilitada para esta empresa ou ambiente.",
  permission: "Você não tem permissão para esta consulta ou ação.",
  notLinked:
    "O cliente não está mais vinculado a este contato. Atualize os vínculos.",
  notFound: "O cliente simulado não foi encontrado.",
  contextChanged:
    "O atendimento ou vínculo mudou durante a consulta. Atualize os vínculos.",
  functionalError:
    "A simulação informou uma falha na consulta. Nenhum resultado foi aproveitado.",
  invalidOutput: "O resultado recebido não pôde ser validado.",
  upstreamUnauthorized:
    "A simulação de autorização do fornecedor recusou a consulta.",
  rateLimited:
    "A simulação atingiu o limite de consultas. Tente novamente mais tarde.",
  timeout:
    "A consulta demorou além do limite. Nenhum resultado foi aproveitado.",
  unavailable:
    "A consulta simulada está indisponível. Tente novamente mais tarde.",
  requestError:
    "Não foi possível concluir a consulta. Nenhum resultado anterior será apresentado como atualizado.",
  settingsTitle: "Consultas SCI (simulação)",
  settingsHint:
    "Habilita publicações fictícias e vínculos locais para esta empresa no ambiente autorizado. Não conecta à SCI real nem habilita IA ou mensagens.",
  settingError:
    "Não foi possível alterar a configuração. O valor anterior foi preservado.",
  settingConflict:
    "Há configurações divergentes. A consulta permanece desativada; salve a opção desejada para regularizar."
};

en.sci = {
  button: "SCI",
  open: "Open SCI for this conversation",
  title: "SCI — Simulation",
  simulation: "Simulation",
  scope:
    "Entirely fictitious publications for testing this panel. They do not represent SCI documents or confirmations.",
  refreshLinks: "Refresh links",
  linkClient: "Link client",
  loading: "Loading simulation…",
  noLinks: "This contact has no linked clients yet.",
  selectedClient: "Linked client",
  chooseClient: "Choose a linked client",
  localLinks: "Contact's local links",
  catalog: "Company's simulated catalog",
  linkNamed: "Link {{name}}",
  unlinkNamed: "Unlink {{name}}",
  link: "Link",
  unlink: "Unlink",
  alreadyLinked: "Already linked",
  registration: "Client registration",
  publications: "Simulated publications",
  noPublications: "No publications in this simulation.",
  previous: "Previous page",
  next: "Next page",
  page: "Page {{page}}",
  retry: "Try again",
  source: "Source and freshness",
  publishedAt: "Published on {{date}}",
  updatedAt: "Updated on {{date}}",
  fetchedAt: "Retrieved on {{date}}",
  stale:
    "Outdated data: this simulation uses an old version. Verify the information before use.",
  close: "Close",
  cancelQuery: "Cancel query",
  cancel: "Cancel",
  confirmLinkTitle: "Confirm local link",
  confirmUnlinkTitle: "Confirm local unlink",
  confirmLink: "Confirm link",
  confirmUnlink: "Confirm unlink",
  localOnly:
    "This action only changes this contact's local link in the SCI simulation. It does not change the provider's registration or publications.",
  disabled: "SCI queries are disabled for this company or environment.",
  permission: "You do not have permission for this query or action.",
  notLinked:
    "This client is no longer linked to this contact. Refresh the links.",
  notFound: "The simulated client was not found.",
  contextChanged:
    "The conversation or link changed during the query. Refresh the links.",
  functionalError:
    "The simulation reported a query failure. No result was used.",
  invalidOutput: "The received result could not be validated.",
  upstreamUnauthorized:
    "The simulated provider authorization denied the query.",
  rateLimited: "The simulation reached its query limit. Try again later.",
  timeout: "The query timed out. No result was used.",
  unavailable: "The simulated query is unavailable. Try again later.",
  requestError:
    "The query could not be completed. Previous results will not be shown as up to date.",
  settingsTitle: "SCI queries (simulation)",
  settingsHint:
    "Enables fictitious publications and local links for this company in the authorized environment. It does not connect to real SCI or enable AI or messaging.",
  settingError:
    "Unable to change the setting. The previous value was preserved.",
  settingConflict:
    "Conflicting settings exist. Queries remain disabled; save the desired option to resolve them."
};

es.sci = {
  button: "SCI",
  open: "Abrir SCI de esta conversación",
  title: "SCI — Simulación",
  simulation: "Simulación",
  scope:
    "Publicaciones enteramente ficticias para probar este panel. No representan documentos ni confirmaciones de SCI.",
  refreshLinks: "Actualizar vínculos",
  linkClient: "Vincular cliente",
  loading: "Consultando simulación…",
  noLinks: "Este contacto aún no tiene clientes vinculados.",
  selectedClient: "Cliente vinculado",
  chooseClient: "Elige un cliente vinculado",
  localLinks: "Vínculos locales del contacto",
  catalog: "Catálogo simulado de la empresa",
  linkNamed: "Vincular {{name}}",
  unlinkNamed: "Desvincular {{name}}",
  link: "Vincular",
  unlink: "Desvincular",
  alreadyLinked: "Ya vinculado",
  registration: "Registro del cliente",
  publications: "Publicaciones simuladas",
  noPublications: "No hay publicaciones en esta simulación.",
  previous: "Página anterior",
  next: "Página siguiente",
  page: "Página {{page}}",
  retry: "Intentar de nuevo",
  source: "Origen y actualización",
  publishedAt: "Publicado el {{date}}",
  updatedAt: "Actualizado el {{date}}",
  fetchedAt: "Consultado el {{date}}",
  stale:
    "Datos desactualizados: esta simulación usa una versión antigua. Confirma la información antes de usarla.",
  close: "Cerrar",
  cancelQuery: "Cancelar consulta",
  cancel: "Cancelar",
  confirmLinkTitle: "Confirmar vínculo local",
  confirmUnlinkTitle: "Confirmar desvinculación local",
  confirmLink: "Confirmar vínculo",
  confirmUnlink: "Confirmar desvinculación",
  localOnly:
    "Esta acción solo cambia el vínculo local de este contacto en la simulación SCI. No modifica el registro ni las publicaciones del proveedor.",
  disabled: "Las consultas SCI están desactivadas para esta empresa o entorno.",
  permission: "No tienes permiso para esta consulta o acción.",
  notLinked:
    "El cliente ya no está vinculado a este contacto. Actualiza los vínculos.",
  notFound: "No se encontró el cliente simulado.",
  contextChanged:
    "La conversación o el vínculo cambió durante la consulta. Actualiza los vínculos.",
  functionalError:
    "La simulación informó un fallo en la consulta. No se utilizó ningún resultado.",
  invalidOutput: "No se pudo validar el resultado recibido.",
  upstreamUnauthorized:
    "La autorización simulada del proveedor rechazó la consulta.",
  rateLimited:
    "La simulación alcanzó el límite de consultas. Inténtalo más tarde.",
  timeout: "Se agotó el tiempo de consulta. No se utilizó ningún resultado.",
  unavailable: "La consulta simulada no está disponible. Inténtalo más tarde.",
  requestError:
    "No se pudo completar la consulta. No se mostrarán datos anteriores como actualizados.",
  settingsTitle: "Consultas SCI (simulación)",
  settingsHint:
    "Habilita publicaciones ficticias y vínculos locales para esta empresa en el entorno autorizado. No conecta con SCI real ni habilita IA o mensajes.",
  settingError:
    "No se pudo cambiar la configuración. Se conservó el valor anterior.",
  settingConflict:
    "Hay configuraciones distintas. La consulta sigue desactivada; guarda la opción deseada para resolverlas."
};

pt.audit.entities.contact = "Contato";
pt.audit.actions.sci_link_created = "Vínculo SCI criado";
pt.audit.actions.sci_link_deleted = "Vínculo SCI removido";

en.audit.entities.contact = "Contact";
en.audit.actions.sci_link_created = "SCI link created";
en.audit.actions.sci_link_deleted = "SCI link removed";

es.audit.entities.contact = "Contacto";
es.audit.actions.sci_link_created = "Vínculo SCI creado";
es.audit.actions.sci_link_deleted = "Vínculo SCI eliminado";

pt.audit.actions.integrated_assistant_generated = "Consulta integrada gerada";
pt.audit.actions.integrated_assistant_reviewed =
  "Consulta integrada revalidada para revisão";
en.audit.actions.integrated_assistant_generated = "Integrated query generated";
en.audit.actions.integrated_assistant_reviewed =
  "Integrated query revalidated for review";
es.audit.actions.integrated_assistant_generated = "Consulta integrada generada";
es.audit.actions.integrated_assistant_reviewed =
  "Consulta integrada revalidada para revisión";

pt.integratedAssistant = {
  sourceNotFound:
    "O cliente vinculado não foi encontrado nesta fonte simulada. Os dados dessa fonte não foram incluídos.",
  button: "Consulta integrada",
  open: "Abrir consulta integrada deste atendimento",
  title: "Consulta integrada — Simulação",
  simulation: "Simulação",
  scope:
    "Conversa, pendências Acessórias e publicações SCI inteiramente fictícias. Não consulta fornecedores reais nem confirma obrigações ou documentos.",
  reviewRequired:
    "Revise o resultado. A sugestão só entra no rascunho após sua confirmação; nenhum envio é realizado.",
  acessorias: "Acessórias",
  sci: "SCI",
  acessoriasClient: "Cliente Acessórias vinculado",
  sciClient: "Cliente SCI vinculado",
  acessoriasPage: "Página Acessórias",
  sciPage: "Página SCI",
  notSelected: "Não incluir esta fonte",
  pageHint: "De 1 a 100",
  invalidPage: "Informe uma página inteira de 1 a 100.",
  noLinkedClients:
    "Nenhum cliente vinculado. A administração pode cadastrar vínculos nos painéis Acessórias e SCI.",
  selectionHint:
    "Escolha ao menos uma fonte. Cada seleção e página são independentes; a consulta traz até cinco itens por fonte.",
  refreshClients: "Atualizar clientes vinculados",
  summary: "Consultar e resumir",
  reply: "Consultar e sugerir resposta",
  loading: "Consultando a simulação…",
  cancel: "Cancelar",
  result: "Resultado integrado para revisão",
  draft: "Sugestão integrada para revisar",
  appendHint:
    "Edite e confirme para anexar ao rascunho existente. O envio continua sendo uma ação separada.",
  useDraft: "Anexar ao rascunho",
  references: "Referências da conversa",
  noReferences: "Sem mensagens elegíveis como referência.",
  acessoriasResult: "Resultado Acessórias",
  sciResult: "Resultado SCI",
  acessoriasItems: "Pendências fictícias Acessórias",
  sciItems: "Publicações fictícias SCI",
  emptySource: "Nenhum item nesta página da simulação.",
  pageResult: "Página {{page}}: {{count}} de {{total}} itens da fonte.",
  updatedAt: "Atualizado em {{date}}",
  fetchedAt: "Consultado em {{date}}",
  stale:
    "Dados desatualizados: esta simulação usa uma versão antiga. Confirme as informações antes de usar.",
  disabled:
    "A consulta integrada está desativada para esta empresa ou ambiente, ou o assistente de conversa não está habilitado.",
  permission: "Você não tem permissão para esta consulta.",
  contextChanged:
    "O atendimento, suas permissões ou os vínculos mudaram. Atualize os clientes e consulte novamente.",
  invalidOutput: "O resultado recebido não pôde ser validado.",
  requestError:
    "Não foi possível concluir a consulta. Nenhum resultado anterior será usado como atual.",
  timeout: "O tempo de consulta acabou. Nenhum resultado foi utilizado.",
  composerBlocked:
    "O editor mudou ou está ocupado. A sugestão não foi anexada.",
  functionalError:
    "A fonte simulada informou uma falha. Seus dados não foram incluídos.",
  upstreamUnauthorized:
    "A autorização simulada desta fonte recusou a consulta.",
  rateLimited:
    "A fonte simulada atingiu o limite de consultas. Tente novamente mais tarde.",
  sourceDisabled: "Esta fonte está desativada para a empresa ou ambiente.",
  sourceUnavailable:
    "Esta fonte simulada está indisponível. Seus dados não foram incluídos.",
  settingsTitle: "Consultas integradas com revisão humana (simulação)",
  settingsHint:
    "Habilita este percurso para a empresa no ambiente autorizado. Também exige o assistente de conversa; Acessórias e SCI mantêm suas próprias permissões e flags. Não ativa fornecedores reais ou envios.",
  settingError:
    "Não foi possível alterar a configuração. O valor anterior foi preservado.",
  settingConflict:
    "Há configurações divergentes. O recurso permanece desativado; salve a opção desejada para resolvê-las.",
  warnings: {
    PARTIAL_CONTEXT:
      "O contexto da conversa é parcial e respeita o limite de mensagens e caracteres.",
    NO_MESSAGES:
      "Não há mensagens de texto elegíveis para o contexto da conversa.",
    INSUFFICIENT_INFORMATION:
      "A sugestão não confirma fatos externos. Revise e complemente as informações antes de usar.",
    PARTIAL_SOURCES:
      "Parte das fontes falhou. Consulte os avisos de cada fonte; ausência de dados não significa ausência de pendências.",
    STALE_SOURCES:
      "Uma fonte tem dados desatualizados. Eles não representam uma confirmação atual.",
    PARTIAL_PAGES:
      "Somente as páginas selecionadas foram consultadas. O resultado não representa todos os itens das fontes."
  }
};
en.integratedAssistant = {
  sourceNotFound:
    "The linked client was not found in this simulated source. Its data was not included.",
  button: "Integrated query",
  open: "Open integrated query for this ticket",
  title: "Integrated query — Simulation",
  simulation: "Simulation",
  scope:
    "Conversation, Acessórias pending items and SCI publications are entirely fictitious. No real provider is queried and no obligation or document is confirmed.",
  reviewRequired:
    "Review the result. A suggestion only enters the draft after your confirmation; nothing is sent.",
  acessorias: "Acessórias",
  sci: "SCI",
  acessoriasClient: "Linked Acessórias client",
  sciClient: "Linked SCI client",
  acessoriasPage: "Acessórias page",
  sciPage: "SCI page",
  notSelected: "Do not include this source",
  pageHint: "From 1 to 100",
  invalidPage: "Enter a whole page number from 1 to 100.",
  noLinkedClients:
    "No linked clients. An administrator can manage links in the Acessórias and SCI panels.",
  selectionHint:
    "Choose at least one source. Each selection and page is independent; the query returns up to five items per source.",
  refreshClients: "Refresh linked clients",
  summary: "Query and summarize",
  reply: "Query and suggest reply",
  loading: "Querying the simulation…",
  cancel: "Cancel",
  result: "Integrated result for review",
  draft: "Integrated suggestion to review",
  appendHint:
    "Edit and confirm to append to the existing draft. Sending remains a separate action.",
  useDraft: "Append to draft",
  references: "Conversation references",
  noReferences: "No eligible message references.",
  acessoriasResult: "Acessórias result",
  sciResult: "SCI result",
  acessoriasItems: "Fictitious Acessórias pending items",
  sciItems: "Fictitious SCI publications",
  emptySource: "No items on this simulation page.",
  pageResult: "Page {{page}}: {{count}} of {{total}} source items.",
  updatedAt: "Updated at {{date}}",
  fetchedAt: "Queried at {{date}}",
  stale:
    "Outdated data: this simulation uses an older version. Confirm the information before using it.",
  disabled:
    "Integrated queries are disabled for this company or environment, or the conversation assistant is not enabled.",
  permission: "You do not have permission for this query.",
  contextChanged:
    "The ticket, your permissions or client links changed. Refresh the clients and query again.",
  invalidOutput: "The received result could not be validated.",
  requestError:
    "The query could not be completed. Previous results will not be presented as current.",
  timeout: "The query timed out. No result was used.",
  composerBlocked:
    "The editor changed or is busy. The suggestion was not appended.",
  functionalError:
    "The simulated source reported a failure. Its data was not included.",
  upstreamUnauthorized:
    "Simulated authorization for this source rejected the query.",
  rateLimited: "The simulated source reached its query limit. Try again later.",
  sourceDisabled: "This source is disabled for the company or environment.",
  sourceUnavailable:
    "This simulated source is unavailable. Its data was not included.",
  settingsTitle: "Integrated queries with human review (simulation)",
  settingsHint:
    "Enables this workflow for the company in the authorized environment. It also requires the conversation assistant; Acessórias and SCI keep their own permissions and flags. It does not enable real providers or sending.",
  settingError:
    "The setting could not be changed. The previous value was preserved.",
  settingConflict:
    "Settings conflict. The feature remains disabled; save your chosen option to resolve them.",
  warnings: {
    PARTIAL_CONTEXT:
      "Conversation context is partial and respects message and character limits.",
    NO_MESSAGES:
      "There are no eligible text messages for the conversation context.",
    INSUFFICIENT_INFORMATION:
      "The suggestion does not confirm external facts. Review and complete the information before using it.",
    PARTIAL_SOURCES:
      "Some sources failed. Check each source's notice; missing data does not mean there are no pending items.",
    STALE_SOURCES:
      "A source contains outdated data. It is not a current confirmation.",
    PARTIAL_PAGES:
      "Only selected pages were queried. The result does not cover every source item."
  }
};
es.integratedAssistant = {
  sourceNotFound:
    "El cliente vinculado no se encontró en esta fuente simulada. Sus datos no se incluyeron.",
  button: "Consulta integrada",
  open: "Abrir consulta integrada de esta conversación",
  title: "Consulta integrada — Simulación",
  simulation: "Simulación",
  scope:
    "La conversación, los pendientes Acessórias y las publicaciones SCI son completamente ficticios. No se consulta a proveedores reales ni se confirma una obligación o documento.",
  reviewRequired:
    "Revisa el resultado. La sugerencia solo entra en el borrador después de tu confirmación; no se envía nada.",
  acessorias: "Acessórias",
  sci: "SCI",
  acessoriasClient: "Cliente Acessórias vinculado",
  sciClient: "Cliente SCI vinculado",
  acessoriasPage: "Página Acessórias",
  sciPage: "Página SCI",
  notSelected: "No incluir esta fuente",
  pageHint: "De 1 a 100",
  invalidPage: "Introduce un número entero de página entre 1 y 100.",
  noLinkedClients:
    "No hay clientes vinculados. La administración puede gestionar vínculos en los paneles Acessórias y SCI.",
  selectionHint:
    "Elige al menos una fuente. Cada selección y página es independiente; la consulta devuelve hasta cinco elementos por fuente.",
  refreshClients: "Actualizar clientes vinculados",
  summary: "Consultar y resumir",
  reply: "Consultar y sugerir respuesta",
  loading: "Consultando la simulación…",
  cancel: "Cancelar",
  result: "Resultado integrado para revisión",
  draft: "Sugerencia integrada para revisar",
  appendHint:
    "Edita y confirma para añadir al borrador existente. Enviar sigue siendo una acción separada.",
  useDraft: "Añadir al borrador",
  references: "Referencias de la conversación",
  noReferences: "Sin mensajes elegibles como referencia.",
  acessoriasResult: "Resultado Acessórias",
  sciResult: "Resultado SCI",
  acessoriasItems: "Pendientes ficticios Acessórias",
  sciItems: "Publicaciones ficticias SCI",
  emptySource: "No hay elementos en esta página de la simulación.",
  pageResult: "Página {{page}}: {{count}} de {{total}} elementos de la fuente.",
  updatedAt: "Actualizado el {{date}}",
  fetchedAt: "Consultado el {{date}}",
  stale:
    "Datos desactualizados: esta simulación utiliza una versión antigua. Confirma la información antes de usarla.",
  disabled:
    "Las consultas integradas están desactivadas para esta empresa o entorno, o el asistente de conversación no está habilitado.",
  permission: "No tienes permiso para esta consulta.",
  contextChanged:
    "La conversación, tus permisos o los vínculos cambiaron. Actualiza los clientes y vuelve a consultar.",
  invalidOutput: "No se pudo validar el resultado recibido.",
  requestError:
    "No se pudo completar la consulta. No se presentarán resultados anteriores como actuales.",
  timeout: "Se agotó el tiempo de consulta. No se utilizó ningún resultado.",
  composerBlocked:
    "El editor cambió o está ocupado. La sugerencia no se añadió.",
  functionalError:
    "La fuente simulada informó un fallo. Sus datos no se incluyeron.",
  upstreamUnauthorized:
    "La autorización simulada de esta fuente rechazó la consulta.",
  rateLimited:
    "La fuente simulada alcanzó el límite de consultas. Inténtalo más tarde.",
  sourceDisabled: "Esta fuente está desactivada para la empresa o entorno.",
  sourceUnavailable:
    "Esta fuente simulada no está disponible. Sus datos no se incluyeron.",
  settingsTitle: "Consultas integradas con revisión humana (simulación)",
  settingsHint:
    "Habilita este recorrido para la empresa en el entorno autorizado. También requiere el asistente de conversación; Acessórias y SCI mantienen sus propios permisos y opciones. No activa proveedores reales ni envíos.",
  settingError:
    "No se pudo cambiar la configuración. Se conservó el valor anterior.",
  settingConflict:
    "Hay configuraciones distintas. La función sigue desactivada; guarda la opción deseada para resolverlas.",
  warnings: {
    PARTIAL_CONTEXT:
      "El contexto de la conversación es parcial y respeta los límites de mensajes y caracteres.",
    NO_MESSAGES:
      "No hay mensajes de texto elegibles para el contexto de la conversación.",
    INSUFFICIENT_INFORMATION:
      "La sugerencia no confirma hechos externos. Revisa y completa la información antes de usarla.",
    PARTIAL_SOURCES:
      "Algunas fuentes fallaron. Consulta los avisos de cada fuente; la falta de datos no significa ausencia de pendientes.",
    STALE_SOURCES:
      "Una fuente tiene datos desactualizados. No representan una confirmación actual.",
    PARTIAL_PAGES:
      "Solo se consultaron las páginas seleccionadas. El resultado no incluye todos los elementos de las fuentes."
  }
};

export const komunickMessages = {
  pt: { translations: pt },
  pt_PT: { translations: pt },
  en: { translations: en },
  es: { translations: es }
};
