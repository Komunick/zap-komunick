import {
  chatMediaBasename,
  chatMediaDelivery,
  chatMediaUrl,
  detectedChatMediaMime,
  hasChatMediaMigrationConflict,
  isChatUploadName,
  publicChatMediaReference
} from "../../helpers/ChatMediaRules";

describe("private chat media rules", () => {
  it.each([
    "",
    ".",
    "..",
    ".hidden",
    "../x",
    "a/b",
    "a\\b",
    "bad\nname",
    "x\0.png",
    "x".repeat(256),
    null,
    {}
  ])("rejects unsafe storage names %p", value => {
    expect(chatMediaBasename(value)).toBeUndefined();
  });
  it("keeps legacy basenames and recognizes only the owned UUID namespace", () => {
    expect(chatMediaBasename("1890171090516.png")).toBe("1890171090516.png");
    expect(
      isChatUploadName("chat-11111111-1111-4111-8111-111111111111.ogg")
    ).toBe(true);
    expect(isChatUploadName("1890171090516.png")).toBe(false);
    expect(isChatUploadName("chat-not-a-uuid.png")).toBe(false);
  });
  it("identifies content without storage names or token query strings", () => {
    expect(chatMediaUrl(301, 91, "https://example.invalid/backend/")).toBe(
      "https://example.invalid/backend/chats/301/messages/91/media"
    );
    expect(
      chatMediaUrl("../301", 91, "https://example.invalid/backend")
    ).toBeNull();
  });
  it("normalizes structural public references without treating external URLs or nested paths as the same file", () => {
    const base = "https://example.invalid/backend";
    expect(publicChatMediaReference("189.png", base)).toBe("189.png");
    expect(
      publicChatMediaReference(
        "https://example.invalid/backend/public/189.png?inline=1",
        base
      )
    ).toBe("189.png");
    expect(publicChatMediaReference("/backend/public/189%2Epng", base)).toBe(
      "189.png"
    );
    expect(publicChatMediaReference('"189.png"', base)).toBe("189.png");
    expect(
      publicChatMediaReference("https://other.invalid/public/189.png", base)
    ).toBeUndefined();
    expect(
      publicChatMediaReference("media/tickets/189.png", base)
    ).toBeUndefined();
    expect(
      publicChatMediaReference("/public/..%2Fprivate", base)
    ).toBeUndefined();
    expect(
      publicChatMediaReference('{"body":"189.png"}', base)
    ).toBeUndefined();
  });

  it("recognizes the configured frontend public ingress when its origin differs from the backend", () => {
    expect(
      publicChatMediaReference(
        "https://frontend.example.invalid/backend/public/189.png?inline=1",
        "http://backend.internal:8080",
        "https://frontend.example.invalid"
      )
    ).toBe("189.png");
    expect(
      publicChatMediaReference(
        "https://external.example.invalid/backend/public/189.png",
        "http://backend.internal:8080",
        "https://frontend.example.invalid"
      )
    ).toBeUndefined();
  });
  it.each(["text/html", "image/svg+xml", "application/xhtml+xml", false])(
    "does not give active or unknown content inline execution: %p",
    mime => {
      expect(chatMediaDelivery(mime as string | false, false)).toEqual({
        contentType: "application/octet-stream",
        inline: false
      });
    }
  );
  it("keeps safe native formats inline and allows explicit downloads", () => {
    expect(chatMediaDelivery("video/mp4", false)).toEqual({
      contentType: "video/mp4",
      inline: true
    });
    expect(chatMediaDelivery("application/pdf", true)).toEqual({
      contentType: "application/pdf",
      inline: false
    });
  });

  it("blocks removal of shared public bytes, not missing or already private files", () => {
    const state = {
      invalidReferences: 0,
      unsafeStorage: false,
      files: [{ public: false, sharedTables: ["Announcements"] }]
    };
    expect(hasChatMediaMigrationConflict(state)).toBe(false);
    expect(
      hasChatMediaMigrationConflict({
        ...state,
        files: [{ public: true, sharedTables: ["Announcements"] }]
      })
    ).toBe(true);
  });
  const ascii = (text: string) =>
    Uint8Array.from(Array.from(text).map(character => character.charCodeAt(0)));
  it.each([
    [
      "PNG",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image",
      "image/png"
    ],
    ["JPEG", new Uint8Array([255, 216, 255, 224]), "image", "image/jpeg"],
    ["PDF", ascii("%PDF-1.7"), "application", "application/pdf"],
    ["GIF", ascii("GIF89a"), "image", "image/gif"],
    ["WEBP", ascii("RIFFxxxxWEBP"), "image", "image/webp"],
    [
      "BMP",
      new Uint8Array([66, 77, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 0, 0, 0]),
      "image",
      "image/bmp"
    ],
    ["AVIF", ascii("\0\0\0\x18ftypavif\0\0\0\0avif"), "image", "image/avif"],
    ["OGG", ascii("OggS\0fictional"), "audio", "audio/ogg"],
    ["WAV", ascii("RIFFxxxxWAVEfmt "), "audio", "audio/wav"],
    ["MP4", ascii("\0\0\0\x18ftypisom\0\0\0\0isom"), "video", "video/mp4"],
    [
      "MP4 audio",
      ascii("\0\0\0\x18ftypisom\0\0\0\0isom"),
      "audio",
      "audio/mp4"
    ],
    [
      "QuickTime",
      ascii("\0\0\0\x18ftypqt  \0\0\0\0qt  "),
      "video",
      "video/quicktime"
    ],
    [
      "WEBM",
      new Uint8Array([26, 69, 223, 163, ...ascii("webm")]),
      "video",
      "video/webm"
    ],
    [
      "WEBM audio",
      new Uint8Array([26, 69, 223, 163, ...ascii("webm")]),
      "audio",
      "audio/webm"
    ],
    ["MPEG audio", new Uint8Array([255, 251, 144, 0]), "audio", "audio/mpeg"],
    [
      "AAC",
      new Uint8Array([255, 241, 80, 128, 1, 127, 252]),
      "audio",
      "audio/aac"
    ],
    ["FLAC", ascii("fLaC"), "audio", "audio/flac"]
  ])(
    "keeps known legacy %s without an extension recognizable",
    (_name, prefix, category, mime) => {
      expect(
        detectedChatMediaMime(
          prefix as Uint8Array,
          "1890171090516",
          category as string
        )
      ).toBe(mime);
      expect(chatMediaDelivery(mime as string, false).inline).toBe(true);
    }
  );
  it("does not classify active or masked content from the display/storage extension alone", () => {
    expect(
      detectedChatMediaMime(
        ascii("<html>fictional</html>"),
        "fixture.png",
        "image"
      )
    ).toBeNull();
    expect(
      detectedChatMediaMime(
        ascii("<svg>fictional</svg>"),
        "fixture.png",
        "image"
      )
    ).toBeNull();
    expect(
      detectedChatMediaMime(
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
        "fixture.svg",
        "image"
      )
    ).toBeNull();
  });
});
