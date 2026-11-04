// Test-only guard: permit only ephemeral HTTP servers created in this process.
const net = require("node:net");
const dns = require("node:dns");
const dgram = require("node:dgram");
const childProcess = require("node:child_process");
const allowedPorts = new Set();
const local = host => [undefined, "localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(host);
const deny = kind => {
  const error = new Error("Isolated test guard denied " + kind);
  error.code = "TEST_NETWORK_DENIED";
  throw error;
};
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const first = args[0];
  const port = typeof first === "object" ? first?.port : first;
  const host = typeof first === "object" ? first?.host : typeof args[1] === "string" ? args[1] : undefined;
  if (Number(port) !== 0 || !local(host)) return deny("non-ephemeral server");
  let ownedPort;
  const remember = () => {
    const address = this.address();
    if (address && typeof address === "object") {
      ownedPort = address.port;
      allowedPorts.add(ownedPort);
    }
  };
  this.once("listening", remember);
  this.once("close", () => allowedPorts.delete(ownedPort));
  const result = listen.apply(this, args);
  remember();
  return result;
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  if (!options || typeof options !== "object") options = { port: args[0], host: typeof args[1] === "string" ? args[1] : undefined };
  if (options.path || !local(options.host) || !allowedPorts.has(Number(options.port))) return deny("outbound socket");
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  if (!local(hostname)) return deny("external DNS");
  return lookup.call(this, hostname, ...args);
};
for (const name of ["resolve", "resolve4", "resolve6", "resolveAny", "reverse"]) dns[name] = () => deny("external DNS");
for (const name of ["resolve", "resolve4", "resolve6", "resolveAny", "reverse", "lookup"]) dns.promises[name] = async () => deny("external DNS");
dgram.createSocket = () => deny("UDP");
const spawnSync = childProcess.spawnSync;
for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) childProcess[name] = () => deny("child process");
childProcess.spawnSync = function (file, args, options) {
  // Jest 27 probes this exact built-in import before loading any tests. Permit
  // only that inert capability probe, without enabling application subprocesses.
  if (file === "node" && Array.isArray(args) && args.length === 2 && args[0] === "--eval" &&
      args[1] === 'import("node:fs").then(() => console.log(true), () => console.log(false));' && !options?.shell) {
    return spawnSync.call(this, file, args, options);
  }
  return deny("child process");
};
