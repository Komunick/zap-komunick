import {
  BULK_FROM_STATUSES,
  BULK_MAX_TICKETS,
  parseBulkRequest
} from "../../helpers/BulkTicketActions";

describe("parseBulkRequest", () => {
  it("refuses an unknown action", () => {
    expect(parseBulkRequest({ ticketIds: [1] } as never, 7).error).toBe(
      "ERR_BULK_INVALID_ACTION"
    );
    expect(
      parseBulkRequest({ action: "delete", ticketIds: [1] } as never, 7).error
    ).toBe("ERR_BULK_INVALID_ACTION");
  });

  it("needs at least one valid ticket id", () => {
    expect(parseBulkRequest({ action: "accept", ticketIds: [] }, 7).error).toBe(
      "ERR_BULK_NO_TICKETS"
    );
    expect(
      parseBulkRequest({ action: "accept", ticketIds: [1, -2] }, 7).error
    ).toBe("ERR_BULK_INVALID_TICKET");
    expect(
      parseBulkRequest({ action: "accept", ticketIds: ["x" as never] }, 7).error
    ).toBe("ERR_BULK_INVALID_TICKET");
  });

  it("removes repeated ids and limits the batch", () => {
    expect(
      parseBulkRequest({ action: "accept", ticketIds: [3, 3, 4] }, 7).ticketIds
    ).toEqual([3, 4]);
    const many = Array.from({ length: BULK_MAX_TICKETS + 1 }, (_, i) => i + 1);
    expect(
      parseBulkRequest({ action: "accept", ticketIds: many }, 7).error
    ).toBe("ERR_BULK_TOO_MANY");
  });

  it("accepts for the user who asked", () => {
    expect(
      parseBulkRequest({ action: "accept", ticketIds: [1] }, 7).data
    ).toEqual({ status: "open", userId: 7 });
  });

  it("transfers to a queue, waiting, or straight to a person", () => {
    expect(
      parseBulkRequest({ action: "transfer", ticketIds: [1], queueId: 2 }, 7)
        .data
    ).toEqual({ queueId: 2, userId: null, status: "pending" });
    expect(
      parseBulkRequest(
        { action: "transfer", ticketIds: [1], queueId: 2, userId: 5 },
        7
      ).data
    ).toEqual({ queueId: 2, userId: 5 });
  });

  it("needs a queue to transfer", () => {
    expect(
      parseBulkRequest({ action: "transfer", ticketIds: [1] }, 7).error
    ).toBe("ERR_BULK_NO_QUEUE");
    expect(
      parseBulkRequest(
        { action: "transfer", ticketIds: [1], queueId: 2, userId: -1 },
        7
      ).error
    ).toBe("ERR_BULK_INVALID_USER");
  });

  it("closes without the rating message, with the reason and note", () => {
    expect(
      parseBulkRequest(
        {
          action: "close",
          ticketIds: [1],
          closeReasonId: 4,
          closeReasonNote: "lote"
        },
        7
      ).data
    ).toEqual({
      status: "closed",
      justClose: true,
      userId: 7,
      closeReasonId: 4,
      closeReasonNote: "lote"
    });
    expect(
      parseBulkRequest({ action: "close", ticketIds: [1], closeReasonId: 0 }, 7)
        .data
    ).toEqual({ status: "closed", justClose: true, userId: 7 });
  });

  it("only accepts waiting tickets and never touches closed ones", () => {
    expect(BULK_FROM_STATUSES.accept).toEqual(["pending"]);
    expect(BULK_FROM_STATUSES.transfer).not.toContain("closed");
    expect(BULK_FROM_STATUSES.close).not.toContain("closed");
  });
});
