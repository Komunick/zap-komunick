import { Op } from "sequelize";
import Ticket from "../../models/Ticket";
import {
  loadSectorTicketIds,
  sectorHistoryFence,
  seesHistoryMessage
} from "../../helpers/HistoryVisibility";

jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));

const findAll = Ticket.findAll as jest.Mock;

beforeEach(() => jest.resetAllMocks());

describe("which messages of the other tickets of a client an attendant reads", () => {
  it.each([
    // sector of the message, sector of its ticket now, reads?
    [401, 401, true],
    // exchanged in the sector of the attendant, ticket transferred since
    [401, 402, true],
    [401, null, true],
    // exchanged in another sector, even on a ticket now in this one
    [402, 401, false],
    [402, 402, false],
    [402, null, false],
    // no sector on the message: the ticket decides
    [null, 401, true],
    [null, 402, false],
    [null, null, false],
    [undefined, 401, true],
    [undefined, undefined, false]
  ])(
    "message of sector %p on a ticket now in %p: %p",
    (message, ticket, sees) => {
      expect(seesHistoryMessage([401, 405], message, ticket)).toBe(sees);
    }
  );

  it("reads nothing without a sector of their own", () => {
    expect(seesHistoryMessage([], 401, 401)).toBe(false);
    expect(seesHistoryMessage([], null, null)).toBe(false);
  });

  it("says the same thing as a filter of messages", () => {
    expect(sectorHistoryFence(301, [401, 405], [300, 310])).toEqual({
      [Op.or]: [
        { ticketId: 301 },
        { queueId: { [Op.in]: [401, 405] } },
        { queueId: null, ticketId: { [Op.in]: [300, 310] } }
      ]
    });
  });

  it("looks for the tickets of the client that are in the sectors of the attendant, in the office", async () => {
    findAll.mockResolvedValue([{ id: 300 }, { id: 310 }]);
    await expect(loadSectorTicketIds(201, 10, [401, 405])).resolves.toEqual([
      300, 310
    ]);
    expect(findAll).toHaveBeenCalledWith({
      where: {
        contactId: 201,
        companyId: 10,
        queueId: { [Op.in]: [401, 405] }
      },
      attributes: ["id"]
    });
  });

  it("does not ask the database when the attendant has no sector", async () => {
    await expect(loadSectorTicketIds(201, 10, [])).resolves.toEqual([]);
    expect(findAll).not.toHaveBeenCalled();
  });
});
