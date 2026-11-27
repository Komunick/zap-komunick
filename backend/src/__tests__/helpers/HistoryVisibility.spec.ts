import { col, fn, Op } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import {
  loadSectorHistory,
  NO_SECTOR_HISTORY,
  sectorHistoryFence,
  sectorHistoryOf,
  sectorReachedMessage,
  seesHistoryMessage
} from "../../helpers/HistoryVisibility";

jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../models/Message", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn()
}));

const tickets = Ticket.findAll as jest.Mock;
const messages = Message.findAll as jest.Mock;
const lastMessage = Message.findOne as jest.Mock;
const count = Message.count as jest.Mock;

beforeEach(() => jest.resetAllMocks());

const until = new Date("2026-11-26T13:13:08.123Z");

describe("which messages of the other tickets of a client an attendant reads", () => {
  describe("without asking the database", () => {
    it.each([
      // sector of the message, sector of its ticket now, reads?
      [401, 401, true],
      // exchanged in the sector of the attendant, ticket transferred since
      [401, 402, true],
      [401, null, true],
      // the ticket is in the sector of the attendant now: all of it, as by
      // opening it
      [402, 401, true],
      [null, 401, true],
      [undefined, 405, true],
      // neither: only the reach of the sector can still say yes
      [402, 402, false],
      [402, null, false],
      [null, 402, false],
      [null, null, false],
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
  });

  describe("how far the sectors of the attendant reach in the tickets of the client", () => {
    const ofClient = [
      { id: 301, queueId: 402 }, // the open one, wherever it is
      { id: 300, queueId: 401 },
      { id: 310, queueId: 405 },
      { id: 303, queueId: 402 },
      { id: 304, queueId: null }
    ];

    it("takes whole the tickets in the sectors now and asks the last message of the sectors on the ones that left", async () => {
      messages.mockResolvedValue([
        { ticketId: 303, until },
        // PostgreSQL may answer text
        { ticketId: "304", until: "2026-11-20T10:00:00.000Z" }
      ]);
      await expect(
        sectorHistoryOf(ofClient, 10, [401, 405], 301)
      ).resolves.toEqual({
        sectorTicketIds: [300, 310],
        reach: [
          { ticketId: 303, until },
          { ticketId: 304, until: new Date("2026-11-20T10:00:00.000Z") }
        ]
      });
      expect(messages).toHaveBeenCalledTimes(1);
      const query = messages.mock.calls[0][0];
      // only the tickets that left, in the office, by the sectors of the
      // attendant; never the open ticket
      expect(query.where).toEqual({
        ticketId: { [Op.in]: [303, 304] },
        companyId: 10,
        queueId: { [Op.in]: [401, 405] }
      });
      // THE cut: the LAST message of the sectors, by when it was stored. The
      // first one would bring the bug back; the last update (an ack, an edit)
      // would show what the next sector said before it.
      expect(query.attributes).toEqual([
        "ticketId",
        [fn("max", col("createdAt")), "until"]
      ]);
      expect(query.group).toEqual(["ticketId"]);
      expect(query.raw).toBe(true);
      expect(query.logging).toBe(false);
    });

    it("does not ask when no ticket left the sectors", async () => {
      await expect(
        sectorHistoryOf(
          [
            { id: 301, queueId: 402 },
            { id: 300, queueId: 401 }
          ],
          10,
          [401],
          301
        )
      ).resolves.toEqual({ sectorTicketIds: [300], reach: [] });
      expect(messages).not.toHaveBeenCalled();
    });

    it("drops an answer that is not a date instead of opening a ticket with it", async () => {
      messages.mockResolvedValue([{ ticketId: 303, until: null }]);
      const history = await sectorHistoryOf(ofClient, 10, [401], 301);
      expect(history.reach).toEqual([]);
    });

    it("gives nothing, and asks nothing, to an attendant without a sector", async () => {
      await expect(sectorHistoryOf(ofClient, 10, [], 301)).resolves.toBe(
        NO_SECTOR_HISTORY
      );
      await expect(loadSectorHistory(201, 10, [], 301)).resolves.toBe(
        NO_SECTOR_HISTORY
      );
      expect(tickets).not.toHaveBeenCalled();
      expect(messages).not.toHaveBeenCalled();
    });

    it("loads the tickets of the client, in the office, when the caller does not have them", async () => {
      tickets.mockResolvedValue(ofClient);
      messages.mockResolvedValue([{ ticketId: 303, until }]);
      await expect(loadSectorHistory(201, 10, [401], 301)).resolves.toEqual({
        sectorTicketIds: [300],
        reach: [{ ticketId: 303, until }]
      });
      expect(tickets).toHaveBeenCalledWith({
        where: { contactId: 201, companyId: 10 },
        attributes: ["id", "queueId"]
      });
    });
  });

  it("says the same thing as a filter of messages", () => {
    expect(
      sectorHistoryFence(301, [401, 405], {
        sectorTicketIds: [300, 310],
        reach: [{ ticketId: 303, until }]
      })
    ).toEqual({
      [Op.or]: [
        { ticketId: { [Op.in]: [301, 300, 310] } },
        { queueId: { [Op.in]: [401, 405] } },
        { ticketId: 303, createdAt: { [Op.lte]: until } }
      ]
    });
    // the open ticket is not repeated when it is in the sector too
    expect(
      sectorHistoryFence(301, [401], { sectorTicketIds: [301], reach: [] })
    ).toEqual({
      [Op.or]: [
        { ticketId: { [Op.in]: [301] } },
        { queueId: { [Op.in]: [401] } }
      ]
    });
  });

  describe("one message, opened by id", () => {
    const message = { id: "m1", ticketId: 303 };

    it("is read when it was already there at the last message of the sector, by the comparison of the database", async () => {
      lastMessage.mockResolvedValue({ createdAt: until });
      count.mockResolvedValue(1);
      await expect(sectorReachedMessage(message, 10, [401])).resolves.toBe(
        true
      );
      expect(lastMessage.mock.calls[0][0]).toMatchObject({
        where: { ticketId: 303, companyId: 10, queueId: { [Op.in]: [401] } },
        order: [["createdAt", "DESC"]]
      });
      expect(count.mock.calls[0][0].where).toEqual({
        id: "m1",
        ticketId: 303,
        companyId: 10,
        createdAt: { [Op.lte]: until }
      });
    });

    it("is refused when it came after the sector's last message", async () => {
      lastMessage.mockResolvedValue({ createdAt: until });
      count.mockResolvedValue(0);
      await expect(sectorReachedMessage(message, 10, [401])).resolves.toBe(
        false
      );
    });

    it("is refused when the sector never exchanged a message on that ticket", async () => {
      lastMessage.mockResolvedValue(null);
      await expect(sectorReachedMessage(message, 10, [401])).resolves.toBe(
        false
      );
      expect(count).not.toHaveBeenCalled();
    });

    it("is refused, without asking, to an attendant without a sector", async () => {
      await expect(sectorReachedMessage(message, 10, [])).resolves.toBe(false);
      expect(lastMessage).not.toHaveBeenCalled();
    });
  });
});
