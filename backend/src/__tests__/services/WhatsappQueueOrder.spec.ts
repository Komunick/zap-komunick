import ShowWhatsAppService from "../../services/WhatsappService/ShowWhatsAppService";
import AssociateWhatsappQueue from "../../services/WhatsappService/AssociateWhatsappQueue";
import Whatsapp from "../../models/Whatsapp";
import WhatsappQueue from "../../models/WhatsappQueue";

jest.mock("../../models/Whatsapp", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/WhatsappQueue", () => ({ update: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/QueueOption", () => ({}));
jest.mock("../../models/Company", () => ({}));

const queue = (id: number, name: string, position: number | null) => ({
  id,
  name,
  WhatsappQueue: { position }
});

// As the database returns them: alphabetical (the tie-break of the query).
const alphabetical = () => [
  queue(7, "Atendimento geral", 6),
  queue(10, "Contábil", 5),
  queue(9, "Financeiro", 2),
  queue(2, "Fiscal", 4),
  queue(8, "Legalização", 1),
  queue(3, "Pessoal", 3)
];

describe("ShowWhatsAppService", () => {
  it("returns the channel queues in the saved menu order", async () => {
    const whatsapp = { id: 5, queues: alphabetical() };
    const sameArray = whatsapp.queues;
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(whatsapp);

    const result = await ShowWhatsAppService(5, { companyId: 2 });

    expect(result.queues.map(q => q.id)).toEqual([8, 9, 3, 2, 10, 7]);
    // sorted in place, so the JSON of the instance has the same order
    expect(result.queues).toBe(sameArray);
    expect((Whatsapp.findOne as jest.Mock).mock.calls[0][0].where).toEqual({
      id: 5,
      companyId: 2
    });
  });

  it("keeps the alphabetical order when no position was saved", async () => {
    const whatsapp = {
      id: 5,
      queues: [
        queue(1, "Comercial", null),
        queue(2, "Financeiro", null),
        queue(3, "Suporte", null)
      ]
    };
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    const result = await ShowWhatsAppService(5);

    expect(result.queues.map(q => q.id)).toEqual([1, 2, 3]);
  });

  it("returns null when the channel does not exist", async () => {
    (Whatsapp.findOne as jest.Mock).mockResolvedValue(null);
    await expect(ShowWhatsAppService(5, { companyId: 2 })).resolves.toBeNull();
  });
});

describe("AssociateWhatsappQueue", () => {
  it("links the queues and saves the order they were sent in", async () => {
    const whatsapp = {
      id: 5,
      $set: jest.fn(),
      reload: jest.fn()
    } as unknown as Whatsapp;

    await AssociateWhatsappQueue(whatsapp, [8, 9, 3, 2, 10, 7, 8]);

    expect(whatsapp.$set).toHaveBeenCalledWith("queues", [8, 9, 3, 2, 10, 7]);
    const updates = (WhatsappQueue.update as jest.Mock).mock.calls.map(
      ([values, options]) => [options.where.queueId, values.position]
    );
    expect(updates).toEqual([
      [8, 1],
      [9, 2],
      [3, 3],
      [2, 4],
      [10, 5],
      [7, 6]
    ]);
    (WhatsappQueue.update as jest.Mock).mock.calls.forEach(([, options]) =>
      expect(options.where.whatsappId).toBe(5)
    );
    expect(whatsapp.reload).toHaveBeenCalled();
  });

  it("unlinks every queue when the list is empty", async () => {
    const whatsapp = {
      id: 5,
      $set: jest.fn(),
      reload: jest.fn()
    } as unknown as Whatsapp;

    await AssociateWhatsappQueue(whatsapp, []);

    expect(whatsapp.$set).toHaveBeenCalledWith("queues", []);
    expect(WhatsappQueue.update).not.toHaveBeenCalled();
  });
});
