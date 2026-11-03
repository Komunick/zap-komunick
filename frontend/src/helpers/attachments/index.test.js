import {
  buildMessageAttachments,
  classifyMessageAttachment,
  validTicketId,
  safeOriginalUrl
} from "./index";

test.each([
  [
    {
      mediaType: "document",
      body: "Fixture caption",
      mediaUrl: "/fixture.pdf?version=2"
    },
    "pdf"
  ],
  [
    { mediaType: "application", body: "fixture.pdf", mediaUrl: "/fixture.pdf" },
    "pdf"
  ],
  [{ mediaType: "document", mimeType: "application/pdf" }, "pdf"],
  [{ mediaType: "document", body: "fixture.zip" }, "other"],
  [{ mediaType: "video", body: "fixture.mp4" }, "video"],
  [{ mediaType: "image", body: "fixture.png" }, "image"],
  [{ mediaType: "audio", body: "fixture.ogg" }, "audio"]
])(
  "classifies %j without requiring protocol JSON as %s",
  (message, expected) => {
    expect(classifyMessageAttachment(message)).toBe(expected);
  }
);

test("navigation excludes deleted/sticker/audio/missing-source messages and keeps each source ticket", () => {
  const message = {
    id: "fixture-pdf",
    ticketId: 301,
    mediaType: "document",
    mediaUrl: "/fixture.pdf",
    body: "fixture.pdf",
    updatedAt: "2026-10-27T12:00:00.000Z"
  };
  const result = buildMessageAttachments(
    [
      message,
      {
        ...message,
        id: "fixture-image",
        ticketId: 302,
        mediaType: "image",
        mediaUrl: "/fixture.png",
        body: "fixture.png"
      },
      { ...message, id: "fixture-deleted", isDeleted: true },
      {
        ...message,
        id: "fixture-audio",
        mediaType: "audio",
        body: "fixture.ogg",
        mediaUrl: "/fixture.ogg"
      },
      {
        ...message,
        id: "fixture-sticker",
        dataJson: JSON.stringify({ message: { stickerMessage: {} } })
      },
      { ...message, id: "fixture-no-source", ticketId: undefined }
    ],
    "context-a"
  );
  expect(result.map(row => [row.messageId, row.sourceTicketId])).toEqual([
    ["fixture-pdf", 301],
    ["fixture-image", 302]
  ]);
  expect(result.every(row => row.contextKey === "context-a")).toBe(true);
  const updated = buildMessageAttachments(
    [{ ...message, updatedAt: "2026-10-27T12:01:00.000Z" }],
    "context-a"
  );
  expect(updated[0].version).not.toBe(result[0].version);
});
test.each([
  "javascript:alert(1)", // eslint-disable-line no-script-url -- intentional unsafe fixture
  "data:text/html,fixture",
  "https://fixture:fixture@invalid.example/file",
  "/relative/file",
  null
])("rejects unsafe original %s", value => {
  expect(safeOriginalUrl(value)).toBeNull();
});

test.each([undefined, null, true, false, 0, -1, "undefined", "../301", 1.5])(
  "rejects invalid ticket ID %s",
  value => {
    expect(validTicketId(value)).toBe(false);
  }
);

test.each(["image", "video"])(
  "a PDF filename in a %s caption does not change the media type",
  mediaType => {
    expect(
      classifyMessageAttachment({
        mediaType,
        body: "Envie o boleto.pdf",
        mediaUrl: "/fixture-no-extension"
      })
    ).toBe(mediaType);
  }
);
