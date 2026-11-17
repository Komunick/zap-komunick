import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import AuthorizeTicketContextService from "../../services/TicketServices/AuthorizeTicketContextService";
import ShowPendingMessagePreviewService from "../../services/MessageServices/ShowPendingMessagePreviewService";

jest.mock("../../models/Message", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../services/TicketServices/AuthorizeTicketContextService", () =>
  jest.fn()
);

const authorize = AuthorizeTicketContextService as jest.Mock;
const findOne = Message.findOne as jest.Mock;
const actor = { userId: 101, companyId: 10 };

beforeEach(() => {
  jest.resetAllMocks();
  authorize.mockResolvedValue({ ticket: { id: 301, queueId: 20 } });
});

test("denied queue access does not query messages", async () => {
  const denied = new AppError("ERR_NO_PERMISSION", 403);
  authorize.mockRejectedValue(denied);

  await expect(ShowPendingMessagePreviewService("301", actor)).rejects.toBe(
    denied
  );
  expect(findOne).not.toHaveBeenCalled();
});

test("reads only the exact still-pending ticket and projects a safe preview", async () => {
  findOne.mockResolvedValue({
    body: "Mensagem fictícia",
    mediaType: null,
    quotedMsg: { body: "Histórico" },
    mediaUrl: "fixture.private"
  });

  await expect(ShowPendingMessagePreviewService("301", actor)).resolves.toEqual(
    {
      kind: "text",
      text: "Mensagem fictícia"
    }
  );
  expect(authorize).toHaveBeenCalledWith("301", actor);
  expect(findOne).toHaveBeenCalledWith(
    expect.objectContaining({
      attributes: ["body", "mediaType"],
      where: expect.objectContaining({
        companyId: 10,
        ticketId: 301,
        fromMe: false,
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
      ]
    })
  );
});

test("shows an attachment label without revealing audio transcripts or raw cards", async () => {
  findOne
    .mockResolvedValueOnce({
      body: "Transcrição fictícia",
      mediaType: "audio"
    })
    .mockResolvedValueOnce({
      body: '{"ticketzvCard":[{"vcard":"Dados fictícios"}]}',
      mediaType: null
    });

  await expect(ShowPendingMessagePreviewService("301", actor)).resolves.toEqual(
    {
      kind: "audio",
      text: ""
    }
  );
  await expect(ShowPendingMessagePreviewService("301", actor)).resolves.toEqual(
    {
      kind: "contact",
      text: ""
    }
  );
});
