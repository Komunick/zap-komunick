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
      kanban: "Usar como coluna do Kanban"
    }
  },
  tags: {
    table: {
      kanban: "Kanban"
    }
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
  about: {
    licensesourcecode: "Código-fonte desta versão",
    basedOnTicketz: "Baseado no Ticketz (código original)"
  },
  tickets: {
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
      kanban: "Use as a Kanban column"
    }
  },
  tags: {
    table: {
      kanban: "Kanban"
    }
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
  about: {
    licensesourcecode: "Source code of this version",
    basedOnTicketz: "Based on Ticketz (original code)"
  },
  tickets: {
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
      kanban: "Usar como columna del Kanban"
    }
  },
  tags: {
    table: {
      kanban: "Kanban"
    }
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
  about: {
    licensesourcecode: "Código fuente de esta versión",
    basedOnTicketz: "Basado en Ticketz (código original)"
  },
  tickets: {
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

export const komunickMessages = {
  pt: { translations: pt },
  pt_PT: { translations: pt },
  en: { translations: en },
  es: { translations: es }
};
