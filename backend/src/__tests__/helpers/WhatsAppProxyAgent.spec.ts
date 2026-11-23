import { createServer } from "http";
import { get } from "https";
import { AddressInfo } from "net";
import { createWhatsAppProxyAgent } from "../../helpers/WhatsAppProxyAgent";

describe("WhatsApp proxy agent", () => {
  it("preserves direct mode when no proxy is configured", () => {
    expect(createWhatsAppProxyAgent("")).toBeNull();
  });

  it.each([
    "socks5://proxy.local:1080",
    "http:proxy.local",
    "http://proxy.local/path",
    "http://proxy.local/?token=ficticio",
    "http://user:ficticio@proxy.local",
    " "
  ])(
    "rejects an invalid proxy origin without returning a direct agent",
    url => {
      expect(() => createWhatsAppProxyAgent(url)).toThrow(
        "SUPERCHAT_WHATSAPP_PROXY_URL must be an HTTP(S) proxy origin without credentials"
      );
    }
  );

  it("sends a CONNECT to the proxy without resolving the destination locally", async () => {
    const targets: string[] = [];
    const proxy = createServer();
    proxy.on("connect", (request, socket) => {
      targets.push(request.url);
      socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n");
    });
    await new Promise<void>((resolve, reject) => {
      proxy.once("error", reject);
      proxy.listen(0, "127.0.0.1", resolve);
    });
    const { port } = proxy.address() as AddressInfo;
    const agent = createWhatsAppProxyAgent(`http://127.0.0.1:${port}`);

    try {
      await new Promise<void>((resolve, reject) => {
        const request = get("https://whatsapp-proxy-fixture.invalid/ws", {
          agent,
          timeout: 1000
        });
        request.once("error", () => resolve());
        request.once("timeout", () => request.destroy(new Error("Timed out")));
        request.once("response", response => {
          response.resume();
          reject(new Error("Unexpected success"));
        });
      });
      expect(targets).toEqual(["whatsapp-proxy-fixture.invalid:443"]);
    } finally {
      agent.destroy();
      await new Promise<void>(resolve => proxy.close(() => resolve()));
    }
  });
});
