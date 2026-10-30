import { chatMediaPath, chatMediaPreview, chatMediaUrl } from "./chatMedia";

test("chat media addresses only the chat and message identities with an optional download mode", () => {
  expect(chatMediaPath(101, 7)).toBe("/chats/101/messages/7/media");
  expect(chatMediaPath("101", "7", true)).toBe(
    "/chats/101/messages/7/media?download=1"
  );
  expect(chatMediaUrl("https://backend.example.invalid/backend/", 101, 7)).toBe(
    "https://backend.example.invalid/backend/chats/101/messages/7/media"
  );
});

test.each([0, -1, 1.5, "../7"])(
  "invalid message or chat identities do not produce a media URL: %p",
  id => {
    expect(chatMediaPath(id, 7)).toBeNull();
    expect(chatMediaPath(101, id)).toBeNull();
    expect(chatMediaUrl("https://backend.example.invalid", 101, id)).toBeNull();
  }
);

test.each([
  // eslint-disable-next-line no-script-url -- Deliberate unsupported-protocol rejection fixture.
  "javascript:alert(1)",
  "/relative-backend",
  "https://user:fictional@backend.example.invalid",
  "https://backend.example.invalid?redirect=public",
  "https://backend.example.invalid#public"
])("malformed backend configuration cannot redirect credentials: %p", base => {
  expect(chatMediaUrl(base, 101, 7)).toBeNull();
});

test.each([
  ["image/png", "image"],
  ["audio/mpeg", "audio"],
  ["video/mp4", "video"]
])(
  "only server-approved inline MIME determines the preview: %s",
  (mimeType, kind) => {
    expect(
      chatMediaPreview({
        "content-type": mimeType,
        "content-disposition": "INLINE; filename=fictional"
      })
    ).toEqual({ mimeType, kind });
  }
);

test.each([
  "image/svg+xml",
  "text/html",
  "application/octet-stream",
  "application/pdf"
])(
  "active/unknown types and PDFs never become a new native preview: %s",
  mime => {
    expect(
      chatMediaPreview({
        "content-type": mime,
        "content-disposition": "inline"
      })
    ).toBeNull();
  }
);

test.each([undefined, "attachment", "inline, attachment"])(
  "a safe MIME without explicit inline policy stays download-only: %p",
  disposition => {
    expect(
      chatMediaPreview({
        "content-type": "image/png",
        "content-disposition": disposition
      })
    ).toBeNull();
  }
);
