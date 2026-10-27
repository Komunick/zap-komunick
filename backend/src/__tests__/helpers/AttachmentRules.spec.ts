import {
  attachmentDisposition,
  attachmentFileName,
  attachmentKind,
  attachmentRange,
  attachmentTicketId,
  detectedAttachmentMime,
  encodeAttachmentCursor,
  localAttachmentPath,
  MAX_ATTACHMENT_PREVIEW_BYTES,
  parseAttachmentQuery
} from "../../helpers/AttachmentRules";

const bytes = (value: string) =>
  Uint8Array.from(Array.from(value).map(c => c.charCodeAt(0)));
describe("attachment contract rules", () => {
  it("has an explicit 25 MiB bound and bounded list defaults", () => {
    expect(MAX_ATTACHMENT_PREVIEW_BYTES).toBe(26214400);
    expect(parseAttachmentQuery({}, true)).toEqual({
      kind: "all",
      limit: 20,
      cursor: null
    });
    expect(
      parseAttachmentQuery({ kind: "pdf", limit: "50", cursor: "" }, true)
    ).toEqual({ kind: "pdf", limit: 50, cursor: null });
  });
  it.each([
    { limit: "0" },
    { limit: "51" },
    { limit: "1.5" },
    { limit: "01" },
    { limit: ["1"] },
    { kind: "audio" },
    { companyId: "20" },
    { search: "x" },
    { cursor: "not json" }
  ])("rejects invalid or authority query %j", query => {
    expect(() => parseAttachmentQuery(query, true)).toThrow(
      "ERR_ATTACHMENT_INVALID_REQUEST"
    );
  });
  it("round trips a composite cursor and rejects malformed/extra cursor fields", () => {
    const cursor = {
      createdAt: "2026-10-27T12:00:00.000Z",
      id: "same-id",
      ticketId: 301
    };
    expect(
      parseAttachmentQuery({ cursor: encodeAttachmentCursor(cursor) }, true)
        .cursor
    ).toEqual(cursor);
    [
      { ...cursor, companyId: 20 },
      { ...cursor, ticketId: 0 },
      { ...cursor, createdAt: "invalid" },
      { ...cursor, id: "" }
    ].forEach(value => {
      expect(() =>
        parseAttachmentQuery(
          { cursor: Buffer.from(JSON.stringify(value)).toString("base64url") },
          true
        )
      ).toThrow("ERR_ATTACHMENT_INVALID_REQUEST");
    });
    expect(() => parseAttachmentQuery({ kind: "all" })).toThrow(
      "ERR_ATTACHMENT_INVALID_REQUEST"
    );
  });
  it.each(["0", "01", "-1", "1/extra", "1e2", "9007199254740992"])(
    "rejects ticket ID %s",
    id => expect(() => attachmentTicketId(id)).toThrow()
  );
  it("classifies PDF without a WhatsApp JSON and uses only a safe display filename", () => {
    expect(attachmentKind("media/10/x/Report.PDF")).toBe("pdf");
    expect(attachmentFileName("media/10/x/Report.PDF", "invalid-json")).toBe(
      "Report.PDF"
    );
    expect(
      attachmentFileName(
        "x.pdf",
        JSON.stringify({
          message: { documentMessage: { fileName: "../safe\r\nname.pdf" } }
        })
      )
    ).toBe("safe__name.pdf");
    expect(
      attachmentFileName(
        "x.pdf",
        JSON.stringify({ body: "MUST_NOT_BECOME_NAME" })
      )
    ).toBe("x.pdf");
    expect(attachmentDisposition('hello"\r\n.pdf')).not.toMatch(/[\r\n]/);
    expect(() => attachmentDisposition("bad\ud800.pdf")).not.toThrow();
    expect(
      attachmentFileName(
        "fallback.pdf",
        JSON.stringify({
          message: {
            ephemeralMessage: {
              message: { documentMessage: { fileName: "report.pdf" } }
            }
          }
        })
      )
    ).toBe("report.pdf");
  });
  it.each([
    "../outside.pdf",
    "/etc/a.pdf",
    "C:/outside.pdf",
    "media/20/x/a.pdf",
    "media-persistant/20/a.pdf",
    "media/10/../20/a.pdf",
    "media\\10\\a.pdf",
    "https://example.test/a.pdf",
    "folder/a.pdf"
  ])("rejects escape/another tenant path %s", value =>
    expect(() => localAttachmentPath(value, 10)).toThrow(
      "ERR_ATTACHMENT_NOT_FOUND"
    )
  );
  it("preserves legacy plain files and local forward paths within the office", () => {
    expect(localAttachmentPath("legacy.pdf", 10)).toBe("legacy.pdf");
    expect(
      localAttachmentPath("media/10/other-contact/other-ticket/x.pdf", 10)
    ).toContain("other-ticket");
  });
  it.each([
    ["a.pdf", "%PDF-1.7", "application/pdf"],
    ["a.gif", "GIF89a", "image/gif"],
    ["a.webp", "RIFF0000WEBP", "image/webp"],
    ["a.mp4", "0000ftypisom", "video/mp4"],
    ["a.webm", "\x1aE\xdf\xa3webm", "video/webm"],
    ["a.png", "\x89PNG\r\n\x1a\n", "image/png"],
    ["a.jpg", "\xff\xd8\xff", "image/jpeg"]
  ])("matches the %s signature", (name, data, mime) =>
    expect(detectedAttachmentMime(bytes(data), name)).toBe(mime)
  );
  it.each([
    ["a.pdf", "<html>"],
    ["a.html", "%PDF-1.7"],
    ["a.svg", "<svg/>"],
    ["a.mp4", "0000ftypqt  "],
    ["a.webm", "\x1aE\xdf\xa3matroska"]
  ])("blocks mismatch/active type %s", (name, data) =>
    expect(detectedAttachmentMime(bytes(data), name)).toBeNull()
  );
  it.each([
    [undefined, 0, 99, false],
    ["bytes=0-9", 0, 9, true],
    ["bytes=95-", 95, 99, true],
    ["bytes=-10", 90, 99, true],
    ["bytes=95-999", 95, 99, true],
    ["bytes=-999", 0, 99, true]
  ])("supports single range %s", (range, start, end, partial) =>
    expect(attachmentRange(range, 100)).toEqual({ start, end, partial })
  );
  it.each([
    "bytes=100-",
    "bytes=9-2",
    "bytes=-0",
    "bytes=-",
    "bytes=0-1,3-4",
    "items=0-1",
    "bytes=9007199254740992-"
  ])("rejects unsatisfiable/multipart range %s", value =>
    expect(() => attachmentRange(value, 100)).toThrow("ERR_ATTACHMENT_RANGE")
  );
});
