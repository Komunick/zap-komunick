import { createServer, Server, ServerResponse } from "http";
import { AddressInfo } from "net";
import { PassThrough, Transform } from "stream";
import axios from "axios";
// The same function the library uses for app state, history and media.
import { downloadEncryptedContent } from "libzapitu-rf";
import {
  getStreamGuardOptions,
  guardHttpStream
} from "../../helpers/HttpStreamGuard";

const keys = {
  cipherKey: Buffer.alloc(32),
  iv: Buffer.alloc(16)
};

const read = async (stream: AsyncIterable<unknown>) => {
  const chunks: string[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of stream) {
    chunks.push((chunk as Buffer).toString("latin1"));
  }
  return chunks.join("");
};

describe("HttpStreamGuard", () => {
  let server: Server;

  const serve = async (
    handler: (response: ServerResponse) => void
  ): Promise<string> => {
    server = createServer((_request, response) => handler(response));
    await new Promise<void>(resolve => {
      server.listen(0, "127.0.0.1", resolve);
    });
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  };

  afterEach(async () => {
    if (!server) return;
    (
      server as Server & { closeAllConnections?: () => void }
    ).closeAllConnections?.();
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    server = undefined;
  });

  it("fails a library download cut in the middle instead of waiting forever", async () => {
    const url = await serve(response => {
      response.writeHead(200, { "content-length": 100000 });
      response.write(Buffer.alloc(5000));
      setTimeout(() => response.destroy(), 50);
    });

    const stream = await downloadEncryptedContent(url, keys, {
      options: getStreamGuardOptions()
    });

    await expect(read(stream)).rejects.toThrow();
  }, 5000);

  it("fails when the body stops arriving", async () => {
    const url = await serve(response => {
      response.writeHead(200, { "content-length": 100000 });
      response.write(Buffer.alloc(5000));
    });
    const { data } = await axios.get(url, { responseType: "stream" });
    const output = new PassThrough();

    guardHttpStream(data, 100).pipe(output);

    await expect(read(output)).rejects.toThrow("WhatsApp download stalled");
    expect(data.destroyed).toBe(true);
  }, 5000);

  it("keeps the failure for a reader that starts later", async () => {
    const url = await serve(response => {
      response.writeHead(200, { "content-length": 100000 });
      response.write(Buffer.alloc(5000));
      setTimeout(() => response.destroy(), 20);
    });
    const { data } = await axios.get(url, { responseType: "stream" });
    const output = new PassThrough();
    guardHttpStream(data).pipe(output);

    await new Promise(resolve => {
      setTimeout(resolve, 200);
    });
    await expect(read(output)).rejects.toThrow();
  }, 5000);

  it("delivers a complete body unchanged, even to a slow reader", async () => {
    const body = Buffer.alloc(300000, 7);
    const url = await serve(response => {
      response.writeHead(200, { "content-length": body.length });
      response.end(body);
    });
    const { data } = await axios.get(url, {
      ...getStreamGuardOptions(),
      responseType: "stream"
    });
    const slow = new Transform({
      transform(chunk, _encoding, done) {
        setTimeout(() => done(null, chunk), 1);
      }
    });

    const received = await read(data.pipe(slow));
    expect(received === body.toString("latin1")).toBe(true);
  }, 10000);

  it("keeps parsing JSON answers, such as the media upload ones", async () => {
    const url = await serve(response => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"url":"ok"}');
    });
    const { data } = await axios.get(url, {
      ...getStreamGuardOptions(),
      responseType: "json"
    });
    expect(data).toEqual({ url: "ok" });
  });
});
