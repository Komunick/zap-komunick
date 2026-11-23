import fs from "fs";
import os from "os";
import path from "path";
import { Readable } from "stream";
import SendWhatsAppMedia from "../../services/WbotServices/SendWhatsAppMedia";
import uploadConfig from "../../config/upload";
import { safeUploadExtension } from "../../helpers/SafeUploadExtension";
import { publicFileRelativePath } from "../../helpers/PublicFilePathRules";
import {
  MAX_MEDIA_NAME_BYTES,
  MAX_MEDIA_URL_LENGTH,
  storedMediaFileName
} from "../../helpers/MediaFileName";

// A real temporary public folder receives the copy written by saveMediaToFile;
// only WhatsApp and the database insert are fakes.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "zapk-pdf-"));
const publicDir = path.join(sandbox, "public");
const uploadsDir = path.join(sandbox, "uploads");
fs.mkdirSync(publicDir);
fs.mkdirSync(uploadsDir);

const sendMessage = jest.fn();
const verifyMediaMessage = jest.fn();

jest.mock("../../helpers/GetPublicPath", () => ({
  getPublicPath: () => publicDir
}));
// @flystorage normalizes paths with the platform separator, so on Windows it
// skips creating parent folders. This stand-in writes the same relative path
// the same way on every platform; the bytes still land on disk.
jest.mock("@flystorage/local-fs", () => ({
  LocalStorageAdapter: class {
    constructor(public root: string) {}
  }
}));
jest.mock("@flystorage/file-storage", () => ({
  FileStorage: class {
    constructor(private adapter: { root: string }) {}

    async write(relative: string, contents: NodeJS.ReadableStream) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodePath = require("path");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeFs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { pipeline } = require("stream/promises");
      const target = nodePath.join(this.adapter.root, ...relative.split("/"));
      nodeFs.mkdirSync(nodePath.dirname(target), { recursive: true });
      await pipeline(contents, nodeFs.createWriteStream(target));
    }
  }
}));
jest.mock("../../helpers/GetTicketWbot", () =>
  jest.fn(async () => ({ sendMessage }))
);
jest.mock("../../helpers/CheckSettings", () => jest.fn(async () => "15"));
jest.mock("../../models/Ticket", () => ({}));
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  verifyMediaMessage: (...args: unknown[]) => verifyMediaMessage(...args),
  verifyMessage: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: () => "5571999990000@s.whatsapp.net"
}));
jest.mock("../../utils/logger", () => ({
  logger: { error: jest.fn(), debug: jest.fn(), warn: jest.fn() }
}));

// Fictional ticket: company 2, a six-digit contact and ticket id, as in
// production-sized databases.
const ticket = { id: 654321, contactId: 123456, companyId: 2 } as never;
const pdfText = ["%PDF-1.4", "% ficticio", "%%EOF", ""].join("\n");

// multer delivers the multipart file name decoded as latin1.
const asMulterName = (name: string) =>
  Buffer.from(name, "utf8").toString("latin1");

const upload = (originalName: string): Express.Multer.File => {
  const stored = path.join(
    uploadsDir,
    `${Date.now()}${safeUploadExtension(asMulterName(originalName))}`
  );
  fs.writeFileSync(stored, pdfText);
  return {
    fieldname: "medias",
    originalname: asMulterName(originalName),
    encoding: "7bit",
    mimetype: "application/pdf",
    size: pdfText.length,
    destination: uploadsDir,
    filename: path.basename(stored),
    path: stored,
    buffer: undefined,
    stream: undefined
  };
};

const readStream = async (stream: Readable): Promise<string> => {
  let text = "";
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of stream) text += chunk.toString("utf8");
  return text;
};

const longName = `${"Relatório de apuração do Simples Nacional - competência outubro de 2026 - ".repeat(
  3
)}Empresa Fictícia Comércio e Serviços LTDA.PDF`;

beforeEach(() => {
  sendMessage.mockImplementation(async (_jid, options) => ({
    key: { id: "FAKE", fromMe: true, remoteJid: "x" },
    options
  }));
  // Messages.mediaUrl is VARCHAR(255): Postgres rejects anything longer.
  verifyMediaMessage.mockImplementation(
    async (_msg, _ticket, _contact, opts) => {
      if (opts.mediaInfo.mediaUrl.length > 255)
        throw new Error("value too long for type character varying(255)");
      return {};
    }
  );
});

afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("sending a PDF from the ticket screen", () => {
  it.each([
    "Relatorio.PDF",
    "Guia DAS março 2026.pdf",
    "Nota fiscal nº 123 (cópia) #2 100%.pdf",
    longName
  ])("sends %p as a PDF document and keeps a readable copy", async name => {
    await SendWhatsAppMedia({ media: upload(name), ticket });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const options = sendMessage.mock.calls[0][1];
    expect(options.mimetype).toBe("application/pdf");
    expect(options.fileName).toBe(name);
    expect(await readStream(options.document.stream)).toBe(pdfText);

    const { mediaUrl, filename } =
      verifyMediaMessage.mock.calls[0][3].mediaInfo;
    expect(filename).toBe(name);
    expect(mediaUrl.length).toBeLessThanOrEqual(MAX_MEDIA_URL_LENGTH);
    expect(mediaUrl).toMatch(/^media\/2\/123456\/654321\/[A-Za-z0-9]{10}\//);
    expect(mediaUrl).toMatch(/\.(pdf|PDF)$/);
    expect(publicFileRelativePath(mediaUrl)).toBe(mediaUrl);
    expect(fs.readFileSync(path.join(publicDir, mediaUrl), "utf8")).toBe(
      pdfText
    );
  });
});

describe("stored media names", () => {
  it("keeps short names, accents and the original extension case", () => {
    expect(storedMediaFileName("Guia DAS março.PDF", "application/pdf")).toBe(
      "Guia DAS março.PDF"
    );
  });

  it("replaces characters that break paths or public URLs", () => {
    expect(
      storedMediaFileName('a/b\\c:d*e?f"g<h>i|j%k#l‮.pdf', "application/pdf")
    ).toBe("a_b_c_d_e_f_g_h_i_j_k_l_.pdf");
  });

  it("shortens long names to fit the column and the filesystem", () => {
    const prefix = "media/2/123456/654321/abcdefghij/";
    const name = storedMediaFileName(
      longName,
      "application/pdf",
      prefix.length
    );
    expect((prefix + name).length).toBeLessThanOrEqual(MAX_MEDIA_URL_LENGTH);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(MAX_MEDIA_NAME_BYTES);
    expect(name.startsWith("Relatório de apuração")).toBe(true);
    expect(name.endsWith(".PDF")).toBe(true);
  });

  it("derives the extension from the mimetype when the name has none", () => {
    expect(storedMediaFileName("contrato", "application/pdf")).toBe(
      "contrato.pdf"
    );
    expect(storedMediaFileName("", "application/pdf")).toMatch(/^\d+\.pdf$/);
  });
});

describe("multer names for one request", () => {
  it("gives distinct names to files that start in the same millisecond", () => {
    jest.spyOn(Date.prototype, "getTime").mockReturnValue(1763400000000);
    const storage = uploadConfig.storage as unknown as {
      getFilename: (
        req: unknown,
        file: { originalname: string },
        cb: (error: Error | null, name: string) => void
      ) => void;
    };
    const names: string[] = [];
    ["a.pdf", "b.pdf", "c.PDF"].forEach(originalname =>
      storage.getFilename({}, { originalname }, (_error, name) =>
        names.push(name)
      )
    );
    jest.restoreAllMocks();

    expect(new Set(names).size).toBe(3);
    expect(names[2]).toMatch(/\.PDF$/);
  });
});
