import { Op } from "sequelize";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Setting from "../../models/Setting";
import Message from "../../models/Message";
import { openAttachmentFile } from "../../services/AttachmentServices/AttachmentFileService";
import {
  getTicketAttachment,
  listTicketAttachments,
  openTicketAttachment
} from "../../services/AttachmentServices/TicketAttachmentService";
import {
  encodeAttachmentCursor,
  MAX_ATTACHMENT_PREVIEW_BYTES
} from "../../helpers/AttachmentRules";
import AppError from "../../errors/AppError";

jest.mock("../../models/User", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Ticket", () => ({
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/Setting", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Message", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  upsert: jest.fn()
}));
jest.mock("../../services/AttachmentServices/AttachmentFileService", () => ({
  openAttachmentFile: jest.fn()
}));

type Values = Record<string, unknown>;
type Predicate = Record<string | symbol, unknown>;
// Small generic evaluator for the ORM predicates: fixture expectations below
// define which clients/messages may be visible, independently of service output.
const matches = (row: Values, condition: Predicate): boolean => {
  if ("attribute" in condition && "logic" in condition) {
    const attribute = condition.attribute as { fn: string };
    const logic = condition.logic as Predicate | string;
    const actual =
      attribute.fn === "date_trunc"
        ? new Date(String(row.createdAt)).toISOString()
        : String(row.mediaUrl).toLowerCase();
    if (typeof logic === "string") return actual === logic;
    if (Op.lt in logic) return actual < logic[Op.lt];
    if (Op.regexp in logic)
      return new RegExp(String(logic[Op.regexp])).test(actual);
    if (Op.notRegexp in logic)
      return !new RegExp(String(logic[Op.notRegexp])).test(actual);
    throw new Error("Unknown test expression");
  }
  return Reflect.ownKeys(condition).every(key => {
    const value = condition[key];
    if (key === Op.and)
      return (value as Predicate[]).every(item => matches(row, item));
    if (key === Op.or)
      return (value as Predicate[]).some(item => matches(row, item));
    const actual = row[key as string];
    if (!value || typeof value !== "object") return actual === value;
    return Reflect.ownKeys(value).every(operator => {
      const target = (value as Predicate)[operator];
      if (operator === Op.ne) return actual !== target;
      if (operator === Op.in) return (target as unknown[]).includes(actual);
      if (operator === Op.notIn) return !(target as unknown[]).includes(actual);
      if (operator === Op.lt) return actual < target;
      throw new Error("Unknown test predicate");
    });
  });
};
const actor = { userId: "101", companyId: 10 };
const date = "2026-10-27T12:00:00.000Z";
const message = (id: string, ticketId = 301, overrides: Values = {}) => ({
  id,
  ticketId,
  companyId: 10,
  queueId: 401,
  mediaUrl: `media/10/201/${ticketId}/${id}.pdf`,
  mediaType: "application",
  dataJson: null,
  createdAt: date,
  updatedAt: date,
  isDeleted: false,
  body: "PRIVATE_BODY_CANARY",
  ...overrides
});
const model = (row: Values) =>
  ({ ...row, getDataValue: (key: string) => row[key] }) as unknown as Message;
let rows: Values[];
let tickets: Values[];
let profile: string;
let queues: number[];
let visibility: string;
let close: jest.Mock;
const ormRows = (options: {
  where: Predicate;
  include?: { where: Predicate }[];
  limit?: number;
  order?: unknown;
}) => {
  let result = rows.filter(row => matches(row, options.where));
  if (options.include)
    result = result.filter(row =>
      tickets.some(
        ticket =>
          ticket.id === row.ticketId &&
          matches(ticket, options.include[0].where)
      )
    );
  result.sort(
    (a, b) =>
      new Date(String(b.createdAt))
        .toISOString()
        .localeCompare(new Date(String(a.createdAt)).toISOString()) ||
      String(b.id).localeCompare(String(a.id)) ||
      Number(b.ticketId) - Number(a.ticketId)
  );
  if (options.limit) result = result.slice(0, options.limit);
  return result.map(model);
};
describe("authorized attachment history and descriptor lifecycle", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    rows = [message("current")];
    tickets = [
      { id: 301, companyId: 10, contactId: 201, queueId: 401, isGroup: false },
      { id: 300, companyId: 10, contactId: 201, queueId: 402, isGroup: false },
      { id: 302, companyId: 10, contactId: 202, queueId: 401, isGroup: false },
      { id: 501, companyId: 20, contactId: 601, queueId: 401, isGroup: false }
    ];
    profile = "user";
    queues = [401];
    visibility = "message";
    close = jest.fn().mockResolvedValue(undefined);
    (User.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      where.companyId === 10
        ? {
            id: 101,
            companyId: 10,
            profile,
            queues: queues.map(id => ({ id, companyId: 10 }))
          }
        : null
    );
    (Ticket.findOne as jest.Mock).mockImplementation(
      async ({ where }) =>
        tickets.find(row =>
          matches(
            row,
            Object.fromEntries(
              Object.entries(where).map(([key, value]) => [
                key,
                key === "id" ? Number(value) : value
              ])
            )
          )
        ) || null
    );
    (Contact.findOne as jest.Mock).mockImplementation(async ({ where }) =>
      where.companyId === 10 ? { id: where.id, companyId: 10 } : null
    );
    (Setting.findOne as jest.Mock).mockImplementation(async () => ({
      value: visibility
    }));
    (Message.findOne as jest.Mock).mockImplementation(
      async options => ormRows(options)[0] || null
    );
    (Message.findAll as jest.Mock).mockImplementation(async options =>
      ormRows(options)
    );
    (openAttachmentFile as jest.Mock).mockResolvedValue({
      handle: { close },
      size: 50,
      mimeType: "application/pdf"
    });
  });
  const list = (query = {}) => listTicketAttachments("301", actor, query);
  const detail = (source = "301", id = "current") =>
    getTicketAttachment("301", actor, source, id, {});
  const content = () =>
    openTicketAttachment("301", actor, "301", "current", {});
  it("returns only the exact DTO, without body/JSON/filesystem paths and without side effects", async () => {
    const result = await list();
    expect(result).toEqual({
      items: [
        {
          messageId: "current",
          sourceTicketId: 301,
          createdAt: date,
          fileName: "current.pdf",
          kind: "pdf",
          sizeBytes: 50,
          mimeType: "application/pdf",
          storage: "local",
          previewSupported: true,
          previewReason: "available",
          contentPath: "/tickets/301/attachments/301/current/content",
          legacyUrl: expect.stringContaining("/public/media/10/")
        }
      ],
      hasMore: false,
      nextCursor: null
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_BODY_CANARY");
    expect(Ticket.update).not.toHaveBeenCalled();
    expect(Message.update).not.toHaveBeenCalled();
    expect(Message.create).not.toHaveBeenCalled();
    expect(Message.upsert).not.toHaveBeenCalled();
    const options = (Message.findAll as jest.Mock).mock.calls[0][0];
    expect(options.attributes).not.toContain("body");
    expect(options.logging).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("preserves RF-017: all current ticket context, permitted/null historical queues, only the same client and company", async () => {
    rows = [
      message("today", 301, { queueId: 402 }),
      message("old-allowed", 300, { queueId: 401 }),
      message("old-null", 300, { queueId: null }),
      message("old-denied", 300, { queueId: 402 }),
      message("other-client", 302),
      message("other-office", 501, { companyId: 20 }),
      message("deleted", 301, { isDeleted: true }),
      message("reaction", 301, { mediaType: "reactionMessage" }),
      message("note", 301, { mediaType: "transferNote" }),
      message("text", 301, { mediaUrl: null })
    ];
    expect((await list()).items.map(item => item.messageId).sort()).toEqual([
      "old-allowed",
      "old-null",
      "today"
    ]);
    await expect(detail("300", "old-denied")).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION",
      statusCode: 403
    });
    visibility = "ticket";
    expect((await list()).items.map(item => item.messageId).sort()).toEqual([
      "old-allowed",
      "old-denied",
      "old-null",
      "today"
    ]);
  });
  it("keeps admin within its office and denies attendants without a permitted sector", async () => {
    queues = [];
    await expect(list()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION"
    });
    expect(openAttachmentFile).not.toHaveBeenCalled();
    profile = "admin";
    rows.push(message("foreign", 501, { companyId: 20 }));
    expect((await list()).items.map(item => item.messageId)).toEqual([
      "current"
    ]);
  });
  it("disambiguates the composite message PK instead of reading a same-ID foreign ticket", async () => {
    rows = [
      message("same", 302),
      message("same", 300, { queueId: 401 }),
      message("same", 301)
    ];
    const result = await detail("300", "same");
    expect(result.sourceTicketId).toBe(300);
    expect(result.contentPath).toContain("/300/same/");
    await expect(detail("302", "same")).rejects.toMatchObject({
      statusCode: 404
    });
  });
  it("paginates equal timestamps and equal IDs stably with the source ticket tie breaker", async () => {
    rows = [
      message("same", 300),
      message("same", 301),
      message("first", 301, { createdAt: "2026-10-27T11:00:00.000Z" })
    ];
    const first = await list({ limit: "1" });
    expect(first.items[0].sourceTicketId).toBe(301);
    expect(first.hasMore).toBe(true);
    const second = await list({ limit: "1", cursor: first.nextCursor });
    expect(second.items[0].sourceTicketId).toBe(300);
    const third = await list({ limit: "1", cursor: second.nextCursor });
    expect(third.items[0].messageId).toBe("first");
    expect(third.nextCursor).toBeNull();
  });
  it("uses the same millisecond precision for ordering and seeking despite database microseconds", async () => {
    rows = [
      message("same", 301, { createdAt: "2026-10-27T12:00:00.123100Z" }),
      message("same", 300, { createdAt: "2026-10-27T12:00:00.123900Z" })
    ];
    const first = await list({ limit: "1" });
    const second = await list({ limit: "1", cursor: first.nextCursor });
    expect([
      first.items[0].sourceTicketId,
      second.items[0].sourceTicketId
    ]).toEqual([301, 300]);
    expect(second.nextCursor).toBeNull();
  });
  it.each([
    ["pdf", ["pdf"]],
    ["image", ["image"]],
    ["video", ["video"]],
    ["other", ["office"]]
  ])("filters %s before pagination", async (kind, expected) => {
    rows = [
      message("pdf"),
      message("image", 301, { mediaUrl: "media/10/x/a.PNG" }),
      message("video", 301, { mediaUrl: "media/10/x/a.mp4" }),
      message("office", 301, { mediaUrl: "media/10/x/a.docx" })
    ];
    expect((await list({ kind })).items.map(item => item.messageId)).toEqual(
      expected
    );
  });
  it("reapplies tenant/client authorization to a cursor copied from another company", async () => {
    rows.push(
      message("foreign", 501, {
        companyId: 20,
        createdAt: "2026-10-27T10:00:00.000Z"
      })
    );
    const cursor = encodeAttachmentCursor({
      id: "foreign",
      ticketId: 501,
      createdAt: "2026-10-28T00:00:00.000Z"
    });
    expect((await list({ cursor })).items.map(item => item.messageId)).toEqual([
      "current"
    ]);
  });
  it.each(["deleted", "reaction", "note", "text"])(
    "cannot open excluded %s by its ID",
    async id => {
      rows.push(
        message(id, 301, {
          ...(id === "deleted" ? { isDeleted: true } : {}),
          ...(id === "reaction" ? { mediaType: "reactionMessage" } : {}),
          ...(id === "note" ? { mediaType: "transferNote" } : {}),
          ...(id === "text" ? { mediaUrl: null } : {})
        })
      );
      await expect(detail("301", id)).rejects.toMatchObject({
        statusCode: 404
      });
    }
  );
  it("classifies PDF without JSON, handles missing files and never fetches external URLs", async () => {
    rows = [
      message("external", 301, { mediaUrl: "https://example.test/fiction.pdf" })
    ];
    const external = await detail("301", "external");
    expect(external).toMatchObject({
      storage: "external",
      kind: "pdf",
      mimeType: null,
      previewReason: "external",
      contentPath: null
    });
    expect(openAttachmentFile).not.toHaveBeenCalled();
    await expect(
      openTicketAttachment("301", actor, "301", "external", {})
    ).rejects.toMatchObject({ statusCode: 415 });
    rows = [message("current")];
    (openAttachmentFile as jest.Mock).mockRejectedValue(
      new AppError("ERR_ATTACHMENT_NOT_FOUND", 404)
    );
    expect(await detail()).toMatchObject({
      storage: "unavailable",
      previewReason: "missing",
      legacyUrl: null
    });
  });
  it.each([
    [MAX_ATTACHMENT_PREVIEW_BYTES + 1, "application/pdf", "too_large", 413],
    [50, null, "unsupported", 415]
  ])(
    "enforces size/type for metadata and bytes",
    async (size, mimeType, reason, statusCode) => {
      (openAttachmentFile as jest.Mock).mockResolvedValue({
        handle: { close },
        size,
        mimeType
      });
      expect(await detail()).toMatchObject({
        previewSupported: false,
        previewReason: reason,
        contentPath: null
      });
      await expect(content()).rejects.toMatchObject({ statusCode });
      expect(close).toHaveBeenCalledTimes(2);
    }
  );
  it("allows exactly the 25 MiB bound and leaves ownership of a valid descriptor to the controller", async () => {
    (openAttachmentFile as jest.Mock).mockResolvedValue({
      handle: { close },
      size: MAX_ATTACHMENT_PREVIEW_BYTES,
      mimeType: "application/pdf"
    });
    const file = await content();
    expect(file.size).toBe(MAX_ATTACHMENT_PREVIEW_BYTES);
    expect(close).not.toHaveBeenCalled();
    await file.handle.close();
  });
  it.each([
    "permission",
    "transfer",
    "client",
    "visibility",
    "deleted",
    "edited",
    "removed"
  ])(
    "rejects %s changes during filesystem await and closes the descriptor",
    async change => {
      (openAttachmentFile as jest.Mock).mockImplementation(async () => {
        if (change === "permission") queues = [];
        if (change === "transfer") tickets[0].queueId = 402;
        if (change === "client") tickets[0].contactId = 202;
        if (change === "visibility") visibility = "ticket";
        if (change === "deleted") rows[0].isDeleted = true;
        if (change === "edited") rows[0].mediaUrl = "media/10/other.pdf";
        if (change === "removed") rows = [];
        return { handle: { close }, size: 50, mimeType: "application/pdf" };
      });
      await expect(content()).rejects.toMatchObject({
        statusCode: expect.any(Number)
      });
      expect(close).toHaveBeenCalledTimes(1);
    }
  );
  it("normalizes ORM errors that could contain SQL/filenames", async () => {
    (Message.findAll as jest.Mock).mockRejectedValue(
      new Error("SQL_FILE_CANARY")
    );
    await expect(list()).rejects.toMatchObject({
      message: "ERR_ATTACHMENT_UNAVAILABLE",
      statusCode: 503
    });
  });
  it("revalidates an empty list and denies a permission removed before its response", async () => {
    rows = [];
    (Message.findAll as jest.Mock).mockImplementationOnce(async () => {
      queues = [];
      return [];
    });
    await expect(list()).rejects.toMatchObject({
      message: "ERR_NO_PERMISSION"
    });
  });
  it("does not return list metadata if a row disappears during its filesystem read", async () => {
    (openAttachmentFile as jest.Mock).mockImplementation(async () => {
      rows = [];
      return { handle: { close }, size: 50, mimeType: "application/pdf" };
    });
    await expect(list()).rejects.toMatchObject({
      message: "ERR_ATTACHMENT_CONTEXT_CHANGED",
      statusCode: 409
    });
    expect(close).toHaveBeenCalledTimes(1);
  });
});
