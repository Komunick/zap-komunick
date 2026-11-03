import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { openAttachmentFile } from "../../services/AttachmentServices/AttachmentFileService";
import { isProtectedChatPublicPath } from "../../services/ChatService/ChatMediaMigrationService";

let mockRoot: string;
jest.mock("../../helpers/GetPublicPath", () => ({
  getPublicPath: () => mockRoot
}));
jest.mock(
  "../../services/ChatService/ChatMediaMigrationService",
  () => ({ isProtectedChatPublicPath: jest.fn() }),
  { virtual: true }
);
const pdf = new TextEncoder().encode("%PDF-1.7\nFICTITIOUS ONLY\n");
describe("attachment descriptor and filesystem fence using temporary fictitious files", () => {
  let temp: string;
  beforeEach(() => {
    (isProtectedChatPublicPath as jest.Mock).mockImplementation(
      async value => value === "private-chat.pdf"
    );
  });
  beforeAll(async () => {
    temp = await fs.mkdtemp(path.join(os.tmpdir(), "zk-attachment-test-"));
    mockRoot = path.join(temp, "public");
    await fs.mkdir(path.join(mockRoot, "media", "10", "x"), {
      recursive: true
    });
    await fs.mkdir(path.join(mockRoot, "media", "20"), { recursive: true });
    await fs.writeFile(path.join(mockRoot, "media", "10", "x", "a.pdf"), pdf);
    await fs.writeFile(path.join(mockRoot, "media", "20", "b.pdf"), pdf);
    await fs.writeFile(path.join(temp, "outside.pdf"), pdf);
    await fs.writeFile(path.join(mockRoot, "private-chat.pdf"), pdf);
    await fs.symlink(
      path.join(mockRoot, "private-chat.pdf"),
      path.join(mockRoot, "media", "10", "private-alias.pdf")
    );
    await fs.writeFile(
      path.join(mockRoot, "fake.pdf"),
      "<html>FICTITIOUS</html>"
    );
    await fs.symlink(
      path.join(temp, "outside.pdf"),
      path.join(mockRoot, "escape.pdf")
    );
    await fs.symlink(
      path.join(mockRoot, "media", "20", "b.pdf"),
      path.join(mockRoot, "media", "10", "cross.pdf")
    );
  });
  afterAll(async () => {
    await fs.rm(temp, { recursive: true, force: true });
  });
  it("opens actual local bytes, reads only a signature and leaves a usable descriptor", async () => {
    const file = await openAttachmentFile("media/10/x/a.pdf", 10);
    try {
      expect(file.mimeType).toBe("application/pdf");
      expect(file.size).toBe(pdf.length);
      const data = new Uint8Array(file.size);
      await file.handle.read(data, 0, data.length, 0);
      expect(data).toEqual(pdf);
    } finally {
      await file.handle.close();
    }
  });
  it.each([
    "../outside.pdf",
    "escape.pdf",
    "media/10/cross.pdf",
    "media/20/b.pdf",
    "media/10/x",
    "missing.pdf",
    "https://example.test/a.pdf"
  ])("rejects %s without disclosing the path", async raw => {
    await expect(openAttachmentFile(raw, 10)).rejects.toMatchObject({
      message: "ERR_ATTACHMENT_NOT_FOUND",
      statusCode: 404
    });
  });
  it("does not infer PDF MIME from its extension alone", async () => {
    const file = await openAttachmentFile("fake.pdf", 10);
    expect(file.mimeType).toBeNull();
    await file.handle.close();
  });
  it.each(["private-chat.pdf", "media/10/private-alias.pdf"])(
    "refuses private chat bytes through the ticket API descriptor: %s",
    async raw => {
      await expect(openAttachmentFile(raw, 10)).rejects.toMatchObject({
        message: "ERR_ATTACHMENT_NOT_FOUND",
        statusCode: 404
      });
    }
  );
  it("keeps the opened inode even if its pathname is replaced later", async () => {
    const original = path.join(mockRoot, "stable.pdf");
    await fs.writeFile(original, pdf);
    const file = await openAttachmentFile("stable.pdf", 10);
    await fs.rename(original, path.join(mockRoot, "old.pdf"));
    await fs.writeFile(original, "DIFFERENT FICTITIOUS DATA");
    const bytes = new Uint8Array(5);
    await file.handle.read(bytes, 0, 5, 0);
    expect(new TextDecoder().decode(bytes)).toBe("%PDF-");
    await file.handle.close();
  });
});
