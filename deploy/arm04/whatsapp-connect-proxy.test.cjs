"use strict";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const net = require("node:net");
const test = require("node:test");
const { createProxy, allowedHost, publicIPv4 } = require("./whatsapp-connect-proxy.cjs");

const loopback = "127.0.0.1";
const connectRequest = authority =>
  "CONNECT " + authority + " HTTP/1.1\r\nHost: " + authority + "\r\n\r\n";

async function listen(server, t) {
  server.listen(0, loopback);
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  return server.address().port;
}

function makeResolver(addresses, calls = []) {
  return () => ({
    resolve4: async host => {
      calls.push(host);
      return addresses;
    },
    cancel() {}
  });
}

function exchange(port, request, { waitFor, allowReset = false } = {}) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host: loopback, port });
    let reply = "";
    client.setTimeout(2000, () => client.destroy(new Error("test timed out")));
    client.once("connect", () => client.write(request));
    client.on("data", chunk => {
      reply += chunk.toString("utf8");
      if (waitFor && reply.includes(waitFor)) client.destroy();
    });
    client.once("error", error => {
      if (!allowReset || error.code !== "ECONNRESET") reject(error);
    });
    client.once("close", () => resolve(reply));
  });
}

test("accepts only DNS-label WhatsApp domains on 443", () => {
  assert.equal(allowedHost("Web.WhatsApp.Com:443"), "web.whatsapp.com");
  assert.equal(allowedHost("whatsapp.net:443"), "whatsapp.net");
  assert.equal(allowedHost("mmg.whatsapp.net:443"), "mmg.whatsapp.net");
  for (const invalid of [
    "evilwhatsapp.com:443", "whatsapp.com.evil.example:443",
    "web.whatsapp.com:80", "web.whatsapp.com", "whatsapp.com.:443",
    "https://whatsapp.com:443", "user@whatsapp.com:443",
    "-web.whatsapp.com:443", "web..whatsapp.com:443",
    "127.0.0.1:443", "[::1]:443", "waversion.ticke.tz:443"
  ]) {
    assert.equal(allowedHost(invalid), null, invalid);
  }
});

test("rejects nonpublic, IPv6, and reserved resolved addresses", () => {
  for (const ip of [
    "0.4.3.2", "10.0.0.3", "100.64.1.2", "100.127.1.2", "127.0.0.1",
    "169.254.169.254", "172.16.1.2", "172.31.1.2", "192.0.0.1",
    "192.0.2.1", "192.88.99.1", "192.168.1.2", "198.18.1.2", "198.19.1.2",
    "198.51.100.1", "203.0.113.1", "224.1.1.1", "240.1.1.1", "255.255.255.255",
    "::1", "::ffff:127.0.0.1"
  ]) {
    assert.equal(publicIPv4(ip), false, ip);
  }
  for (const ip of ["8.8.8.8", "31.13.65.34", "100.63.1.2", "172.32.1.2"]) {
    assert.equal(publicIPv4(ip), true, ip);
  }
});

test("bad CONNECT and private DNS result never attempt an upstream connection", async t => {
  const dnsCalls = [];
  const proxy = createProxy({ clientIP: loopback }, {
    createResolver: makeResolver(["169.254.169.254", "127.0.0.1", "10.1.2.3"], dnsCalls),
    connect: () => assert.fail("attempted denied upstream")
  });
  const port = await listen(proxy, t);

  for (const authority of ["example.com:443", "web.whatsapp.com:80", "web.whatsapp.com"]) {
    assert.match(await exchange(port, connectRequest(authority)), /^HTTP\/1\.1 403 /);
  }
  assert.deepEqual(dnsCalls, []);
  assert.match(await exchange(port, connectRequest("web.whatsapp.com:443")), /^HTTP\/1\.1 403 /);
  assert.deepEqual(dnsCalls, ["web.whatsapp.com"]);
  assert.match(
    await exchange(port, "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"),
    /^HTTP\/1\.1 405 /
  );
});

test("requests from another client are dropped before DNS", async t => {
  const proxy = createProxy({ clientIP: "127.0.0.2" }, {
    createResolver: () => assert.fail("attempted DNS for denied client")
  });
  const port = await listen(proxy, t);
  assert.equal(
    await exchange(port, connectRequest("web.whatsapp.com:443"), { allowReset: true }),
    ""
  );
});

test("approved CONNECT pins a public IPv4 and forwards tunnel bytes unchanged", async t => {
  const echo = net.createServer(socket => socket.pipe(socket));
  const echoPort = await listen(echo, t);
  const dnsCalls = [];
  const targets = [];
  const proxy = createProxy({ clientIP: loopback }, {
    createResolver: makeResolver(["127.0.0.1", "31.13.65.34"], dnsCalls),
    connect: options => {
      targets.push(options);
      return net.createConnection({ host: loopback, port: echoPort });
    }
  });
  const port = await listen(proxy, t);
  const reply = await exchange(
    port,
    connectRequest("web.whatsapp.com:443") + "fixture-encrypted-bytes",
    { waitFor: "fixture-encrypted-bytes" }
  );
  assert.equal(
    reply,
    "HTTP/1.1 200 Connection Established\r\n\r\nfixture-encrypted-bytes"
  );
  assert.deepEqual(dnsCalls, ["web.whatsapp.com"]);
  assert.deepEqual(targets, [{ host: "31.13.65.34", port: 443, family: 4 }]);
});
