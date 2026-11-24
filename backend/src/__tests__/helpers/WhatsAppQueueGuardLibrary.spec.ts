import { createServer, AddressInfo, Server, Socket } from "net";
import { Boom } from "@hapi/boom";
import makeWASocket, { initAuthCreds } from "libzapitu-rf";
import type { loggerBaileys } from "../../utils/logger";
import { guardQueue } from "../../helpers/WhatsAppQueueGuard";

// The guard depends on two details of the library: the socket exposes the
// queue, and the library calls it through the exposed object. A library update
// that changes either one must fail here instead of silently disabling it.
describe("WhatsAppQueueGuard with the real library", () => {
  let server: Server;
  const clients: Socket[] = [];

  beforeEach(async () => {
    // accepts the connection and never answers: no real WhatsApp involved
    server = createServer(client => {
      client.on("error", () => undefined);
      clients.push(client);
    });
    await new Promise<void>(resolve => {
      server.listen(0, "127.0.0.1", resolve);
    });
  });

  afterEach(async () => {
    clients.forEach(client => client.destroy());
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  it("notices a receipt that never ends and closes with a reconnectable code", async () => {
    const creds = initAuthCreds();
    creds.me = { id: "5500000000000:1@s.whatsapp.net", name: "Teste" };

    const wsocket = makeWASocket({
      waWebSocketUrl: `ws://127.0.0.1:${
        (server.address() as AddressInfo).port
      }`,
      logger: {
        level: "silent",
        child() {
          return this;
        },
        trace: () => undefined,
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      } as unknown as typeof loggerBaileys,
      auth: {
        creds,
        keys: { get: async () => ({}), set: async () => undefined }
      },
      // the retry receipt waits for this message forever
      getMessage: () => new Promise(() => undefined)
    });

    const closed = new Promise<number>(resolve => {
      wsocket.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
          resolve((lastDisconnect?.error as Boom)?.output?.statusCode);
        }
      });
    });

    guardQueue(wsocket.processingMutex, 100, () =>
      wsocket.end(new Boom("stalled", { statusCode: 408 }))
    );

    wsocket.ws.emit("CB:receipt", {
      tag: "receipt",
      attrs: {
        id: "TESTE1",
        from: "5500000000001@s.whatsapp.net",
        type: "retry"
      },
      content: [{ tag: "retry", attrs: { count: "1", id: "TESTE1" } }]
    });

    await expect(closed).resolves.toBe(408);
  }, 10000);
});
