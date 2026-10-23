import {
  ACTIVE_TICKET_STATUSES,
  checkCloseReason,
  checkStatusTransition
} from "../../helpers/TicketPauseAndClose";

describe("checkStatusTransition", () => {
  it("allows pausing a ticket in service", () => {
    expect(checkStatusTransition("open", "paused")).toBeNull();
  });

  it("keeps an already paused ticket paused", () => {
    expect(checkStatusTransition("paused", "paused")).toBeNull();
  });

  it.each(["pending", "closed"])("refuses pausing a %s ticket", status => {
    expect(checkStatusTransition(status, "paused")).toBe(
      "ERR_TICKET_PAUSE_NOT_OPEN"
    );
  });

  it("allows resuming, returning to the queue and closing a paused ticket", () => {
    expect(checkStatusTransition("paused", "open")).toBeNull();
    expect(checkStatusTransition("paused", "pending")).toBeNull();
    expect(checkStatusTransition("paused", "closed")).toBeNull();
  });

  it("ignores updates without status", () => {
    expect(checkStatusTransition("pending", undefined)).toBeNull();
  });

  it("treats paused tickets as still active", () => {
    expect(ACTIVE_TICKET_STATUSES).toEqual(["open", "pending", "paused"]);
  });
});

describe("checkCloseReason", () => {
  const base = {
    required: true,
    userInitiated: true,
    isGroup: false,
    closeReasonId: null,
    activeReasonIds: [3, 4]
  };

  it("requires a reason when the company asks for it", () => {
    expect(checkCloseReason(base)).toBe("ERR_CLOSE_REASON_REQUIRED");
  });

  it("accepts an active reason of the company", () => {
    expect(checkCloseReason({ ...base, closeReasonId: 4 })).toBeNull();
  });

  it("refuses an unknown or inactive reason even when not required", () => {
    expect(
      checkCloseReason({ ...base, required: false, closeReasonId: 9 })
    ).toBe("ERR_CLOSE_REASON_NOT_FOUND");
  });

  it("does not require a reason when the option is off", () => {
    expect(checkCloseReason({ ...base, required: false })).toBeNull();
  });

  it("does not require a reason from automations", () => {
    expect(checkCloseReason({ ...base, userInitiated: false })).toBeNull();
  });

  it("does not require a reason for groups", () => {
    expect(checkCloseReason({ ...base, isGroup: true })).toBeNull();
  });
});
