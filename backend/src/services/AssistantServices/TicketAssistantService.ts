import { Op, col, fn, literal } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import {
  ASSISTANT_LIMITS,
  AssistantKind,
  AssistantScope,
  AssistantSource,
  assistantMode,
  buildAssistantContext,
  parseAssistantRequest,
  validateAssistantOutput
} from "../../helpers/AssistantRules";
import AuthorizeTicketContextService, {
  ContextActor
} from "../TicketServices/AuthorizeTicketContextService";
import { generateMockAssistant } from "./MockAssistantProvider";

const safeErrors = new Set([
  "ERR_NO_PERMISSION",
  "ERR_NO_TICKET_FOUND",
  "ERR_ASSISTANT_DISABLED",
  "ERR_ASSISTANT_INVALID_REQUEST",
  "ERR_ASSISTANT_CONTEXT_CHANGED",
  "ERR_ASSISTANT_INVALID_OUTPUT",
  "ERR_ASSISTANT_UNAVAILABLE"
]);
const protectAssistant = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError && safeErrors.has(error.message)) throw error;
    // Provider/ORM errors can contain conversation text. Never forward raw errors.
    throw new AppError("ERR_ASSISTANT_UNAVAILABLE", 503);
  }
};

const companyEnabled = async (companyId: number): Promise<boolean> => {
  const settings = await Setting.findAll({
    where: { companyId, key: "aiAssistantEnabled" },
    attributes: ["value"],
    logging: false
  });
  return (
    settings.length > 0 &&
    settings.every(setting => setting.value === "enabled")
  );
};

const availability = async (companyId: number) => {
  const mode = assistantMode();
  const enabled = mode === "mock" && (await companyEnabled(companyId));
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
    limits: { ...ASSISTANT_LIMITS }
  };
};

export const ticketAssistantStatus = async (
  ticketId: string,
  actor: ContextActor
) =>
  protectAssistant(async () => {
    await AuthorizeTicketContextService(ticketId, actor);
    return availability(actor.companyId);
  });

const loadContext = async (scope: AssistantScope) => {
  const rows = await Message.findAll({
    where: {
      [Op.and]: [
        {
          companyId: scope.companyId,
          ticketId: scope.ticketId,
          isDeleted: false
        },
        // Empty/whitespace messages must not consume the bounded text window.
        literal('"Message"."body" ~ \'[^[:space:]]\''),
        {
          [Op.or]: [
            { mediaType: null },
            { mediaType: { [Op.in]: ["conversation", "extendedTextMessage"] } }
          ]
        },
        { [Op.or]: [{ mediaUrl: null }, { mediaUrl: "" }] },
        { [Op.or]: [{ thumbnailUrl: null }, { thumbnailUrl: "" }] },
        {
          [Op.or]: [
            { fromMe: true, contactId: null },
            scope.isGroup
              ? { "$contact.companyId$": scope.companyId }
              : { contactId: scope.contactId }
          ]
        }
      ]
    },
    attributes: [
      "id",
      "companyId",
      "ticketId",
      "contactId",
      "fromMe",
      "isDeleted",
      "mediaType",
      "mediaUrl",
      "thumbnailUrl",
      "createdAt",
      "updatedAt",
      [
        fn("left", col("Message.body"), ASSISTANT_LIMITS.maxCharacters + 1),
        "body"
      ],
      [
        literal(
          `char_length("Message"."body") > ${ASSISTANT_LIMITS.maxCharacters + 1}`
        ),
        "bodyTruncated"
      ]
    ],
    ...(scope.isGroup
      ? {
          include: [
            {
              model: Contact,
              as: "contact",
              attributes: ["id", "companyId"],
              where: { companyId: scope.companyId },
              required: false
            }
          ]
        }
      : {}),
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    limit: ASSISTANT_LIMITS.maxMessages + 1,
    raw: true,
    logging: false
  });
  return buildAssistantContext(
    rows.map(row => ({
      ...(row as unknown as AssistantSource),
      senderCompanyId: (row as unknown as Record<string, number>)[
        "contact.companyId"
      ]
    })),
    scope
  );
};

const timedMock = async (
  kind: AssistantKind,
  messages: Parameters<typeof generateMockAssistant>[1]
) => {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      generateMockAssistant(kind, messages),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AppError("ERR_ASSISTANT_UNAVAILABLE", 503)),
          2000
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export const generateTicketAssistant = async (
  ticketId: string,
  actor: ContextActor,
  input: unknown
) =>
  protectAssistant(async () => {
    const kind = parseAssistantRequest(input);
    const { ticket } = await AuthorizeTicketContextService(ticketId, actor);
    if (!(await availability(actor.companyId)).enabled)
      throw new AppError("ERR_ASSISTANT_DISABLED", 403);
    const scope: AssistantScope = {
      ticketId: ticket.id,
      companyId: ticket.companyId,
      contactId: ticket.contactId,
      isGroup: ticket.isGroup === true
    };
    const queueId = ticket.queueId;
    const context = await loadContext(scope);
    const messages = context.messages.map(message =>
      Object.freeze({ ...message })
    );
    Object.freeze(messages);
    const rawOutput = await timedMock(kind, messages);
    const output = validateAssistantOutput(rawOutput, kind, context.messages);
    const { ticket: current } = await AuthorizeTicketContextService(
      ticketId,
      actor,
      scope.contactId
    );
    if (
      current.queueId !== queueId ||
      (current.isGroup === true) !== scope.isGroup
    ) {
      throw new AppError("ERR_ASSISTANT_CONTEXT_CHANGED", 409);
    }
    if (!(await availability(actor.companyId)).enabled)
      throw new AppError("ERR_ASSISTANT_DISABLED", 403);
    const freshContext = await loadContext(scope);
    if (JSON.stringify(freshContext) !== JSON.stringify(context)) {
      throw new AppError("ERR_ASSISTANT_CONTEXT_CHANGED", 409);
    }
    return {
      ticketId: scope.ticketId,
      contactId: scope.contactId,
      kind,
      mode: "mock",
      simulated: true,
      requiresReview: true,
      text: output.text,
      references: output.references,
      context: {
        ...ASSISTANT_LIMITS,
        messageCount: context.messageCount,
        characterCount: context.characterCount,
        partial: context.partial
      },
      warnings: [
        "SIMULATED",
        "REVIEW_REQUIRED",
        ...(context.partial ? ["PARTIAL_CONTEXT"] : []),
        ...(kind === "reply" ? ["INSUFFICIENT_INFORMATION"] : []),
        ...(!context.messageCount ? ["NO_MESSAGES"] : [])
      ],
      generatedAt: new Date().toISOString()
    };
  });
