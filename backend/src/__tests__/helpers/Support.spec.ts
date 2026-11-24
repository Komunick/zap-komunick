import {
  SUPPORT_CATEGORIES,
  SUPPORT_TITLE_MAX,
  SupportAction,
  SupportStatus,
  supportActionResult,
  supportFileType,
  supportNumber,
  supportOption,
  supportStatusAfterMessage,
  supportText,
  supportTicketId
} from "../../helpers/SupportRules";
import {
  actsAsSupport,
  canViewSupportTicket,
  supportMessageView,
  supportTicketView,
  supportUnread
} from "../../helpers/SupportView";

const bytes = (...values: (number | string)[]): Buffer =>
  Buffer.from(
    values.flatMap(value =>
      typeof value === "number"
        ? [value]
        : Array.from(value).map(character => character.charCodeAt(0))
    )
  );

describe("supportFileType", () => {
  it.each([
    [bytes(0x89, "PNG\r\n", 0x1a, "\n"), "image/png"],
    [bytes(0xff, 0xd8, 0xff, 0xe0), "image/jpeg"],
    [bytes("GIF89a"), "image/gif"],
    [bytes("RIFF", 0, 0, 0, 0, "WEBP"), "image/webp"],
    [bytes("%PDF-1.7"), "application/pdf"],
    [bytes(0, 0, 0, 0x20, "ftypisom"), "video/mp4"],
    [bytes(0, 0, 0, 0x14, "ftypqt  "), "video/quicktime"],
    [bytes(0x1a, 0x45, 0xdf, 0xa3), "video/webm"]
  ])("recognizes the content of %p as %s", (content, mimeType) => {
    expect(supportFileType(content)?.mimeType).toBe(mimeType);
  });

  it.each([
    bytes("MZ", 0x90, 0),
    bytes("<html><script>"),
    bytes("<svg xmlns="),
    bytes("PK", 3, 4),
    bytes("RIFF", 0, 0, 0, 0, "AVI "),
    Buffer.alloc(0)
  ])("refuses the content %p", content => {
    expect(supportFileType(content)).toBeNull();
  });
});

describe("support fields", () => {
  it("trims, keeps line breaks and drops control characters", () => {
    expect(supportText("  a\r\nb\u0000\u0007\tc  ", 50, true)).toBe("a\nb\tc");
  });

  it.each([undefined, null, "", "   "])(
    "refuses the required value %p",
    value => {
      expect(() => supportText(value, 50, true)).toThrow(
        expect.objectContaining({ message: "ERR_SUPPORT_INVALID" })
      );
    }
  );

  it("refuses other types and a text over the limit", () => {
    expect(supportText(undefined, 50, false)).toBe("");
    expect(() => supportText({ a: 1 }, 50, false)).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_INVALID" })
    );
    expect(() =>
      supportText("x".repeat(SUPPORT_TITLE_MAX + 1), SUPPORT_TITLE_MAX, true)
    ).toThrow(expect.objectContaining({ message: "ERR_SUPPORT_INVALID" }));
  });

  it("accepts only listed options, with a default when empty", () => {
    expect(supportOption("question", SUPPORT_CATEGORIES)).toBe("question");
    expect(supportOption(undefined, SUPPORT_CATEGORIES, "other")).toBe("other");
    expect(() => supportOption("hack", SUPPORT_CATEGORIES, "other")).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_INVALID" })
    );
    expect(() => supportOption(undefined, SUPPORT_CATEGORIES)).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_INVALID" })
    );
  });

  it("numbers tickets as CH-000123 and reads the id from the route", () => {
    expect(supportNumber(123)).toBe("CH-000123");
    expect(supportNumber(1234567)).toBe("CH-1234567");
    expect(supportTicketId("42")).toBe(42);
    ["0", "-1", "1.5", "abc", "1; DROP", "99999999999", undefined].forEach(
      value =>
        expect(() => supportTicketId(value)).toThrow(
          expect.objectContaining({
            message: "ERR_SUPPORT_TICKET_NOT_FOUND",
            statusCode: 404
          })
        )
    );
  });
});

describe("supportActionResult", () => {
  const run = (
    action: SupportAction,
    status: SupportStatus,
    who: "support" | "requester" | "other"
  ) =>
    supportActionResult({
      action,
      status,
      isSupport: who === "support",
      isRequester: who === "requester"
    });

  it.each<[SupportAction, SupportStatus, SupportStatus, boolean]>([
    ["take", "open", "in_progress", false],
    ["request_info", "open", "waiting", true],
    ["request_info", "in_progress", "waiting", true],
    ["resume", "waiting", "in_progress", false],
    ["conclude", "open", "done", true],
    ["conclude", "in_progress", "done", true],
    ["conclude", "waiting", "done", true],
    ["reopen", "done", "in_progress", false],
    ["reopen", "cancelled", "in_progress", false],
    ["cancel", "open", "cancelled", true]
  ])("support: %s from %s goes to %s", (action, from, to, needsText) => {
    expect(run(action, from, "support")).toMatchObject({
      status: to,
      needsText
    });
  });

  it.each<[SupportAction, SupportStatus]>([
    ["take", "in_progress"],
    ["take", "done"],
    ["request_info", "waiting"],
    ["request_info", "done"],
    ["resume", "open"],
    ["conclude", "done"],
    ["conclude", "cancelled"],
    ["reopen", "open"],
    ["cancel", "in_progress"],
    ["cancel", "done"]
  ])("support: %s is refused from %s", (action, from) => {
    expect(() => run(action, from, "support")).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_ACTION_NOT_ALLOWED" })
    );
  });

  it("lets the requester cancel only while nobody took the ticket", () => {
    expect(run("cancel", "open", "requester").status).toBe("cancelled");
    expect(() => run("cancel", "in_progress", "requester")).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_ACTION_NOT_ALLOWED" })
    );
    expect(() => run("cancel", "open", "other")).toThrow(
      expect.objectContaining({ message: "ERR_SUPPORT_ACTION_NOT_ALLOWED" })
    );
  });

  it.each<SupportAction>([
    "take",
    "request_info",
    "resume",
    "conclude",
    "reopen"
  ])("refuses %s from the requester", action => {
    expect(() => run(action, "open", "requester")).toThrow(
      expect.objectContaining({ message: "ERR_NO_PERMISSION", statusCode: 403 })
    );
  });
});

describe("supportStatusAfterMessage", () => {
  it.each<[SupportStatus, boolean, boolean, SupportStatus, boolean]>([
    ["open", true, false, "in_progress", false],
    ["in_progress", true, true, "in_progress", false],
    ["waiting", true, true, "waiting", false],
    ["open", false, false, "open", false],
    ["in_progress", false, true, "in_progress", false],
    ["waiting", false, true, "in_progress", false],
    ["done", false, true, "in_progress", true],
    ["done", false, false, "open", true],
    ["cancelled", false, false, "open", true],
    ["done", true, false, "in_progress", true],
    ["cancelled", true, true, "in_progress", true]
  ])(
    "%s, fromSupport=%p, hasAssignee=%p -> %s (reopened=%p)",
    (status, fromSupport, hasAssignee, expected, reopened) => {
      expect(
        supportStatusAfterMessage({ status, fromSupport, hasAssignee })
      ).toEqual({ status: expected, reopened });
    }
  );
});

describe("support views", () => {
  const requester = { userId: 7, companyId: 2, isSuper: false };
  const colleague = { userId: 8, companyId: 2, isSuper: false };
  const support = { userId: 1, companyId: 1, isSuper: true };
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 24, 18, minute));
  const ticket = {
    id: 12,
    companyId: 2,
    userId: 7,
    companyName: "Empresa Modelo",
    userName: "Ana",
    userEmail: "ana@example.invalid",
    userProfile: "user",
    title: "Tela trava",
    category: "error",
    priority: "medium",
    status: "open",
    userAgent: "Mozilla/5.0",
    screen: "1366x768",
    appUrl: "https://superchat.example.invalid",
    lastMessageAt: at(0),
    lastRequesterMessageAt: at(0),
    requesterReadAt: at(0),
    createdAt: at(0)
  };

  it("shows a ticket to its requester and to support only", () => {
    expect(canViewSupportTicket(ticket, requester)).toBe(true);
    expect(canViewSupportTicket(ticket, support)).toBe(true);
    expect(canViewSupportTicket(ticket, colleague)).toBe(false);
    expect(canViewSupportTicket({ userId: null }, colleague)).toBe(false);
  });

  it("treats a super administrator as requester in a ticket of their own", () => {
    expect(actsAsSupport(ticket, support)).toBe(true);
    expect(actsAsSupport({ userId: 1 }, support)).toBe(false);
    expect(actsAsSupport(ticket, requester)).toBe(false);
  });

  it("marks as unread what the other side did after the last visit", () => {
    expect(supportUnread(ticket, support)).toBe(true);
    expect(supportUnread(ticket, requester)).toBe(false);
    expect(supportUnread({ ...ticket, supportReadAt: at(1) }, support)).toBe(
      false
    );
    const answered = { ...ticket, lastSupportMessageAt: at(5) };
    expect(supportUnread(answered, requester)).toBe(true);
    expect(
      supportUnread({ ...answered, requesterReadAt: at(6) }, requester)
    ).toBe(false);
  });

  it("keeps the requester's e-mail and browser away from the requester view", () => {
    const own = supportTicketView(ticket, requester);
    expect(own).toMatchObject({ number: "CH-000012", mine: true });
    ["userEmail", "userProfile", "userAgent", "screen", "appUrl"].forEach(
      field => expect(own).not.toHaveProperty(field)
    );
    expect(supportTicketView(ticket, support)).toMatchObject({
      mine: false,
      unread: true,
      userEmail: "ana@example.invalid",
      screen: "1366x768"
    });
  });

  it("exposes attachments by id, never by a path on disk", () => {
    const view = supportMessageView(
      {
        id: 3,
        ticketId: 12,
        userId: 7,
        userName: "Ana",
        fromSupport: false,
        kind: "message",
        body: "Segue o print.",
        attachments: [
          {
            storedName: "support-11111111-1111-4111-8111-111111111111.upload",
            originalName: "print.png",
            mimeType: "image/png",
            size: 10
          }
        ],
        createdAt: at(1)
      },
      requester
    );
    expect(view).toMatchObject({ mine: true, fromSupport: false });
    expect(view.attachments).toEqual([
      {
        id: "support-11111111-1111-4111-8111-111111111111.upload",
        name: "print.png",
        mimeType: "image/png",
        size: 10
      }
    ]);
    expect(view).not.toHaveProperty("userId");
  });
});
