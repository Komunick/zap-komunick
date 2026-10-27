import { Op } from "sequelize";
import {
  generateTicketAssistant,
  ticketAssistantStatus
} from "../../services/AssistantServices/TicketAssistantService";
import { generateMockAssistant } from "../../services/AssistantServices/MockAssistantProvider";
import { createMockAssistantOutput } from "../../helpers/AssistantRules";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import Setting from "../../models/Setting";
import TicketNote from "../../models/TicketNote";

jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({
  findAll: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  upsert: jest.fn()
}));
jest.mock("../../models/TicketNote", () => ({
  findAll: jest.fn(),
  create: jest.fn()
}));
jest.mock("../../services/AssistantServices/MockAssistantProvider");

const actor = { userId: "101", companyId: 10 };
const ticket = {
  id: 301,
  companyId: 10,
  contactId: 201,
  queueId: 401,
  isGroup: false
};
const source = (overrides = {}) => ({
  id: "fixture-msg",
  companyId: 10,
  ticketId: 301,
  contactId: 201,
  body: "Fixture request",
  fromMe: false,
  isDeleted: false,
  mediaType: null,
  mediaUrl: null,
  thumbnailUrl: null,
  createdAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-27T12:00:00.000Z",
  ...overrides
});
const originalMode = process.env.AI_ASSISTANT_MODE;
const generate = (kind = "summary") =>
  generateTicketAssistant("301", actor, { kind });

describe("ticket assistant authorization, mock-only execution and revalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_ASSISTANT_MODE = "mock";
    (User.findOne as jest.Mock).mockResolvedValue({
      id: 101,
      companyId: 10,
      profile: "user",
      queues: [{ id: 401, companyId: 10 }]
    });
    (Ticket.findOne as jest.Mock).mockResolvedValue({ ...ticket });
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 201,
      companyId: 10
    });
    (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "enabled" }]);
    (Message.findAll as jest.Mock).mockResolvedValue([source()]);
    (generateMockAssistant as jest.Mock).mockImplementation(
      async (kind, messages) => createMockAssistantOutput(kind, messages)
    );
  });
  afterAll(() => {
    if (originalMode === undefined) delete process.env.AI_ASSISTANT_MODE;
    else process.env.AI_ASSISTANT_MODE = originalMode;
  });

  it.each([undefined, "", "disabled", "openai", "real", "MOCK"])(
    "fails closed for server mode %s",
    async mode => {
      if (mode === undefined) delete process.env.AI_ASSISTANT_MODE;
      else process.env.AI_ASSISTANT_MODE = mode;
      await expect(ticketAssistantStatus("301", actor)).resolves.toEqual({
        enabled: false,
        mode: "disabled",
        simulated: true,
        reason: "SERVER_DISABLED",
        limits: { maxMessages: 30, maxCharacters: 12000 }
      });
      await expect(generate()).rejects.toMatchObject({
        message: "ERR_ASSISTANT_DISABLED",
        statusCode: 403
      });
      expect(Message.findAll).not.toHaveBeenCalled();
      expect(generateMockAssistant).not.toHaveBeenCalled();
    }
  );

  it.each(
    [
      [],
      [{ value: "disabled" }],
      [{ value: "invalid" }],
      [{ value: "enabled" }, { value: "disabled" }]
    ].map(settings => [settings])
  )("requires an unambiguous enabled company flag", async settings => {
    (Setting.findAll as jest.Mock).mockResolvedValue(settings);
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_ASSISTANT_DISABLED"
    });
    expect(Setting.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 10, key: "aiAssistantEnabled" },
        attributes: ["value"],
        logging: false
      })
    );
    expect(generateMockAssistant).not.toHaveBeenCalled();
  });

  it.each(
    [[], [{ id: 402, companyId: 10 }], [{ id: 401, companyId: 20 }]].map(
      queues => [queues]
    )
  )("requires the attendant's current authorized sector", async queues => {
    (User.findOne as jest.Mock).mockResolvedValue({
      companyId: 10,
      profile: "user",
      queues
    });
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    await expect(ticketAssistantStatus("301", actor)).rejects.toMatchObject({
      statusCode: 403
    });
    expect(generateMockAssistant).not.toHaveBeenCalled();
    expect(Message.findAll).not.toHaveBeenCalled();
  });

  it("denies a cross-company ticket, contact and actor without loading messages", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    await expect(generate()).rejects.toMatchObject({ statusCode: 404 });
    expect(Ticket.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "301", companyId: 10 } })
    );
    (Ticket.findOne as jest.Mock).mockResolvedValue({ ...ticket });
    (Contact.findOne as jest.Mock).mockResolvedValue(null);
    await expect(generate()).rejects.toMatchObject({ statusCode: 404 });
    (User.findOne as jest.Mock).mockResolvedValue(null);
    await expect(generate()).rejects.toMatchObject({ statusCode: 403 });
    expect(Message.findAll).not.toHaveBeenCalled();
  });

  it.each(["admin", "user"])(
    "allows %s only in the authorized current ticket with no writes, notes or credentials",
    async profile => {
      (User.findOne as jest.Mock).mockResolvedValue({
        companyId: 10,
        profile,
        queues: profile === "admin" ? [] : [{ id: 401, companyId: 10 }]
      });
      (Message.findAll as jest.Mock).mockResolvedValue([
        source(),
        source({
          id: "other-office",
          companyId: 20,
          body: "FOREIGN_OFFICE_CANARY"
        }),
        source({ id: "older-ticket", ticketId: 302, body: "HISTORY_CANARY" }),
        source({
          id: "other-client",
          contactId: 202,
          body: "OTHER_CLIENT_CANARY"
        })
      ]);
      const result = await generate();
      expect(result).toMatchObject({
        ticketId: 301,
        contactId: 201,
        kind: "summary",
        mode: "mock",
        simulated: true,
        requiresReview: true,
        references: [{ messageId: "fixture-msg", excerpt: "Fixture request" }],
        context: { messageCount: 1, partial: false }
      });
      expect(JSON.stringify(result)).not.toMatch(
        /FOREIGN_OFFICE_CANARY|HISTORY_CANARY|OTHER_CLIENT_CANARY/
      );
      const options = (Message.findAll as jest.Mock).mock.calls[0][0];
      expect(options.where[Op.and][0]).toEqual({
        companyId: 10,
        ticketId: 301,
        isDeleted: false
      });
      expect(options).toMatchObject({ limit: 31, raw: true, logging: false });
      expect(Setting.findAll).toHaveBeenCalledTimes(2);
      expect(TicketNote.findAll).not.toHaveBeenCalled();
      expect(TicketNote.create).not.toHaveBeenCalled();
      expect(Message.update).not.toHaveBeenCalled();
      expect(Message.create).not.toHaveBeenCalled();
      expect(Message.upsert).not.toHaveBeenCalled();
      expect(Ticket.update).not.toHaveBeenCalled();
      expect(Setting.update).not.toHaveBeenCalled();
      expect(
        Object.isFrozen((generateMockAssistant as jest.Mock).mock.calls[0][1])
      ).toBe(true);
    }
  );

  it("allows an authenticated group participant only within the company", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue({
      ...ticket,
      isGroup: true
    });
    (Message.findAll as jest.Mock).mockResolvedValue([
      source({ id: "member", contactId: 202, "contact.companyId": 10 }),
      source({
        id: "foreign-member",
        contactId: 203,
        "contact.companyId": 20,
        body: "FOREIGN_MEMBER_CANARY"
      })
    ]);
    const result = await generate();
    expect(result.references.map(row => row.messageId)).toEqual(["member"]);
    expect(JSON.stringify(result)).not.toContain("FOREIGN_MEMBER_CANARY");
    expect(Message.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: [
          expect.objectContaining({
            as: "contact",
            where: { companyId: 10 },
            required: false
          })
        ]
      })
    );
  });

  it("filters blank message bodies in SQL before the bounded context window", async () => {
    await generate();
    const conditions = (Message.findAll as jest.Mock).mock.calls[0][0].where[
      Op.and
    ];
    expect(conditions).toContainEqual(
      expect.objectContaining({
        val: '"Message"."body" ~ \'[^[:space:]]\''
      })
    );
  });

  it("rejects extraneous client context before provider or message query", async () => {
    await expect(
      generateTicketAssistant("301", actor, { kind: "summary", contactId: 999 })
    ).rejects.toMatchObject({
      message: "ERR_ASSISTANT_INVALID_REQUEST",
      statusCode: 400
    });
    expect(Message.findAll).not.toHaveBeenCalled();
    expect(generateMockAssistant).not.toHaveBeenCalled();
  });

  it.each(["edited", "deleted", "removed", "new-message"])(
    "refuses stale context when a message is %s while generating",
    async change => {
      const changed =
        change === "removed"
          ? []
          : change === "new-message"
            ? [source(), source({ id: "new", body: "new input" })]
            : [
                source(
                  change === "edited"
                    ? {
                        body: "edited content",
                        updatedAt: "2026-10-27T12:01:00Z"
                      }
                    : { isDeleted: true }
                )
              ];
      (Message.findAll as jest.Mock)
        .mockResolvedValueOnce([source()])
        .mockResolvedValueOnce(changed);
      await expect(generate()).rejects.toMatchObject({
        message: "ERR_ASSISTANT_CONTEXT_CHANGED",
        statusCode: 409
      });
    }
  );

  it("reauthorizes after provider execution and refuses a revoked role or sector", async () => {
    (User.findOne as jest.Mock)
      .mockResolvedValueOnce({
        companyId: 10,
        profile: "user",
        queues: [{ id: 401, companyId: 10 }]
      })
      .mockResolvedValueOnce({ companyId: 10, profile: "user", queues: [] });
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    expect(generateMockAssistant).toHaveBeenCalledTimes(1);
  });

  it("refuses transfer or group changes even when the user still has access", async () => {
    (User.findOne as jest.Mock).mockResolvedValue({
      companyId: 10,
      profile: "admin",
      queues: []
    });
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce({ ...ticket })
      .mockResolvedValueOnce({ ...ticket, queueId: 402 });
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_ASSISTANT_CONTEXT_CHANGED"
    });
  });

  it("refuses changes to the client or company during generation", async () => {
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce({ ...ticket })
      .mockResolvedValueOnce({ ...ticket, contactId: 202 });
    await expect(generate()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses company disable or server mode change during generation", async () => {
    (Setting.findAll as jest.Mock)
      .mockResolvedValueOnce([{ value: "enabled" }])
      .mockResolvedValueOnce([{ value: "disabled" }]);
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_ASSISTANT_DISABLED"
    });
    (Setting.findAll as jest.Mock).mockResolvedValue([{ value: "enabled" }]);
    (generateMockAssistant as jest.Mock).mockImplementation(
      async (kind, messages) => {
        process.env.AI_ASSISTANT_MODE = "disabled";
        return createMockAssistantOutput(kind, messages);
      }
    );
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_ASSISTANT_DISABLED"
    });
  });

  it("rejects malformed provider output and masks thrown content, including AppErrors", async () => {
    (generateMockAssistant as jest.Mock).mockResolvedValue({
      kind: "summary",
      text: "Invented fact",
      references: [{ messageId: "foreign", excerpt: "FOREIGN_CANARY" }]
    });
    await expect(generate()).rejects.toMatchObject({
      message: "ERR_ASSISTANT_INVALID_OUTPUT",
      statusCode: 502
    });
    (generateMockAssistant as jest.Mock).mockRejectedValue(
      new AppError("PROVIDER_CONTENT_CANARY", 400)
    );
    const error = await generate().catch(failure => failure);
    expect(error).toMatchObject({
      message: "ERR_ASSISTANT_UNAVAILABLE",
      statusCode: 503
    });
    expect(JSON.stringify(error)).not.toContain("PROVIDER_CONTENT_CANARY");
  });

  it("returns explicit empty and partial context indicators", async () => {
    (Message.findAll as jest.Mock).mockResolvedValue([]);
    const empty = await generate("reply");
    expect(empty.references).toEqual([]);
    expect(empty.warnings).toEqual([
      "SIMULATED",
      "REVIEW_REQUIRED",
      "INSUFFICIENT_INFORMATION",
      "NO_MESSAGES"
    ]);
    (Message.findAll as jest.Mock).mockResolvedValue(
      Array.from({ length: 31 }, (_, i) =>
        source({ id: `m${i}`, body: "x".repeat(1000) })
      )
    );
    const partial = await generate();
    expect(partial.context.characterCount).toBe(12000);
    expect(partial.context.messageCount).toBe(12);
    expect(partial.context.partial).toBe(true);
    expect(partial.warnings).toContain("PARTIAL_CONTEXT");
  });

  it("bounds a stalled provider and returns no output", async () => {
    jest.useFakeTimers();
    try {
      (generateMockAssistant as jest.Mock).mockReturnValue(
        new Promise(() => undefined)
      );
      const pending = generate();
      const result = expect(pending).rejects.toMatchObject({
        message: "ERR_ASSISTANT_UNAVAILABLE",
        statusCode: 503
      });
      for (let step = 0; step < 20; step += 1) await Promise.resolve();
      jest.advanceTimersByTime(2001);
      await result;
    } finally {
      jest.useRealTimers();
    }
  });
});
