import {
  MAX_NOTE_LENGTH,
  MAX_NOTE_MESSAGES,
  MAX_QUOTE_LENGTH,
  noteBody,
  parseTransferNote,
  quoteMessages
} from "../../helpers/TransferNote";

describe("parseTransferNote", () => {
  it("records nothing without text or picked messages", () => {
    expect(parseTransferNote({})).toBeNull();
    expect(parseTransferNote({ note: "   ", messageIds: [] })).toBeNull();
  });

  it("keeps the trimmed text and the picked ids without repeats", () => {
    expect(
      parseTransferNote({
        note: "  Cliente quer 2a via  ",
        messageIds: ["A", "B", "A"]
      })
    ).toEqual({ note: "Cliente quer 2a via", messageIds: ["A", "B"] });
  });

  it("limits the text and the number of messages, ignoring junk ids", () => {
    const parsed = parseTransferNote({
      note: "x".repeat(MAX_NOTE_LENGTH + 50),
      messageIds: [
        ...Array.from({ length: MAX_NOTE_MESSAGES + 5 }, (_, i) => `M${i}`),
        42,
        "",
        null
      ]
    });
    expect(parsed.note).toHaveLength(MAX_NOTE_LENGTH);
    expect(parsed.messageIds).toHaveLength(MAX_NOTE_MESSAGES);
  });
});

describe("quoteMessages", () => {
  it("copies the messages in time order, shortened, with media named", () => {
    const quotes = quoteMessages([
      {
        id: "2",
        fromMe: true,
        body: "Segue o boleto",
        mediaType: "conversation",
        createdAt: "2026-10-27T10:05:00Z"
      },
      {
        id: "1",
        fromMe: false,
        body: "",
        mediaType: "image",
        createdAt: "2026-10-27T10:00:00Z",
        senderName: "Ana"
      },
      {
        id: "3",
        fromMe: false,
        body: "y".repeat(MAX_QUOTE_LENGTH + 10),
        mediaType: "conversation",
        createdAt: "2026-10-27T10:10:00Z"
      }
    ]);
    expect(quotes.map(q => q.id)).toEqual(["1", "2", "3"]);
    expect(quotes[0]).toEqual({
      id: "1",
      fromMe: false,
      body: "[image]",
      createdAt: "2026-10-27T10:00:00.000Z",
      senderName: "Ana"
    });
    expect(quotes[2].body.endsWith("…")).toBe(true);
    expect(quotes[2].body).toHaveLength(MAX_QUOTE_LENGTH + 1);
  });
});

describe("noteBody", () => {
  it("joins the note and the quotes for search and export", () => {
    expect(
      noteBody("Ver 2a via", [
        {
          id: "1",
          fromMe: false,
          body: "Preciso do boleto",
          createdAt: "x",
          senderName: null
        }
      ])
    ).toBe("Ver 2a via\n> Preciso do boleto");
    expect(noteBody("", [])).toBe("Transferência com mensagens destacadas");
  });
});
