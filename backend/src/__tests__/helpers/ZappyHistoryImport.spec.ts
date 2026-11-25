import {
  HistoryExport,
  ImportContext,
  importedMessageBody,
  importedMessageId,
  indexByName,
  numberCandidates,
  planImport
} from "../../helpers/ZappyHistoryImport";

const context = (overrides: Partial<ImportContext> = {}): ImportContext => ({
  contactIdByNumber: new Map([["5571999990001", 10]]),
  queueIdByName: new Map([["fiscal", 4]]),
  userIdByName: new Map([["yasmin", 7]]),
  existingMessageIds: new Set(),
  ...overrides
});

const exportOf = (tickets: HistoryExport["tickets"]): HistoryExport => ({
  source: "zapcontabil",
  exportedAt: "2026-11-23T15:00:00.000Z",
  tickets
});

const message = (id: string, minutes: number, extra = {}) => ({
  externalId: id,
  fromMe: false,
  body: `mensagem ${id}`,
  createdAt: new Date(Date.UTC(2026, 9, 1, 12, minutes)).toISOString(),
  ...extra
});

describe("numberCandidates", () => {
  it("covers the forms with and without the ninth digit", () => {
    expect(numberCandidates("557199990001@s.whatsapp.net")).toEqual(
      expect.arrayContaining(["557199990001", "5571999990001"])
    );
  });

  it("returns nothing for an empty number", () => {
    expect(numberCandidates("")).toEqual([]);
  });
});

describe("importedMessageId", () => {
  it("prefers the WhatsApp id, the same SuperChat stores", () => {
    expect(importedMessageId(message("1", 0, { whatsappId: "3EB0ABC" }))).toBe(
      "3EB0ABC"
    );
  });

  it("falls back to a prefixed id of the previous system", () => {
    expect(importedMessageId(message("88", 0))).toBe("zappy-88");
  });
});

describe("importedMessageBody", () => {
  it("keeps text", () => {
    expect(importedMessageBody(message("1", 0))).toBe("mensagem 1");
  });

  it("turns an attachment into its name, with the caption", () => {
    expect(
      importedMessageBody(
        message("1", 0, {
          mediaType: "document",
          fileName: "guia-das.pdf",
          body: "segue a guia"
        })
      )
    ).toBe("📎 guia-das.pdf\nsegue a guia");
    expect(
      importedMessageBody(
        message("2", 0, { mediaType: "audio", body: "", fileName: "" })
      )
    ).toBe("📎 audio");
  });

  it("keeps replies, links and other text types as text", () => {
    ["extendedTextMessage", "conversation", "chat", "vcard", "text"].forEach(
      mediaType =>
        expect(
          importedMessageBody(message("1", 0, { mediaType, body: "segue" }))
        ).toBe("segue")
    );
  });

  it("knows the attachment types of the previous system", () => {
    ["imageMessage", "application/pdf", "ptt", "documentWithCaptionMessage"]
      .map(mediaType =>
        importedMessageBody(message("1", 0, { mediaType, body: "" }))
      )
      .forEach(body => expect(body.startsWith("📎 ")).toBe(true));
    // a file name alone is enough
    expect(
      importedMessageBody(
        message("1", 0, { mediaType: "", fileName: "nota.xml", body: "" })
      )
    ).toBe("📎 nota.xml");
  });
});

describe("indexByName", () => {
  it("leaves out a name two rows share, instead of picking one", () => {
    const { idByName, ambiguous } = indexByName([
      { id: 12, name: "Carol" },
      { id: 31, name: " carol " },
      { id: 7, name: "Yasmin" }
    ]);
    expect(idByName.get("carol")).toBeUndefined();
    expect(idByName.get("yasmin")).toBe(7);
    expect(Array.from(ambiguous)).toEqual(["carol"]);
  });
});

describe("planImport", () => {
  it("creates a closed ticket for a known client, with queue and agent", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "557199990001",
          queueName: "Fiscal",
          userName: "Yasmin",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("b", 5), message("a", 1, { fromMe: true })]
        }
      ]),
      context()
    );
    expect(plan.totals).toEqual({
      tickets: 1,
      messages: 2,
      alreadyPresent: 0,
      newContacts: 0,
      afterCutoffWithoutWhatsappId: 0,
      dropped: { invalidDate: 0, empty: 0, noId: 0 }
    });
    const [ticket] = plan.tickets;
    expect(ticket.contact).toEqual({ id: 10 });
    expect(ticket.queueId).toBe(4);
    expect(ticket.userId).toBe(7);
    expect(ticket.messages.map(m => m.id)).toEqual(["zappy-a", "zappy-b"]);
    expect(ticket.updatedAt.toISOString()).toBe("2026-10-01T12:05:00.000Z");
  });

  it("creates the client once when it is not in SuperChat", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "557188887777",
          contactName: "Cliente Novo",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("x", 0)]
        },
        {
          externalId: "t2",
          contactNumber: "5571988887777",
          createdAt: "2026-10-02T12:00:00.000Z",
          messages: [message("y", 0)]
        }
      ]),
      context()
    );
    expect(plan.totals.newContacts).toBe(1);
    expect(plan.tickets[0].contact).toEqual({
      create: {
        name: "Cliente Novo",
        number: "5571988887777",
        createdAt: new Date(Date.UTC(2026, 9, 1, 12, 0))
      }
    });
    expect(plan.tickets[0].queueId).toBeNull();
  });

  it("does not repeat messages SuperChat already has, nor import twice", () => {
    const data = exportOf([
      {
        externalId: "t1",
        contactNumber: "5571999990001",
        createdAt: "2026-10-01T12:00:00.000Z",
        messages: [message("1", 0, { whatsappId: "3EB0SAME" }), message("2", 1)]
      }
    ]);
    const plan = planImport(
      data,
      context({ existingMessageIds: new Set(["3EB0SAME", "zappy-2"]) })
    );
    expect(plan.tickets).toEqual([]);
    expect(plan.skipped).toEqual([
      { externalId: "t1", reason: "already-imported" }
    ]);
    expect(plan.totals.alreadyPresent).toBe(2);
  });

  it("skips groups, tickets without number and empty messages", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "g",
          contactNumber: "120363000000@g.us",
          isGroup: true,
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("1", 0)]
        },
        {
          externalId: "n",
          contactNumber: "",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("2", 0)]
        },
        {
          externalId: "e",
          contactNumber: "5571999990001",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [
            message("3", 0, { body: " " }),
            message("4", 0, { createdAt: "x" })
          ]
        }
      ]),
      context()
    );
    expect(plan.skipped.map(s => s.reason)).toEqual([
      "group",
      "invalid-number",
      "no-messages"
    ]);
    // what the export has and is not imported is counted, never silent
    expect(plan.totals.dropped).toEqual({ invalidDate: 1, empty: 1, noId: 0 });
  });

  it("counts messages without any id", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "5571999990001",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("ok", 0), message(" ", 1)]
        }
      ]),
      context()
    );
    expect(plan.totals.messages).toBe(1);
    expect(plan.totals.dropped).toEqual({ invalidDate: 0, empty: 0, noId: 1 });
  });

  it("skips LID, group ids without the flag and numbers without country code", () => {
    const plan = planImport(
      exportOf(
        ["123456789012345@lid", "120363111111111111@g.us", "71999990001"].map(
          (contactNumber, i) => ({
            externalId: `x${i}`,
            contactNumber,
            createdAt: "2026-10-01T12:00:00.000Z",
            messages: [message(`n${i}`, 0)]
          })
        )
      ),
      context()
    );
    expect(plan.skipped.map(s => s.reason)).toEqual([
      "lid",
      "group",
      "invalid-number"
    ]);
  });

  it("knows a message by either id, so a later export never duplicates it", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "5571999990001",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message(" 123 ", 0, { whatsappId: " 3EB0NEW " })]
        }
      ]),
      context({ existingMessageIds: new Set(["zappy-123"]) })
    );
    expect(plan.tickets).toEqual([]);
    expect(plan.totals.alreadyPresent).toBe(1);
  });

  it("after the cut-off keeps only messages with the WhatsApp id", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "5571999990001",
          createdAt: "2026-11-01T12:00:00.000Z",
          messages: [
            message("old", 0),
            {
              ...message("new-no-id", 0),
              createdAt: "2026-11-21T12:00:00.000Z"
            },
            {
              ...message("new-with-id", 0, { whatsappId: "3EB0X" }),
              createdAt: "2026-11-21T12:01:00.000Z"
            }
          ]
        }
      ]),
      context({ until: new Date("2026-11-20T00:00:00.000Z") })
    );
    expect(plan.tickets[0].messages.map(m => m.id)).toEqual([
      "zappy-old",
      "3EB0X"
    ]);
    expect(plan.totals.afterCutoffWithoutWhatsappId).toBe(1);
  });

  it("keeps messages with the same time in export order, 1 ms apart", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "5571999990001",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("a", 0), message("b", 0), message("c", 0)]
        }
      ]),
      context()
    );
    const times = plan.tickets[0].messages.map(m => m.createdAt.getTime());
    expect(plan.tickets[0].messages.map(m => m.id)).toEqual([
      "zappy-a",
      "zappy-b",
      "zappy-c"
    ]);
    expect(times[1] - times[0]).toBe(1);
    expect(times[2] - times[1]).toBe(1);
  });

  it("uses the default queue and lists names without a match", () => {
    const plan = planImport(
      exportOf([
        {
          externalId: "t1",
          contactNumber: "5571999990001",
          queueName: "Legalização",
          userName: "Fulana",
          createdAt: "2026-10-01T12:00:00.000Z",
          messages: [message("a", 0)]
        }
      ]),
      context({ defaultQueueId: 9 })
    );
    expect(plan.tickets[0].queueId).toBe(9);
    expect(plan.unmatchedQueues).toEqual(["Legalização"]);
    expect(plan.unmatchedUsers).toEqual(["Fulana"]);
  });

  it("refuses a file that is not a ZapContábil export", () => {
    [
      { source: "other" },
      { Fiscal: 4 },
      { source: "zapcontabil" },
      null
    ].forEach(data =>
      expect(() =>
        planImport(data as unknown as HistoryExport, context())
      ).toThrow("ERR_IMPORT_INVALID_EXPORT")
    );
  });
});
