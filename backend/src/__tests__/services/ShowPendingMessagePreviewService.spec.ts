import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import ShowPendingMessagePreviewService, {
  MAX_PREVIEW_MESSAGES
} from "../../services/MessageServices/ShowPendingMessagePreviewService";

jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({ update: jest.fn() }));
jest.mock("../../services/TicketServices/AuthorizeTicketContextService", () =>
  jest.fn()
);

const authorize = AuthorizeTicketContextService as jest.Mock;
const findAll = Message.findAll as jest.Mock;
const actor = { userId: 101, companyId: 10 };
const at = (minute: number) => new Date(Date.UTC(2026, 10, 17, 12, minute, 0));
const ticketUpdate = jest.fn();

// findAll returns newest first, as the query orders it.
const row = (
  id: string,
  minute: number,
  extra: Record<string, unknown> = {}
) => ({
  id,
  body: `Mensagem fictícia ${id}`,
  mediaType: null,
  fromMe: false,
  createdAt: at(minute),
  ...extra
});

beforeEach(() => {
  jest.resetAllMocks();
  authorize.mockResolvedValue({
    ticket: { id: 301, queueId: 20, update: ticketUpdate }
  });
});

test("denied queue access does not query messages", async () => {
  const denied = new AppError("ERR_NO_PERMISSION", 403);
  authorize.mockRejectedValue(denied);

  await expect(ShowPendingMessagePreviewService("301", actor)).rejects.toBe(
    denied
  );
  expect(findAll).not.toHaveBeenCalled();
});

test("returns the whole conversation in order, both directions", async () => {
  findAll.mockResolvedValue([
    row("m3", 3),
    row("m2", 2, { fromMe: true, body: "Escolha um setor" }),
    row("m1", 1, { body: "Bom dia" })
  ]);

  await expect(ShowPendingMessagePreviewService("301", actor)).resolves.toEqual(
    {
      truncated: false,
      messages: [
        {
          id: "m1",
          fromMe: false,
          createdAt: at(1),
          kind: "text",
          text: "Bom dia"
        },
        {
          id: "m2",
          fromMe: true,
          createdAt: at(2),
          kind: "text",
          text: "Escolha um setor"
        },
        {
          id: "m3",
          fromMe: false,
          createdAt: at(3),
          kind: "text",
          text: "Mensagem fictícia m3"
        }
      ]
    }
  );
});

test("reads only the exact still-pending ticket of the authorized queue", async () => {
  findAll.mockResolvedValue([]);

  await ShowPendingMessagePreviewService("301", actor);

  expect(authorize).toHaveBeenCalledWith("301", actor);
  expect(findAll).toHaveBeenCalledWith(
    expect.objectContaining({
      attributes: ["id", "body", "mediaType", "fromMe", "createdAt"],
      where: expect.objectContaining({
        companyId: 10,
        ticketId: 301,
        isDeleted: false,
        id: { [Op.notLike]: "%-301" }
      }),
      include: [
        expect.objectContaining({
          required: true,
          where: { companyId: 10, status: "pending", queueId: 20 }
        })
      ],
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"]
      ],
      limit: MAX_PREVIEW_MESSAGES + 1
    })
  );
  const { where } = findAll.mock.calls[0][0];
  expect(where.fromMe).toBeUndefined();
  expect(where[Op.or]).toEqual([
    { mediaType: null },
    { mediaType: { [Op.notIn]: ["reactionMessage", "transferNote"] } }
  ]);
});

test("never changes the ticket or marks messages as read", async () => {
  findAll.mockResolvedValue([row("m1", 1)]);

  await ShowPendingMessagePreviewService("301", actor);

  expect(ticketUpdate).not.toHaveBeenCalled();
  expect(Message.update).not.toHaveBeenCalled();
});

test("keeps the newest messages when a ticket exceeds the cap", async () => {
  const rows = Array.from({ length: MAX_PREVIEW_MESSAGES + 1 }, (_, index) =>
    row(`m${MAX_PREVIEW_MESSAGES + 1 - index}`, 0)
  );
  findAll.mockResolvedValue(rows);

  const result = await ShowPendingMessagePreviewService("301", actor);

  expect(result.truncated).toBe(true);
  expect(result.messages).toHaveLength(MAX_PREVIEW_MESSAGES);
  expect(result.messages[0].id).toBe("m2");
  expect(result.messages[MAX_PREVIEW_MESSAGES - 1].id).toBe(
    `m${MAX_PREVIEW_MESSAGES + 1}`
  );
});

test("labels attachments without revealing audio transcripts or raw cards", async () => {
  findAll.mockResolvedValue([
    row("m4", 4, { mediaType: "application", body: "contrato.pdf" }),
    row("m3", 3, { body: "data:image/png;base64,AAAA" }),
    row("m2", 2, { body: '{"ticketzvCard":[{"vcard":"Dados fictícios"}]}' }),
    row("m1", 1, { mediaType: "audio", body: "Transcrição fictícia" })
  ]);

  const { messages } = await ShowPendingMessagePreviewService("301", actor);

  expect(messages.map(({ kind, text }) => ({ kind, text }))).toEqual([
    { kind: "audio", text: "" },
    { kind: "contact", text: "" },
    { kind: "location", text: "" },
    { kind: "attachment", text: "" }
  ]);
});
