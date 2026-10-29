import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import Contact from "../../models/Contact";
import ContactExternalClientLink from "../../models/ContactExternalClientLink";
import {
  SCI_LIMITS,
  SCI_PROVIDER,
  sciMode,
  parseSciLink,
  parseSciPage,
  parseExternalClientId,
  requireEmptySciQuery,
  unwrapSciMock,
  validateSciCatalog,
  validateSciDetail
} from "../../helpers/SciRules";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import { MockSciRequest, requestMockSci } from "./MockSciProvider";

interface Scope {
  ticketId: number;
  companyId: number;
  contactId: number;
  queueId: number | null;
  isGroup: boolean;
  isAdmin: boolean;
}
const allowedErrors = new Set([
  "ERR_NO_PERMISSION",
  "ERR_NO_TICKET_FOUND",
  "ERR_SCI_INVALID_REQUEST",
  "ERR_SCI_DISABLED",
  "ERR_SCI_MANAGE_DENIED",
  "ERR_SCI_CLIENT_NOT_LINKED",
  "ERR_SCI_CLIENT_NOT_FOUND",
  "ERR_SCI_CONTEXT_CHANGED",
  "ERR_SCI_FUNCTIONAL_ERROR",
  "ERR_SCI_INVALID_OUTPUT",
  "ERR_SCI_UPSTREAM_UNAUTHORIZED",
  "ERR_SCI_RATE_LIMITED",
  "ERR_SCI_TIMEOUT",
  "ERR_SCI_UNAVAILABLE"
]);
const protectSci = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && allowedErrors.has(error.message))
      throw error;
    // ORM/adapter failures may include bound data. Only stable codes leave this boundary.
    throw new AppError("ERR_SCI_UNAVAILABLE", 503);
  }
};

const availability = async (companyId: number, transaction?: Transaction) => {
  const mode = sciMode();
  const rows =
    mode === "mock"
      ? await Setting.findAll({
          where: { companyId, key: "sciEnabled" },
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
    limits: { ...SCI_LIMITS }
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
    throw new AppError("ERR_SCI_MANAGE_DENIED", 403);
  const state = await availability(actor.companyId);
  if (requireEnabled && !state.enabled)
    throw new AppError("ERR_SCI_DISABLED", 403);
  const scope: Scope = {
    ticketId: ticket.id,
    companyId: actor.companyId,
    contactId: ticket.contactId,
    queueId: ticket.queueId,
    isGroup: ticket.isGroup === true,
    isAdmin: viewer.isAdmin
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
    throw new AppError("ERR_SCI_MANAGE_DENIED", 403);
  if (
    viewer.isAdmin !== scope.isAdmin ||
    ticket.queueId !== scope.queueId ||
    (ticket.isGroup === true) !== scope.isGroup
  )
    throw new AppError("ERR_SCI_CONTEXT_CHANGED", 409);
  if (
    requireEnabled &&
    !(await availability(actor.companyId, transaction)).enabled
  )
    throw new AppError("ERR_SCI_DISABLED", 403);
};

const mockRequest = async (request: MockSciRequest): Promise<unknown> => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    const response = await Promise.race([
      requestMockSci(request),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AppError("ERR_SCI_TIMEOUT", 504)),
          2000
        );
      })
    ]);
    return unwrapSciMock(response);
  } finally {
    clearTimeout(timer);
  }
};
const catalog = async (companyId: number) =>
  validateSciCatalog(
    await mockRequest({ operation: "catalog", companyId }),
    companyId
  );
const linkWhere = (scope: Scope, externalClientId?: string) => ({
  companyId: scope.companyId,
  contactId: scope.contactId,
  provider: SCI_PROVIDER,
  ...(externalClientId === undefined ? {} : { externalClientId })
});
const scopedLink = async (
  scope: Scope,
  externalClientId: string,
  transaction?: Transaction
) => {
  const link = await ContactExternalClientLink.findOne({
    where: linkWhere(scope, externalClientId),
    ...(transaction ? { transaction } : {}),
    logging: false
  });
  if (
    !link ||
    link.companyId !== scope.companyId ||
    link.contactId !== scope.contactId ||
    link.provider !== SCI_PROVIDER ||
    link.externalClientId !== externalClientId
  ) {
    throw new AppError("ERR_SCI_CLIENT_NOT_LINKED", 404);
  }
  return link;
};
const linkVersion = (link: ContactExternalClientLink): string =>
  JSON.stringify([
    link.id,
    link.externalClientId,
    new Date(link.updatedAt).toISOString()
  ]);
const scopedLinks = async (scope: Scope, transaction?: Transaction) => {
  const links = await ContactExternalClientLink.findAll({
    where: linkWhere(scope),
    ...(transaction ? { transaction } : {}),
    logging: false
  });
  return links.filter(
    link =>
      link.companyId === scope.companyId &&
      link.contactId === scope.contactId &&
      link.provider === SCI_PROVIDER
  );
};
const linksVersion = (links: ContactExternalClientLink[]): string =>
  JSON.stringify(links.map(linkVersion).sort());

export const ticketSciStatus = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    requireEmptySciQuery(query);
    const { scope, state, canManageLinks } = await access(
      ticketId,
      actor,
      false,
      false
    );
    await reauthorize(ticketId, actor, scope, false, false);
    return { ...state, canManageLinks };
  });

export const ticketSciCatalog = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    requireEmptySciQuery(query);
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

export const ticketSciClients = async (
  ticketId: string,
  actor: ContextActor,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    requireEmptySciQuery(query);
    const { scope } = await access(ticketId, actor);
    const links = await scopedLinks(scope);
    const version = linksVersion(links);
    const result = await catalog(scope.companyId);
    // Share the mutation lock: unlink/recreate cannot commit during final authorization.
    await sequelize.transaction(async transaction => {
      await lockContact(scope, transaction);
      if (linksVersion(await scopedLinks(scope, transaction)) !== version)
        throw new AppError("ERR_SCI_CONTEXT_CHANGED", 409);
      await reauthorize(ticketId, actor, scope, false, true, transaction);
    });
    const clients = links.map(link =>
      result.clients.find(
        client => client.externalClientId === link.externalClientId
      )
    );
    if (clients.some(client => !client))
      throw new AppError("ERR_SCI_CLIENT_NOT_FOUND", 404);
    return { mode: "mock", simulated: true, clients, source: result.source };
  });

export const ticketSciDetail = async (
  ticketId: string,
  actor: ContextActor,
  externalId: unknown,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    const externalClientId = parseExternalClientId(externalId);
    const page = parseSciPage(query);
    const { scope } = await access(ticketId, actor);
    const version = linkVersion(await scopedLink(scope, externalClientId));
    const result = validateSciDetail(
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
    await sequelize.transaction(async transaction => {
      await lockContact(scope, transaction);
      let current: ContactExternalClientLink;
      try {
        current = await scopedLink(scope, externalClientId, transaction);
      } catch (error) {
        if (
          error instanceof AppError &&
          error.message === "ERR_SCI_CLIENT_NOT_LINKED"
        ) {
          throw new AppError("ERR_SCI_CONTEXT_CHANGED", 409);
        }
        throw error;
      }
      if (linkVersion(current) !== version)
        throw new AppError("ERR_SCI_CONTEXT_CHANGED", 409);
      await reauthorize(ticketId, actor, scope, false, true, transaction);
    });
    return {
      mode: "mock",
      simulated: true,
      client: result.client,
      publications: result.publications,
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

export const createSciLink = async (
  ticketId: string,
  actor: ContextActor,
  input: unknown,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    requireEmptySciQuery(query);
    const externalClientId = parseSciLink(input);
    const { scope } = await access(ticketId, actor, true);
    const result = await catalog(scope.companyId);
    if (
      !result.clients.some(
        client => client.externalClientId === externalClientId
      )
    )
      throw new AppError("ERR_SCI_CLIENT_NOT_FOUND", 404);
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

export const deleteSciLink = async (
  ticketId: string,
  actor: ContextActor,
  externalId: unknown,
  query: Record<string, unknown>
) =>
  protectSci(async () => {
    requireEmptySciQuery(query);
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
