"use strict";

const http = require("node:http");
const net = require("node:net");
const { Resolver } = require("node:dns").promises;

const MAX_CLIENTS = 32;
const CONNECT_TIMEOUT_MS = 8000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const WHATSAPP_DOMAINS = ["whatsapp.com", "whatsapp.net"];
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function allowedHost(authority) {
  const match = /^([^:]+):443$/.exec(authority);
  if (!match) return null;
  const host = match[1].toLowerCase();
  if (host.length > 253 || !host.split(".").every(label => LABEL.test(label))) {
    return null;
  }
  const allowed = WHATSAPP_DOMAINS.some(
    domain => host === domain || host.endsWith("." + domain)
  );
  return allowed ? host : null;
}

function publicIPv4(ip) {
  if (!net.isIPv4(ip)) return false;
  const [a, b, c] = ip.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function newResolver() {
  return new Resolver({ timeout: 3000, tries: 1 });
}

function createProxy(
  { clientIP },
  { createResolver = newResolver, connect = net.createConnection } = {}
) {
  if (!net.isIPv4(clientIP)) throw new Error("Expected an exact client IPv4");

  const server = http.createServer(
    { requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 4096 },
    (_req, res) => {
      res.writeHead(405, { Connection: "close", "Content-Length": "0" });
      res.end();
    }
  );
  server.maxConnections = MAX_CLIENTS;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 1;
  server.on("connection", socket => {
    if (socket.remoteAddress !== clientIP) {
      socket.destroy();
      return;
    }
    socket.setTimeout(5000, () => socket.destroy());
  });

  server.on("connect", async (req, client, head) => {
    const host = allowedHost(req.url);
    function reject(status) {
      client.end("HTTP/1.1 " + status + "\r\nConnection: close\r\n\r\n");
    }
    if (client.remoteAddress !== clientIP || !host) {
      reject("403 Forbidden");
      return;
    }

    const resolver = createResolver();
    let upstream;
    let established = false;
    const deadline = setTimeout(() => {
      resolver.cancel();
      if (upstream) upstream.destroy();
      reject("504 Gateway Timeout");
    }, CONNECT_TIMEOUT_MS);

    client.once("error", () => client.destroy());
    client.once("close", () => {
      clearTimeout(deadline);
      resolver.cancel();
      if (upstream) upstream.destroy();
    });

    try {
      const addresses = await resolver.resolve4(host);
      if (client.destroyed || client.writableEnded) return;
      // Connect to the address checked here, never resolve the hostname again.
      const address = addresses.find(publicIPv4);
      if (!address) {
        clearTimeout(deadline);
        reject("403 Forbidden");
        return;
      }

      upstream = connect({ host: address, port: 443, family: 4 });
      upstream.once("error", () => {
        clearTimeout(deadline);
        if (established) client.destroy();
        else if (!client.destroyed && !client.writableEnded) reject("502 Bad Gateway");
      });
      upstream.once("close", () => {
        clearTimeout(deadline);
        if (established) client.destroy();
      });
      upstream.once("connect", () => {
        if (client.destroyed || client.writableEnded) {
          upstream.destroy();
          return;
        }
        clearTimeout(deadline);
        established = true;
        client.setTimeout(IDLE_TIMEOUT_MS);
        upstream.setTimeout(IDLE_TIMEOUT_MS, () => upstream.destroy());
        client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        client.pipe(upstream);
        upstream.pipe(client);
      });
    } catch {
      clearTimeout(deadline);
      if (!client.destroyed && !client.writableEnded) reject("502 Bad Gateway");
    }
  });

  return server;
}

if (require.main === module) {
  const bindIP = process.env.SUPERCHAT_WA_PROXY_BIND;
  const clientIP = process.env.SUPERCHAT_WA_PROXY_CLIENT;
  const port = Number(process.env.SUPERCHAT_WA_PROXY_PORT || "3128");
  if (
    !net.isIPv4(bindIP) ||
    bindIP === "0.0.0.0" ||
    !net.isIPv4(clientIP) ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    process.stderr.write("Invalid WhatsApp egress proxy configuration\n");
    process.exitCode = 1;
  } else {
    const proxy = createProxy({ clientIP });
    proxy.on("error", () => {
      process.stderr.write("WhatsApp egress proxy listener failed\n");
      process.exitCode = 1;
    });
    proxy.listen({ host: bindIP, port });
  }
}

module.exports = { createProxy, allowedHost, publicIPv4 };
