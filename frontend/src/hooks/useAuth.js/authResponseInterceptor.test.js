import axios from "axios/dist/node/axios.cjs";
import { registerAuthResponseInterceptor } from "./authResponseInterceptor";

// An in-memory Axios adapter exercises real interceptor/retry behavior. It
// cannot make network calls, and its budget turns a refresh loop into failure.
const fail = (config, status, error) =>
  Promise.reject({ config, response: { status, data: { error } } });

const succeed = (config, data) =>
  Promise.resolve({ config, status: 200, data, headers: {} });

const fixture = respond => {
  const requests = [];
  const client = axios.create({
    adapter: config => {
      requests.push({
        url: config.url,
        authorization: config.headers.Authorization
      });
      if (requests.length > 8) return fail(config, 500, "TEST_REQUEST_LIMIT");
      return respond(config, requests);
    }
  });
  const session = { authenticated: true };
  localStorage.setItem("token", JSON.stringify("previous-test-token"));
  const endSession = jest.fn(() => {
    session.authenticated = false;
    localStorage.removeItem("token");
    client.defaults.headers.Authorization = undefined;
  });
  registerAuthResponseInterceptor(client, endSession);
  return { client, requests, session, endSession };
};

afterEach(() => localStorage.clear());

test("IP denial during refresh stops after two requests and ends the session", async () => {
  const { client, requests, session, endSession } = fixture(config =>
    config.url === "/auth/refresh_token"
      ? fail(config, 403, "ERR_IP_NOT_ALLOWED")
      : fail(config, 403, "ERR_SESSION_EXPIRED")
  );

  const failure = await client.get("/protected").catch(error => error);
  expect(requests.map(request => request.url)).toEqual([
    "/protected",
    "/auth/refresh_token"
  ]);
  expect(failure).toMatchObject({
    response: { status: 403, data: { error: "ERR_IP_NOT_ALLOWED" } }
  });
  expect(endSession).toHaveBeenCalledTimes(1);
  expect(session.authenticated).toBe(false);
  expect(localStorage.getItem("token")).toBeNull();
});

test.each([
  [403, "ERR_IP_NOT_ALLOWED"],
  [401, "ERR_SESSION_EXPIRED"],
  [401, "ERR_OUT_OF_ACCESS_HOURS"]
])("a direct refresh failure %s %s is never retried", async (status, code) => {
  const { client, requests, session, endSession } = fixture(config =>
    fail(config, status, code)
  );

  await expect(client.post("/auth/refresh_token")).rejects.toMatchObject({
    response: { status, data: { error: code } }
  });
  expect(requests).toHaveLength(1);
  expect(endSession).toHaveBeenCalledTimes(1);
  expect(session.authenticated).toBe(false);
});

test.each([
  ["/protected", 403, "ERR_NO_PERMISSION"],
  ["/protected", 403, "ERR_IP_NOT_ALLOWED"],
  ["/auth/login", 403, "ERR_IP_NOT_ALLOWED"],
  ["/auth/2fa", 401, "ERR_2FA_INVALID_CODE"],
  ["/security/2fa/enable", 401, "ERR_2FA_INVALID_CODE"],
  ["/security/2fa/disable", 401, "ERR_INVALID_CREDENTIALS"]
])(
  "%s business error %s %s preserves the session without refresh",
  async (path, status, code) => {
    const { client, requests, session, endSession } = fixture(config =>
      fail(config, status, code)
    );

    await expect(client.post(path)).rejects.toMatchObject({
      response: { status, data: { error: code } }
    });
    expect(requests).toHaveLength(1);
    expect(endSession).not.toHaveBeenCalled();
    expect(session.authenticated).toBe(true);
    expect(localStorage.getItem("token")).toBe(
      JSON.stringify("previous-test-token")
    );
  }
);

test("an expired protected request refreshes once and uses the replacement token", async () => {
  const { client, requests, session, endSession } = fixture((config, seen) => {
    if (config.url === "/auth/refresh_token") {
      return succeed(config, { token: "replacement-test-token" });
    }
    return seen.length === 1
      ? fail(config, 403, "ERR_SESSION_EXPIRED")
      : succeed(config, { ok: true });
  });

  await expect(client.get("/protected")).resolves.toMatchObject({
    data: { ok: true }
  });
  expect(requests.map(request => request.url)).toEqual([
    "/protected",
    "/auth/refresh_token",
    "/protected"
  ]);
  expect(requests[2].authorization).toBe("Bearer replacement-test-token");
  expect(localStorage.getItem("token")).toBe(
    JSON.stringify("replacement-test-token")
  );
  expect(session.authenticated).toBe(true);
  expect(endSession).not.toHaveBeenCalled();
});

test("a rejected replacement token ends the session without another refresh", async () => {
  const { client, requests, session, endSession } = fixture(config =>
    config.url === "/auth/refresh_token"
      ? succeed(config, { token: "replacement-test-token" })
      : fail(config, 403, "ERR_SESSION_EXPIRED")
  );

  await expect(client.get("/protected")).rejects.toMatchObject({
    response: { status: 403, data: { error: "ERR_SESSION_EXPIRED" } }
  });
  expect(requests).toHaveLength(3);
  expect(session.authenticated).toBe(false);
  expect(endSession).toHaveBeenCalledTimes(1);
});

test("an ordinary unauthorized response still ends the session", async () => {
  const { client, requests, session } = fixture(config =>
    fail(config, 401, "ERR_UNAUTHORIZED")
  );
  await expect(client.get("/protected")).rejects.toMatchObject({
    response: { status: 401 }
  });
  expect(requests).toHaveLength(1);
  expect(session.authenticated).toBe(false);
});
