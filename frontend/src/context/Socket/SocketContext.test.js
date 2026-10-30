import openSocket from "socket.io-client";
import { decodeToken, isExpired } from "react-jwt";
import { socketManager } from "./SocketContext";
import { readStoredToken } from "../../helpers/storedToken";
import api from "../../services/api";

jest.mock("socket.io-client", () => jest.fn());
jest.mock("react-jwt", () => ({
  decodeToken: jest.fn(),
  isExpired: jest.fn()
}));
jest.mock("../../helpers/storedToken", () => ({ readStoredToken: jest.fn() }));
jest.mock("../../services/config", () => ({
  getBackendSocketURL: () => "http://fixture.invalid"
}));
jest.mock("../../services/api", () => ({
  post: jest.fn(),
  defaults: { headers: {} }
}));
jest.mock("react-toastify", () => ({ toast: { error: jest.fn() } }));

let storedToken;
let payloads;
let sockets;
let debug;

const listeners = () => {
  const events = new Map();
  return {
    on: jest.fn((name, callback) => {
      const handlers = events.get(name) || new Set();
      handlers.add(callback);
      events.set(name, handlers);
    }),
    once: jest.fn((name, callback) => {
      const once = (...args) => {
        events.get(name)?.delete(once);
        return callback(...args);
      };
      const handlers = events.get(name) || new Set();
      handlers.add(once);
      events.set(name, handlers);
    }),
    off: jest.fn((name, callback) => events.get(name)?.delete(callback)),
    removeAllListeners: jest.fn(() => events.clear()),
    deliver: async (name, ...args) =>
      Promise.all(
        [...(events.get(name) || [])].map(handler => handler(...args))
      )
  };
};

const rawSocket = (_url, options) => {
  const events = listeners();
  const any = new Set();
  const manager = listeners();
  const raw = {
    ...events,
    io: { ...manager, opts: { query: { ...options.query } } },
    connected: true,
    emit: jest.fn(),
    onAny: jest.fn(callback => any.add(callback)),
    offAny: jest.fn(() => any.clear()),
    connect: jest.fn(() => {
      raw.connected = true;
    }),
    disconnect: jest.fn(() => {
      raw.connected = false;
    }),
    deliver: async (name, ...args) => {
      any.forEach(callback => callback(name, ...args));
      return events.deliver(name, ...args);
    }
  };
  sockets.push(raw);
  return raw;
};

const select = (token, claims) => {
  storedToken = token;
  if (token) {
    payloads.set(token, claims);
    localStorage.setItem("token", JSON.stringify(token));
    api.defaults.headers.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem("token");
    delete api.defaults.headers.Authorization;
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  sockets = [];
  payloads = new Map();
  storedToken = null;
  localStorage.clear();
  api.defaults.headers = {};
  debug = jest.spyOn(console, "debug").mockImplementation(() => {});
  openSocket.mockImplementation(rawSocket);
  readStoredToken.mockImplementation(() => storedToken);
  decodeToken.mockImplementation(token => {
    if (token === "broken-decoder") throw new Error("fixture-decode-error");
    return payloads.get(token) || null;
  });
  isExpired.mockReturnValue(false);
  Object.assign(socketManager, {
    currentCompanyId: -1,
    currentUserId: -1,
    currentSocket: null,
    socketReady: false,
    tokenRefreshPromise: null,
    reconnectAttemptHandler: null,
    wsConnectionIssueActive: false,
    wsReconnectAttemptCount: 0,
    wsRefreshRequiredActive: false,
    wsConnectionIssueListeners: [],
    wsReconnectAttemptListeners: [],
    wsRefreshRequiredListeners: [],
    wsConnectionStableTimer: null
  });
});

afterEach(() => {
  debug.mockRestore();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("changing actors in the same company closes the old transport and its receivers", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  const a = socketManager.GetSocket();
  const receivedA = jest.fn();
  a.on("fixture-private-chat", receivedA);
  select("fixture-B", { id: 102, companyId: 10 });
  const b = socketManager.GetSocket();
  const receivedB = jest.fn();
  b.on("fixture-private-chat", receivedB);
  expect(openSocket).toHaveBeenCalledTimes(2);
  expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
  expect(socketManager.currentUserId).toBe(102);
  await sockets[0].deliver("fixture-private-chat", { nonce: "old-A" });
  expect(receivedA).not.toHaveBeenCalled();
  await sockets[1].deliver("fixture-private-chat", { nonce: "current-B" });
  expect(receivedB).toHaveBeenCalledWith({ nonce: "current-B" });
});

test("refreshing a token for the same actor preserves the connection and legitimate listeners", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  const a = socketManager.GetSocket();
  const received = jest.fn();
  a.on("fixture-private-chat", received);
  select("fixture-A-refreshed", { id: 101, companyId: 10 });
  socketManager.syncCurrentSocketToken("fixture-A-refreshed");
  socketManager.GetSocket();
  expect(openSocket).toHaveBeenCalledTimes(1);
  expect(sockets[0].disconnect).not.toHaveBeenCalled();
  expect(sockets[0].io.opts.query.token).toBe("fixture-A-refreshed");
  await sockets[0].deliver("fixture-private-chat", { nonce: "same-actor" });
  expect(received).toHaveBeenCalledTimes(1);
});

test("logout closes every receiver and onAny log on the old transport", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  const auth = socketManager.GetSocket();
  const page = socketManager.GetSocket();
  const received = jest.fn();
  page.on("fixture-private-chat", received);
  await sockets[0].deliver("fixture-private-chat", {
    nonce: "legitimate-before-logout"
  });
  expect(received).toHaveBeenCalledTimes(1);
  received.mockClear();
  auth.logout();
  debug.mockClear();
  await sockets[0].deliver("fixture-private-chat", {
    nonce: "private-after-logout"
  });
  expect(received).not.toHaveBeenCalled();
  expect(debug).not.toHaveBeenCalled();
  expect(sockets[0].connected).toBe(false);
  expect(socketManager.currentSocket).toBeNull();
  await sockets[0].io.deliver("reconnect_attempt");
  expect(api.post).not.toHaveBeenCalled();
});

test("a late logout from managed A never closes or resets the newer B connection", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  const a = socketManager.GetSocket();
  select("fixture-B", { id: 102, companyId: 20 });
  const b = socketManager.GetSocket();
  const received = jest.fn();
  b.on("fixture-private-chat", received);
  a.logout();
  expect(socketManager.currentSocket).toBe(sockets[1]);
  expect(sockets[1].disconnect).not.toHaveBeenCalled();
  await sockets[1].deliver("fixture-private-chat", { nonce: "current-B" });
  expect(received).toHaveBeenCalledTimes(1);
});

test.each([
  ["missing token", null, null],
  ["null decoded token", "invalid", null],
  ["decoder failure", "broken-decoder", null],
  ["missing actor id", "invalid", { userId: 101, companyId: 10 }],
  ["missing company", "invalid", { id: 101 }],
  ["nonpositive actor", "invalid", { id: 0, companyId: 10 }]
])(
  "%s removes the old connection and returns an inert socket",
  async (_name, token, claims) => {
    select("fixture-A", { id: 101, companyId: 10 });
    const a = socketManager.GetSocket();
    const received = jest.fn();
    a.on("fixture-private-chat", received);
    select(token, claims);
    let inert;
    expect(() => {
      inert = socketManager.GetSocket();
    }).not.toThrow();
    expect(() => inert.emit("fixture-private-chat", {})).not.toThrow();
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(socketManager.currentSocket).toBeNull();
    expect(openSocket).toHaveBeenCalledTimes(1);
    await sockets[0].deliver("fixture-private-chat", {
      nonce: "after-invalid-identity"
    });
    expect(received).not.toHaveBeenCalled();
  }
);

test("a refresh pending at logout cannot restore credentials or reconnect", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  const a = socketManager.GetSocket();
  let finish;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const pending = socketManager.reconnectWithFreshToken();
  a.logout();
  select(null);
  payloads.set("fixture-A-refreshed", { id: 101, companyId: 10 });
  finish({ data: { token: "fixture-A-refreshed" } });
  await pending;
  expect(localStorage.getItem("token")).toBeNull();
  expect(api.defaults.headers.Authorization).toBeUndefined();
  expect(sockets[0].connect).not.toHaveBeenCalled();
});

test("a late refresh for A cannot overwrite or reconnect a newer B identity", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  socketManager.GetSocket();
  let finish;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const pending = socketManager.reconnectWithFreshToken();
  select("fixture-B", { id: 102, companyId: 20 });
  socketManager.GetSocket();
  payloads.set("fixture-A-refreshed", { id: 101, companyId: 10 });
  finish({ data: { token: "fixture-A-refreshed" } });
  await pending;
  expect(localStorage.getItem("token")).toBe(JSON.stringify("fixture-B"));
  expect(api.defaults.headers.Authorization).toBe("Bearer fixture-B");
  expect(socketManager.currentSocket).toBe(sockets[1]);
  expect(sockets[1].io.opts.query.token).toBe("fixture-B");
  expect(sockets[1].connect).not.toHaveBeenCalled();
});

test("old A finally never clears a new B refresh promise", async () => {
  select("fixture-A", { id: 101, companyId: 10 });
  socketManager.GetSocket();
  const finish = [];
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finish.push(resolve);
      })
  );
  const pendingA = socketManager.reconnectWithFreshToken();
  select("fixture-B", { id: 102, companyId: 20 });
  socketManager.GetSocket();
  const pendingB = socketManager.reconnectWithFreshToken();
  const promiseB = socketManager.tokenRefreshPromise;
  payloads.set("fixture-A-refreshed", { id: 101, companyId: 10 });
  finish[0]({ data: { token: "fixture-A-refreshed" } });
  await pendingA;
  expect(socketManager.tokenRefreshPromise).toBe(promiseB);
  payloads.set("fixture-B-refreshed", { id: 102, companyId: 20 });
  finish[1]({ data: { token: "fixture-B-refreshed" } });
  await pendingB;
  expect(socketManager.tokenRefreshPromise).toBeNull();
  expect(sockets[1].io.opts.query.token).toBe("fixture-B-refreshed");
  expect(sockets[1].connect).toHaveBeenCalledTimes(1);
});
