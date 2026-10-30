import { Op, Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactExternalClientLink from "../../models/ContactExternalClientLink";
import Setting from "../../models/Setting";
import Ticket from "../../models/Ticket";
import {
  ASSISTANT_LIMITS,
  AssistantContext,
  AssistantScope,
  assistantMode,
  validateAssistantOutput
} from "../../helpers/AssistantRules";
import { acessoriasMode } from "../../helpers/AcessoriasRules";
import { sciMode } from "../../helpers/SciRules";
import {
  INTEGRATED_ASSISTANT_LIMITS,
  INTEGRATED_PROVIDERS,
  IntegratedClientsEnvelope,
  IntegratedProvider,
  IntegratedRequest,
  IntegratedSelections,
  IntegratedSources,
  createIntegratedText,
  integratedAssistantMode,
  integratedContextVersion,
  integratedOperationalError,
  integratedWarnings,
  normalizeIntegratedClients,
  normalizeIntegratedDetail,
  parseIntegratedRequest,
  parseIntegratedReviewRequest,
  requireEmptyIntegratedQuery
} from "../../helpers/IntegratedAssistantRules";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import LoadAssistantContextService from "../AssistantServices/LoadAssistantContextService";
import { generateMockAssistant } from "../AssistantServices/MockAssistantProvider";
import {
  ticketAcessoriasClients,
  ticketAcessoriasDetail
} from "../AcessoriasServices/TicketAcessoriasService";
import {
  ticketSciClients,
  ticketSciDetail
} from "../SciServices/TicketSciService";

const FLAG_KEYS = [
  "integratedAssistantEnabled",
  "aiAssistantEnabled",
  "acessoriasEnabled",
  "sciEnabled"
] as const;
type Flag = (typeof FLAG_KEYS)[number];
interface Scope extends AssistantScope {
  queueId: number | null;
  assignedUserId: number | null;
  status: string;
  isAdmin: boolean;
  queueIds: number[];
  flags: Record<Flag, string[]>;
  modes: {
    integrated: "mock" | "disabled";
    assistant: "mock" | "disabled";
    acessorias: "mock" | "disabled";
    sci: "mock" | "disabled";
  };
}
const safe = new Set([
  "ERR_NO_PERMISSION",
  "ERR_NO_TICKET_FOUND",
  "ERR_ASSISTANT_DISABLED",
  "ERR_INTEGRATED_ASSISTANT_DISABLED",
  "ERR_INTEGRATED_ASSISTANT_INVALID_REQUEST",
  "ERR_INTEGRATED_ASSISTANT_CONTEXT_CHANGED",
  "ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT",
  "ERR_INTEGRATED_ASSISTANT_UNAVAILABLE",
  ...["ACESSORIAS", "SCI"].flatMap(provider =>
    [
      "DISABLED",
      "CLIENT_NOT_LINKED",
      "CONTEXT_CHANGED",
      "MANAGE_DENIED",
      "INVALID_REQUEST"
    ].map(code => `ERR_${provider}_${code}`)
  )
]);
const protect = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && safe.has(error.message)) throw error;
    throw new AppError("ERR_INTEGRATED_ASSISTANT_UNAVAILABLE", 503);
  }
};
const changed = (): never => {
  throw new AppError("ERR_INTEGRATED_ASSISTANT_CONTEXT_CHANGED", 409);
};
const flag = (scope: Scope, key: Flag) =>
  scope.flags[key].length > 0 &&
  scope.flags[key].every(value => value === "enabled");
const providerFlag = (provider: IntegratedProvider): Flag =>
  provider === "acessorias" ? "acessoriasEnabled" : "sciEnabled";
const sourceErrorPrefix = (provider: IntegratedProvider) =>
  provider === "acessorias" ? "ERR_ACESSORIAS_" : "ERR_SCI_";

const loadScope = async (
  ticketId: string,
  actor: ContextActor,
  transaction?: Transaction
): Promise<Scope> => {
  const { ticket, viewer } = await AuthorizeTicketContextService(
    ticketId,
    actor,
    undefined,
    transaction
  );
  // P4 versions assignment/state without changing P0's read permissions. A second
  // query is necessary because the shared authorizer deliberately selects only
  // access fields; reject a moved ticket rather than combining two scopes.
  const snapshot = await Ticket.findOne({
    where: { id: ticket.id, companyId: actor.companyId },
    attributes: [
      "id",
      "companyId",
      "contactId",
      "queueId",
      "isGroup",
      "userId",
      "status"
    ],
    ...(transaction ? { transaction } : {}),
    logging: false
  });
  if (
    !snapshot ||
    snapshot.id !== ticket.id ||
    snapshot.companyId !== ticket.companyId ||
    snapshot.contactId !== ticket.contactId ||
    snapshot.queueId !== ticket.queueId ||
    (snapshot.isGroup === true) !== (ticket.isGroup === true)
  )
    changed();
  const rows = await Setting.findAll({
    where: { companyId: actor.companyId, key: { [Op.in]: [...FLAG_KEYS] } },
    attributes: ["key", "value"],
    ...(transaction ? { transaction } : {}),
    logging: false
  });
  const flags = {} as Scope["flags"];
  FLAG_KEYS.forEach(key => {
    flags[key] = rows
      .filter(row => row.key === key)
      .map(row => row.value)
      .sort();
  });
  return {
    ticketId: ticket.id,
    companyId: ticket.companyId,
    contactId: ticket.contactId,
    queueId: ticket.queueId,
    assignedUserId: snapshot.userId ?? null,
    status: snapshot.status,
    isGroup: ticket.isGroup === true,
    isAdmin: viewer.isAdmin,
    queueIds: [...viewer.queueIds].sort((a, b) => a - b),
    flags,
    modes: {
      integrated: integratedAssistantMode(),
      assistant: assistantMode(),
      acessorias: acessoriasMode(),
      sci: sciMode()
    }
  };
};
const providerState = (scope: Scope, provider: IntegratedProvider) => {
  const mode = scope.modes[provider];
  const enabled = mode === "mock" && flag(scope, providerFlag(provider));
  return {
    enabled,
    mode,
    reason:
      mode === "disabled"
        ? "SERVER_DISABLED"
        : enabled
          ? null
          : "COMPANY_DISABLED"
  };
};
const availability = (scope: Scope) => {
  const mode = scope.modes.integrated;
  const assistantEnabled =
    scope.modes.assistant === "mock" && flag(scope, "aiAssistantEnabled");
  const enabled =
    mode === "mock" &&
    flag(scope, "integratedAssistantEnabled") &&
    assistantEnabled;
  return {
    enabled,
    mode,
    simulated: true,
    requiresReview: true,
    reason:
      mode === "disabled"
        ? "SERVER_DISABLED"
        : !flag(scope, "integratedAssistantEnabled")
          ? "COMPANY_DISABLED"
          : !assistantEnabled
            ? "ASSISTANT_DISABLED"
            : null,
    limits: { ...INTEGRATED_ASSISTANT_LIMITS },
    providers: {
      acessorias: providerState(scope, "acessorias"),
      sci: providerState(scope, "sci")
    }
  };
};
const requireEnabled = (scope: Scope, sources?: IntegratedSelections) => {
  if (!availability(scope).enabled)
    throw new AppError("ERR_INTEGRATED_ASSISTANT_DISABLED", 403);
  INTEGRATED_PROVIDERS.forEach(provider => {
    if (sources?.[provider] && !providerState(scope, provider).enabled)
      throw new AppError(sourceErrorPrefix(provider) + "DISABLED", 403);
  });
};
const loadLinkVersions = async (
  scope: Scope,
  sources?: IntegratedSelections,
  transaction?: Transaction
) => {
  const rows = await ContactExternalClientLink.findAll({
    where: {
      companyId: scope.companyId,
      contactId: scope.contactId,
      provider: { [Op.in]: [...INTEGRATED_PROVIDERS] }
    },
    attributes: [
      "id",
      "companyId",
      "contactId",
      "provider",
      "externalClientId",
      "updatedAt"
    ],
    ...(transaction ? { transaction } : {}),
    logging: false
  });
  const own = rows.filter(
    row =>
      row.companyId === scope.companyId &&
      row.contactId === scope.contactId &&
      INTEGRATED_PROVIDERS.includes(row.provider as IntegratedProvider)
  );
  if (sources) {
    INTEGRATED_PROVIDERS.forEach(provider => {
      const selection = sources[provider];
      if (
        selection &&
        own.filter(
          row =>
            row.provider === provider &&
            row.externalClientId === selection.externalClientId
        ).length !== 1
      ) {
        throw new AppError(
          sourceErrorPrefix(provider) + "CLIENT_NOT_LINKED",
          404
        );
      }
    });
  }
  return own
    .filter(
      row =>
        !sources ||
        sources[row.provider as IntegratedProvider]?.externalClientId ===
          row.externalClientId
    )
    .map(row => [
      row.provider,
      row.externalClientId,
      row.id,
      new Date(row.updatedAt).toISOString()
    ])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
const localVersion = (
  actor: ContextActor,
  scope: Scope,
  links: unknown,
  request?: IntegratedRequest,
  context?: AssistantContext
) =>
  integratedContextVersion({
    actorId: String(actor.userId),
    scope,
    links,
    ...(request ? { request } : {}),
    ...(context ? { context } : {})
  });

// This lock is the same row acquired by P2/P3 link mutations. Every provider has
// already settled before this local verification transaction is opened.
const finalVersion = async (
  ticketId: string,
  actor: ContextActor,
  initial: Scope,
  request?: IntegratedRequest,
  withMessages = false
) =>
  sequelize.transaction(async transaction => {
    const contact = await Contact.findOne({
      where: { id: initial.contactId, companyId: initial.companyId },
      attributes: ["id", "companyId"],
      transaction,
      lock: transaction.LOCK.UPDATE,
      logging: false
    });
    if (!contact || contact.companyId !== initial.companyId)
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    const fresh = await loadScope(ticketId, actor, transaction);
    if (fresh.contactId !== initial.contactId) changed();
    requireEnabled(fresh, request?.sources);
    let links: Awaited<ReturnType<typeof loadLinkVersions>>;
    try {
      links = await loadLinkVersions(fresh, request?.sources, transaction);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.message.endsWith("CLIENT_NOT_LINKED")
      )
        return changed();
      throw error;
    }
    const context = withMessages
      ? await LoadAssistantContextService(fresh, transaction)
      : undefined;
    // Message/context IO can yield while the actor, queue or flags are revoked.
    // Reload these grants last, still on the contact-lock connection, rather
    // than hashing a scope captured before that final asynchronous read.
    const current = await loadScope(ticketId, actor, transaction);
    if (current.contactId !== initial.contactId) changed();
    requireEnabled(current, request?.sources);
    return localVersion(actor, current, links, request, context);
  });

const operationalCode = (
  provider: IntegratedProvider,
  error: unknown
): string | undefined =>
  error instanceof AppError &&
  error.message === "ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT"
    ? sourceErrorPrefix(provider) + "INVALID_OUTPUT"
    : integratedOperationalError(provider, error);

export const ticketIntegratedAssistantStatus = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protect(async () => {
    requireEmptyIntegratedQuery(query);
    const initial = await loadScope(ticketId, actor);
    const fresh = await loadScope(ticketId, actor);
    if (
      initial.contactId !== fresh.contactId ||
      initial.queueId !== fresh.queueId ||
      initial.isAdmin !== fresh.isAdmin
    )
      changed();
    return availability(fresh);
  });

export const ticketIntegratedAssistantClients = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protect(async () => {
    requireEmptyIntegratedQuery(query);
    const scope = await loadScope(ticketId, actor);
    requireEnabled(scope);
    const links = await loadLinkVersions(scope);
    const version = localVersion(actor, scope, links);
    const providers = {} as Record<
      IntegratedProvider,
      IntegratedClientsEnvelope
    >;
    await Promise.all(
      INTEGRATED_PROVIDERS.map(async provider => {
        if (!providerState(scope, provider).enabled) {
          providers[provider] = {
            state: "disabled",
            clients: [],
            source: null,
            errorCode: sourceErrorPrefix(provider) + "DISABLED"
          };
          return;
        }
        try {
          const result =
            provider === "acessorias"
              ? await ticketAcessoriasClients(ticketId, actor, {})
              : await ticketSciClients(ticketId, actor, {});
          providers[provider] = normalizeIntegratedClients(
            provider,
            result,
            scope.companyId
          );
        } catch (error) {
          const code = operationalCode(provider, error);
          if (!code) throw error;
          providers[provider] = {
            state: "error",
            clients: [],
            source: null,
            errorCode: code
          };
        }
      })
    );
    if ((await finalVersion(ticketId, actor, scope)) !== version) changed();
    return {
      mode: "mock",
      simulated: true,
      providers: { acessorias: providers.acessorias, sci: providers.sci }
    };
  });

const generateConversation = async (
  request: IntegratedRequest,
  context: AssistantContext
) => {
  const messages = context.messages.map(message =>
    Object.freeze({ ...message })
  );
  Object.freeze(messages);
  let timer: ReturnType<typeof setTimeout>;
  try {
    const output = await Promise.race([
      generateMockAssistant(request.kind, messages),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(new AppError("ERR_INTEGRATED_ASSISTANT_UNAVAILABLE", 503)),
          2000
        );
      })
    ]);
    try {
      return validateAssistantOutput(output, request.kind, context.messages);
    } catch {
      throw new AppError("ERR_INTEGRATED_ASSISTANT_INVALID_OUTPUT", 502);
    }
  } finally {
    clearTimeout(timer);
  }
};

export const generateTicketIntegratedAssistant = async (
  ticketId: string,
  actor: ContextActor,
  input: unknown,
  query: Record<string, unknown>
) =>
  protect(async () => {
    requireEmptyIntegratedQuery(query);
    const request = parseIntegratedRequest(input);
    const scope = await loadScope(ticketId, actor);
    requireEnabled(scope, request.sources);
    const links = await loadLinkVersions(scope, request.sources);
    const context = await LoadAssistantContextService(scope);
    const version = localVersion(actor, scope, links, request, context);
    const sources: IntegratedSources = {
      acessorias: { state: "notSelected", data: null, errorCode: null },
      sci: { state: "notSelected", data: null, errorCode: null }
    };
    const [conversation] = await Promise.all([
      generateConversation(request, context),
      ...INTEGRATED_PROVIDERS.map(async provider => {
        const selection = request.sources[provider];
        if (!selection) return;
        try {
          const page = { page: String(selection.page) };
          const result =
            provider === "acessorias"
              ? await ticketAcessoriasDetail(
                  ticketId,
                  actor,
                  selection.externalClientId,
                  page
                )
              : await ticketSciDetail(
                  ticketId,
                  actor,
                  selection.externalClientId,
                  page
                );
          sources[provider] = {
            state: "ready",
            data: normalizeIntegratedDetail(
              provider,
              result,
              scope.companyId,
              selection
            ),
            errorCode: null
          };
        } catch (error) {
          const code = operationalCode(provider, error);
          if (!code) throw error;
          sources[provider] = { state: "error", data: null, errorCode: code };
        }
      })
    ]);
    if ((await finalVersion(ticketId, actor, scope, request, true)) !== version)
      changed();
    return {
      ticketId: scope.ticketId,
      contactId: scope.contactId,
      kind: request.kind,
      mode: "mock",
      simulated: true,
      requiresReview: true,
      text: createIntegratedText(request.kind, context.messages, sources),
      references: conversation.references,
      context: {
        ...ASSISTANT_LIMITS,
        messageCount: context.messageCount,
        characterCount: context.characterCount,
        partial: context.partial
      },
      sources,
      warnings: integratedWarnings(request.kind, context, sources),
      generatedAt: new Date().toISOString(),
      contextVersion: version
    };
  });

export const reviewTicketIntegratedAssistant = async (
  ticketId: string,
  actor: ContextActor,
  input: unknown,
  query: Record<string, unknown>
) =>
  protect(async () => {
    requireEmptyIntegratedQuery(query);
    const review = parseIntegratedReviewRequest(input);
    const request: IntegratedRequest = {
      kind: review.kind,
      sources: review.sources
    };
    const scope = await loadScope(ticketId, actor);
    requireEnabled(scope, request.sources);
    const version = await finalVersion(ticketId, actor, scope, request, true);
    if (version !== review.contextVersion) changed();
    return { valid: true, mode: "mock", simulated: true };
  });
