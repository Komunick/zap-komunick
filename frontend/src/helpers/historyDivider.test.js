import { historyDividerKey, isReplyOnlyHistoryMessage } from "./historyDivider";

describe("the title of each ticket in the history of a client", () => {
  test("the ticket that is open is the current one, whatever its state", () => {
    expect(historyDividerKey(301, 301, { status: "closed" })).toBe(
      "history.currentTicket"
    );
    expect(historyDividerKey(301, 301, undefined)).toBe(
      "history.currentTicket"
    );
  });

  test.each(["open", "pending", "paused"])(
    "another ticket of the client that is %s is in progress, not a previous one",
    status => {
      expect(historyDividerKey(303, 301, { status })).toBe(
        "history.ongoingTicket"
      );
    }
  );

  test("another ticket that is resolved is a previous one", () => {
    expect(historyDividerKey(300, 301, { status: "closed" })).toBe(
      "history.previousTicket"
    );
  });

  test("without the facts of the ticket it is called a previous one, as before", () => {
    expect(historyDividerKey(300, 301, undefined)).toBe(
      "history.previousTicket"
    );
    expect(historyDividerKey(300, 301, {})).toBe("history.previousTicket");
  });
});

describe("what can be done with a message of the history", () => {
  const message = { id: "m1", ticketId: 303 };

  test("a message of a ticket the attendant may not open can only be quoted in a reply", () => {
    expect(isReplyOnlyHistoryMessage(message, 301, { canOpen: false })).toBe(
      true
    );
  });

  test("a message of another ticket she may open keeps every action", () => {
    expect(isReplyOnlyHistoryMessage(message, 301, { canOpen: true })).toBe(
      false
    );
  });

  test("the open ticket is never reply-only, whatever came with it", () => {
    expect(
      isReplyOnlyHistoryMessage({ id: "m2", ticketId: 301 }, 301, {
        canOpen: false
      })
    ).toBe(false);
  });

  test("nothing is hidden without the facts of the ticket: the server decides", () => {
    expect(isReplyOnlyHistoryMessage(message, 301, undefined)).toBe(false);
    expect(isReplyOnlyHistoryMessage(message, 301, {})).toBe(false);
    expect(isReplyOnlyHistoryMessage({}, 301, { canOpen: false })).toBe(false);
    expect(isReplyOnlyHistoryMessage(undefined, 301, undefined)).toBe(false);
  });
});
