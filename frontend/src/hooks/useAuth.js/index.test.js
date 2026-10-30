import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import useAuth from "./index";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import toastError from "../../errors/toastError";

jest.mock("../../services/api", () => ({
  post: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  defaults: { headers: {} },
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  }
}));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), warn: jest.fn() }
}));
jest.mock("react-jwt", () => ({
  decodeToken: () => ({ companyId: 7, userId: 42, exp: 4000000000 })
}));
jest.mock("../../helpers/settingsCache", () => ({
  clearAllCachedSettings: jest.fn()
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({})
}));

const socket = { on: jest.fn(), disconnect: jest.fn(), logout: jest.fn() };
const sockets = {
  GetSocket: () => socket,
  syncCurrentSocketToken: jest.fn()
};
let auth;
const snapshots = [];

const Probe = () => {
  auth = useAuth();
  const location = useLocation();
  snapshots.push({ isAuth: auth.isAuth, profile: auth.user?.profile });
  return (
    <>
      <div data-testid="path">{location.pathname}</div>
      <div data-testid="session">
        {String(auth.isAuth)}:{String(auth.loading)}:{auth.user?.profile}
      </div>
    </>
  );
};

const mount = () =>
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <SocketContext.Provider value={sockets}>
        <Probe />
      </SocketContext.Provider>
    </MemoryRouter>
  );

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
};

const session = (profile = "user", hideAdminUI = false) => ({
  token: "fictional-session-token",
  user: {
    id: 42,
    profile,
    hideAdminUI,
    company: { id: 7, dueDate: "2099-12-31", settings: [] }
  }
});

beforeEach(() => {
  localStorage.clear();
  api.post.mockReset();
  api.get.mockReset();
  toastError.mockClear();
  snapshots.length = 0;
});

test("a stored token attaches a bearer header without authenticating before refresh", async () => {
  localStorage.setItem("token", JSON.stringify("fictional-saved-token"));
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  mount();
  const request = api.interceptors.request.use.mock.calls[0][0];
  let config;
  act(() => {
    config = request({ url: "/auth/refresh_token", headers: {} });
  });
  expect(config.headers.Authorization).toBe("Bearer fictional-saved-token");
  expect(auth.isAuth).toBe(false);
  expect(auth.loading).toBe(true);
  await act(async () => pending.resolve({ data: session() }));
  expect(auth.isAuth).toBe(true);
  expect(auth.user.profile).toBe("user");
  expect(auth.loading).toBe(false);
  expect(snapshots.some(value => value.isAuth && !value.profile)).toBe(false);
});

test("invalid restoration stops loading without creating an authenticated session", async () => {
  localStorage.setItem("token", JSON.stringify("fictional-invalid-token"));
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  mount();
  await act(async () => pending.reject(new Error("fictional invalid session")));
  expect(auth.isAuth).toBe(false);
  expect(auth.loading).toBe(false);
  expect(auth.user).toEqual({});
  expect(toastError).toHaveBeenCalledTimes(1);
});

test.each([
  ["user", false, "/tickets"],
  ["admin", false, "/"],
  ["admin", true, "/tickets"]
])(
  "completed login for %s (hidden %s) goes to %s",
  async (profile, hidden, path) => {
    mount();
    api.post.mockResolvedValueOnce({ data: session(profile, hidden) });
    let result;
    await act(async () => {
      result = await auth.handleLogin({
        email: "fictional@example.test",
        password: "fixture"
      });
    });
    expect(result).toEqual({ authenticated: true });
    expect(screen.getByTestId("path").textContent).toBe(path);
    expect(auth.user.profile).toBe(profile);
    expect(auth.isAuth).toBe(true);
    expect(snapshots.some(value => value.isAuth && !value.profile)).toBe(false);
  }
);

test("2FA keeps login pending until verification and then uses the permitted home", async () => {
  mount();
  api.post.mockResolvedValueOnce({
    data: { twoFactorRequired: true, challenge: "fictional-challenge" }
  });
  let challenge;
  await act(async () => {
    challenge = await auth.handleLogin({
      email: "fictional@example.test",
      password: "fixture"
    });
  });
  expect(challenge).toMatchObject({
    twoFactorRequired: true,
    challenge: "fictional-challenge"
  });
  expect(auth.isAuth).toBe(false);
  expect(auth.user).toEqual({});
  expect(screen.getByTestId("path").textContent).toBe("/login");
  api.post.mockResolvedValueOnce({ data: session() });
  await act(async () => {
    await auth.handleVerifyTwoFactor({
      challenge: challenge.challenge,
      code: "123456"
    });
  });
  expect(api.post.mock.calls.map(([url]) => url)).toEqual([
    "/auth/login",
    "/auth/2fa"
  ]);
  expect(auth.isAuth).toBe(true);
  expect(auth.user.profile).toBe("user");
  expect(screen.getByTestId("path").textContent).toBe("/tickets");
});
