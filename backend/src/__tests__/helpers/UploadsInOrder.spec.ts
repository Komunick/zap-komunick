import fs from "fs";
import os from "os";
import path from "path";
import {
  isEmptyUpload,
  sendUploadsInOrder
} from "../../helpers/UploadsInOrder";
import { logger } from "../../utils/logger";

jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

type Fixture = { path: string; name: string };

const uploads: Fixture[] = ["a.pdf", "b.jpg", "c.pdf"].map(name => ({
  path: `/uploads/${name}`,
  name
}));

// A send that takes a while, so two of them would overlap if started together.
const slowSend = (events: string[], failAt?: string) =>
  jest.fn(async (upload: Fixture) => {
    events.push(`envia ${upload.name}`);
    await new Promise(resolve => {
      setTimeout(resolve, 15);
    });
    if (upload.name === failAt) throw new Error(`falhou ${upload.name}`);
    events.push(`enviado ${upload.name}`);
  });

describe("files of one request", () => {
  it("leave one at a time, in the order chosen, each copy removed after its turn", async () => {
    const events: string[] = [];
    const remove = jest.fn((file: string) => {
      events.push(`apaga ${path.basename(file)}`);
    });

    await sendUploadsInOrder(uploads, slowSend(events), remove);

    expect(events).toEqual([
      "envia a.pdf",
      "enviado a.pdf",
      "apaga a.pdf",
      "envia b.jpg",
      "enviado b.jpg",
      "apaga b.jpg",
      "envia c.pdf",
      "enviado c.pdf",
      "apaga c.pdf"
    ]);
  });

  it("stop at the first failure, which is the error of the request, and leave no copy behind", async () => {
    const events: string[] = [];
    const send = slowSend(events, "b.jpg");
    const remove = jest.fn();

    await expect(sendUploadsInOrder(uploads, send, remove)).rejects.toThrow(
      "falhou b.jpg"
    );

    expect(events).toEqual(["envia a.pdf", "enviado a.pdf", "envia b.jpg"]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(remove.mock.calls.map(([file]) => file)).toEqual([
      "/uploads/a.pdf",
      "/uploads/b.jpg",
      "/uploads/c.pdf"
    ]);
  });

  it("remove the real copies and tolerate one that is already gone", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "zapk-uploads-"));
    const kept = path.join(folder, "a.pdf");
    fs.writeFileSync(kept, "%PDF-1.4 ficticio");
    const gone = path.join(folder, "ja-apagado.pdf");

    await sendUploadsInOrder([{ path: kept }, { path: gone }], async () => {});

    expect(fs.readdirSync(folder)).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    fs.rmdirSync(folder);
  });
});

describe("a send that brings nothing", () => {
  it.each([
    ["multipart without file and without text", [], undefined, true],
    ["multipart without file and with empty text", [], "", true],
    ["multipart without file, with text", [], "Bom dia", false],
    ["multipart with a file", [{ path: "/uploads/a.pdf" }], undefined, false],
    ["text message (no multipart)", undefined, "Bom dia", false],
    ["text message without text", undefined, undefined, false]
  ])("%s", (_case, files, body, expected) => {
    expect(isEmptyUpload(files, body)).toBe(expected);
  });
});
