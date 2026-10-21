// Zap Komunick: texts of the features added by the fork (docs/PRD.md).
// Kept apart from the upstream dictionaries so Ticketz updates merge cleanly;
// they are deep merged over them in ./index.js. Languages without an entry
// here fall back to English.

const pt = {
  mainDrawer: {
    listItems: {
      kanban: "Kanban",
      sla: "Painel de SLA"
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
  backendErrors: {
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
  mainDrawer: {
    listItems: {
      kanban: "Kanban",
      sla: "SLA panel"
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
  backendErrors: {
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
  mainDrawer: {
    listItems: {
      kanban: "Kanban",
      sla: "Panel de SLA"
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
  backendErrors: {
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
