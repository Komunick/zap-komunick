import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Contact from "../../models/Contact";
import ContactExternalClientLink from "../../models/ContactExternalClientLink";
import {
  ACESSORIAS_LIMITS,
  ACESSORIAS_PROVIDER,
  acessoriasMode,
  parseAcessoriasLink,
  parseAcessoriasPage,
  parseExternalClientId,
  requireEmptyAcessoriasQuery,
  unwrapAcessoriasMock,
  validateAcessoriasCatalog,
  validateAcessoriasDetail
} from "../../helpers/AcessoriasRules";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import {
  MockAcessoriasRequest,
  requestMockAcessorias
} from "./MockAcessoriasProvider";

interface Scope {
  ticketId: number;
  companyId: number;
  contactId: number;
  queueId: number | null;
  isGroup: boolean;
}
const allowedErrors = new Set([
  "ERR_NO_PERMISSION",
  "ERR_NO_TICKET_FOUND",
  "ERR_ACESSORIAS_INVALID_REQUEST",
  "ERR_ACESSORIAS_DISABLED",
  "ERR_ACESSORIAS_MANAGE_DENIED",
  "ERR_ACESSORIAS_CLIENT_NOT_LINKED",
  "ERR_ACESSORIAS_CLIENT_NOT_FOUND",
  "ERR_ACESSORIAS_CONTEXT_CHANGED",
  "ERR_ACESSORIAS_FUNCTIONAL_ERROR",
  "ERR_ACESSORIAS_INVALID_OUTPUT",
  "ERR_ACESSORIAS_UPSTREAM_UNAUTHORIZED",
  "ERR_ACESSORIAS_RATE_LIMITED",
  "ERR_ACESSORIAS_TIMEOUT",
  "ERR_ACESSORIAS_UNAVAILABLE"
]);
const protectAcessorias = async <T>(
  operation: () => Promise<T>
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && allowedErrors.has(error.message))
      throw error;
    // ORM/adapter failures may include bound data. Only stable codes leave this boundary.
    throw new AppError("ERR_ACESSORIAS_UNAVAILABLE", 503);
  }
};

const availability = async (companyId: number, transaction?: Transaction) => {
  const mode = acessoriasMode();
  const rows =
    mode === "mock"
      ? await Setting.findAll({
          where: { companyId, key: "acessoriasEnabled" },
          attributes: ["value"],
          ...(transaction ? { transaction } : {}),
          logging: false
        })
      : [];
  const enabled =
    mode === "mock" &&
    rows.length > 0 &&
    rows.every(row => row.value === "enabled");
  return {
    enabled,
    mode,
    simulated: true,
    reason:
      mode === "disabled"
        ? "SERVER_DISABLED"
        : enabled
          ? null
          : "COMPANY_DISABLED",
    limits: { ...ACESSORIAS_LIMITS }
  };
};

const access = async (
  ticketId: string,
  actor: ContextActor,
  manage = false,
  requireEnabled = true
) => {
  const { ticket, viewer } = await AuthorizeTicketContextService(
    ticketId,
    actor
  );
  if (manage && !viewer.isAdmin)
    throw new AppError("ERR_ACESSORIAS_MANAGE_DENIED", 403);
  const state = await availability(actor.companyId);
  if (requireEnabled && !state.enabled)
    throw new AppError("ERR_ACESSORIAS_DISABLED", 403);
  const scope: Scope = {
    ticketId: ticket.id,
    companyId: actor.companyId,
    contactId: ticket.contactId,
    queueId: ticket.queueId,
    isGroup: ticket.isGroup === true
  };
  return { scope, state, canManageLinks: viewer.isAdmin };
};

const reauthorize = async (
  ticketId: string,
  actor: ContextActor,
  scope: Scope,
  manage = false,
  requireEnabled = true,
  transaction?: Transaction
) => {
  const { ticket, viewer } = await AuthorizeTicketContextService(
    ticketId,
    actor,
    scope.contactId,
    transaction
  );
  if (manage && !viewer.isAdmin)
    throw new AppError("ERR_ACESSORIAS_MANAGE_DENIED", 403);
  if (
    ticket.queueId !== scope.queueId ||
    (ticket.isGroup === true) !== scope.isGroup
  )
    throw new AppError("ERR_ACESSORIAS_CONTEXT_CHANGED", 409);
  if (
    requireEnabled &&
    !(await availability(actor.companyId, transaction)).enabled
  )
    throw new AppError("ERR_ACESSORIAS_DISABLED", 403);
};

const mockRequest = async (
  request: MockAcessoriasRequest
): Promise<unknown> => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const response = await Promise.race([
      requestMockAcessorias(request),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AppError("ERR_ACESSORIAS_TIMEOUT", 504)),
          2000
        );
      })
    ]);
    return unwrapAcessoriasMock(response);
  } finally {
    clearTimeout(timer);
  }
};
const catalog = async (companyId: number) =>
  validateAcessoriasCatalog(
    await mockRequest({ operation: "catalog", companyId }),
    companyId
  );
const linkWhere = (scope: Scope, externalClientId?: string) => ({
  companyId: scope.companyId,
  contactId: scope.contactId,
  provider: ACESSORIAS_PROVIDER,
  ...(externalClientId === undefined ? {} : { externalClientId })
});
const scopedLink = async (scope: Scope, externalClientId: string) => {
  const link = await ContactExternalClientLink.findOne({
    where: linkWhere(scope, externalClientId),
    logging: false
  });
  if (
    !link ||
    link.companyId !== scope.companyId ||
    link.contactId !== scope.contactId ||
    link.provider !== ACESSORIAS_PROVIDER ||
    link.externalClientId !== externalClientId
  ) {
    throw new AppError("ERR_ACESSORIAS_CLIENT_NOT_LINKED", 404);
  }
  return link;
};
const linkVersion = (link: ContactExternalClientLink): string =>
  JSON.stringify([
    link.id,
    link.externalClientId,
    new Date(link.updatedAt).toISOString()
  ]);
const scopedLinks = async (scope: Scope) => {
  const links = await ContactExternalClientLink.findAll({
    where: linkWhere(scope),
    logging: false
  });
  return links.filter(
    link =>
      link.companyId === scope.companyId &&
      link.contactId === scope.contactId &&
      link.provider === ACESSORIAS_PROVIDER
  );
};
const linksVersion = (links: ContactExternalClientLink[]): string =>
  JSON.stringify(links.map(linkVersion).sort());

export const ticketAcessoriasStatus = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    requireEmptyAcessoriasQuery(query);
    const { state, canManageLinks } = await access(
      ticketId,
      actor,
      false,
      false
    );
    return { ...state, canManageLinks };
  });

export const ticketAcessoriasCatalog = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    requireEmptyAcessoriasQuery(query);
    const { scope } = await access(ticketId, actor, true);
    const result = await catalog(scope.companyId);
    await reauthorize(ticketId, actor, scope, true);
    return {
      mode: "mock",
      simulated: true,
      clients: result.clients,
      source: result.source
    };
  });

export const ticketAcessoriasClients = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    requireEmptyAcessoriasQuery(query);
    const { scope } = await access(ticketId, actor);
    const links = await scopedLinks(scope);
    const version = linksVersion(links);
    const result = await catalog(scope.companyId);
    await reauthorize(ticketId, actor, scope);
    if (linksVersion(await scopedLinks(scope)) !== version)
      throw new AppError("ERR_ACESSORIAS_CONTEXT_CHANGED", 409);
    const clients = links.map(link =>
      result.clients.find(
        client => client.externalClientId === link.externalClientId
      )
    );
    if (clients.some(client => !client))
      throw new AppError("ERR_ACESSORIAS_CLIENT_NOT_FOUND", 404);
    return { mode: "mock", simulated: true, clients, source: result.source };
  });

export const ticketAcessoriasDetail = async (
  ticketId: string,
  actor: ContextActor,
  externalId: unknown,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    const externalClientId = parseExternalClientId(externalId);
    const page = parseAcessoriasPage(query);
    const { scope } = await access(ticketId, actor);
    const version = linkVersion(await scopedLink(scope, externalClientId));
    const result = validateAcessoriasDetail(
      await mockRequest({
        operation: "detail",
        companyId: scope.companyId,
        externalClientId,
        page
      }),
      scope.companyId,
      externalClientId,
      page
    );
    await reauthorize(ticketId, actor, scope);
    let current: ContactExternalClientLink;
    try {
      current = await scopedLink(scope, externalClientId);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.message === "ERR_ACESSORIAS_CLIENT_NOT_LINKED"
      ) {
        throw new AppError("ERR_ACESSORIAS_CONTEXT_CHANGED", 409);
      }
      throw error;
    }
    if (linkVersion(current) !== version)
      throw new AppError("ERR_ACESSORIAS_CONTEXT_CHANGED", 409);
    return {
      mode: "mock",
      simulated: true,
      client: result.client,
      pendingItems: result.pendingItems,
      pagination: result.pagination,
      source: result.source
    };
  });

const lockContact = async (scope: Scope, transaction: Transaction) => {
  const contact = await Contact.findOne({
    where: { id: scope.contactId, companyId: scope.companyId },
    attributes: ["id", "companyId"],
    transaction,
    lock: transaction.LOCK.UPDATE,
    logging: false
  });
  if (!contact || contact.companyId !== scope.companyId)
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
};

export const createAcessoriasLink = async (
  ticketId: string,
  actor: ContextActor,
  input: unknown,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    requireEmptyAcessoriasQuery(query);
    const externalClientId = parseAcessoriasLink(input);
    const { scope } = await access(ticketId, actor, true);
    const result = await catalog(scope.companyId);
    if (
      !result.clients.some(
        client => client.externalClientId === externalClientId
      )
    )
      throw new AppError("ERR_ACESSORIAS_CLIENT_NOT_FOUND", 404);
    const created = await sequelize.transaction(async transaction => {
      await lockContact(scope, transaction);
      await reauthorize(ticketId, actor, scope, true, true, transaction);
      const [, inserted] = await ContactExternalClientLink.findOrCreate({
        where: linkWhere(scope, externalClientId),
        defaults: linkWhere(scope, externalClientId),
        transaction,
        logging: false
      });
      await reauthorize(ticketId, actor, scope, true, true, transaction);
      return inserted;
    });
    return {
      externalClientId,
      linked: true,
      created,
      contactId: scope.contactId
    };
  });

export const deleteAcessoriasLink = async (
  ticketId: string,
  actor: ContextActor,
  externalId: unknown,
  query: Record<string, unknown>
) =>
  protectAcessorias(async () => {
    requireEmptyAcessoriasQuery(query);
    const externalClientId = parseExternalClientId(externalId);
    const { scope } = await access(ticketId, actor, true, false);
    const deleted = await sequelize.transaction(async transaction => {
      await lockContact(scope, transaction);
      await reauthorize(ticketId, actor, scope, true, false, transaction);
      const count = await ContactExternalClientLink.destroy({
        where: linkWhere(scope, externalClientId),
        transaction,
        logging: false
      });
      await reauthorize(ticketId, actor, scope, true, false, transaction);
      return count > 0;
    });
    return {
      externalClientId,
      linked: false,
      deleted,
      contactId: scope.contactId
    };
  });
