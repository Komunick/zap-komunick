import React from "react";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import useAppUpdate, {
  AFTER_RECONNECT_MS,
  RETURN_GAP_MS,
  SLOW_CLOCK_MS
} from "./useAppUpdate";
import { SocketContext } from "../context/Socket/SocketContext";
import {
  UPDATE_AVAILABLE_EVENT,
  checkPublishedVersion,
  runningMainScript
} from "../helpers/appVersion";

jest.mock("../context/Socket/SocketContext", () => {
  const { createContext } = require("react");
  return { SocketContext: createContext(null) };
});
jest.mock("../helpers/appVersion", () => ({
  UPDATE_AVAILABLE_EVENT: "superchat:update-available",
  checkPublishedVersion: jest.fn(),
  runningMainScript: jest.fn()
}));

const Probe = () => (
  <p data-testid="state">{useAppUpdate() ? "new version" : "current"}</p>
);

// The part of the socket manager the hook uses: like the real one, it calls
// the listener at once with the current value.
const fakeSocketManager = () => {
  const listeners = new Set();
  return {
    listeners,
    subscribeWsRefreshRequired: jest.fn(listener => {
      listeners.add(listener);
      listener(false);
      return () => listeners.delete(listener);
    }),
    // what the real manager does at each reconnection after a drop
    reconnect: () =>
      listeners.forEach(listener => {
        listener(true);
        listener(false);
      })
  };
};

const mount = (manager = fakeSocketManager()) => ({
  manager,
  ...render(
    <SocketContext.Provider value={manager}>
      <Probe />
    </SocketContext.Provider>
  )
});

const state = () => screen.getByTestId("state").textContent;

// Runs the timers and lets the pending look (a promise) settle.
const pass = async ms => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });
};

const setVisibility = value => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value
  });
};

// How long ago the page was loaded, as the hook reads it.
let pageAge;

beforeEach(() => {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date("2026-11-25T12:00:00Z"));
  pageAge = jest.spyOn(performance, "now").mockReturnValue(1500);
  checkPublishedVersion.mockReset().mockResolvedValue("same");
  runningMainScript.mockReset().mockReturnValue("main.57238d76.js");
  setVisibility("visible");
});

afterEach(() => {
  pageAge.mockRestore();
  jest.useRealTimers();
});

it("does not look at anything when the page loads", async () => {
  mount();
  await pass(5000);
  expect(checkPublishedVersion).not.toHaveBeenCalled();
  expect(state()).toBe("current");
});

it("looks after a reconnection, a little later and once more minutes later", async () => {
  const { manager } = mount();
  // the call made on subscribing (false) is not a reconnection
  await pass(AFTER_RECONNECT_MS[1] + 1000);
  expect(checkPublishedVersion).not.toHaveBeenCalled();

  manager.reconnect();
  await pass(AFTER_RECONNECT_MS[0] - 1);
  expect(checkPublishedVersion).not.toHaveBeenCalled();
  await pass(1);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  expect(state()).toBe("current");

  // the backend came back before the new frontend was being served
  checkPublishedVersion.mockResolvedValue("newer");
  await pass(AFTER_RECONNECT_MS[1] - AFTER_RECONNECT_MS[0]);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
  expect(state()).toBe("new version");
});

it("stops looking once it knows, and never goes back", async () => {
  checkPublishedVersion.mockResolvedValue("newer");
  const { manager } = mount();
  manager.reconnect();
  await pass(AFTER_RECONNECT_MS[0]);
  expect(state()).toBe("new version");
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);

  checkPublishedVersion.mockResolvedValue("same");
  manager.reconnect();
  await pass(SLOW_CLOCK_MS * 3);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  expect(state()).toBe("new version");
});

it('treats "could not tell" as nothing new', async () => {
  checkPublishedVersion.mockResolvedValue("unknown");
  const { manager } = mount();
  manager.reconnect();
  await pass(AFTER_RECONNECT_MS[0]);
  await pass(AFTER_RECONNECT_MS[1] - AFTER_RECONNECT_MS[0]);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
  expect(state()).toBe("current");
});

it("does not pile up looks when the connection drops again and again", async () => {
  const { manager } = mount();
  manager.reconnect();
  await pass(2000);
  manager.reconnect();
  await pass(2000);
  manager.reconnect();
  await pass(AFTER_RECONNECT_MS[0]);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  await pass(AFTER_RECONNECT_MS[1]);
  // only the two looks of the last reconnection ran
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
});

it("looks when the person comes back to the tab, at most once in a while", async () => {
  mount();
  setVisibility("hidden");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pass(1000);
  expect(checkPublishedVersion).not.toHaveBeenCalled();

  setVisibility("visible");
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);

  // back and forth right after: no new look
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);

  await pass(RETURN_GAP_MS);
  checkPublishedVersion.mockResolvedValue("newer");
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
  expect(state()).toBe("new version");
});

it("looks on a slow clock, but not in a tab nobody is seeing", async () => {
  mount();
  await pass(SLOW_CLOCK_MS);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);

  setVisibility("hidden");
  await pass(SLOW_CLOCK_MS * 2);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
});

it("looks, instead of believing, when a route could not load one of its files", async () => {
  mount();
  // the network blinked: the file failed, but nothing new is published
  act(() => {
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  expect(state()).toBe("current");

  // a real publication: the file is gone because the frontend is another one
  checkPublishedVersion.mockResolvedValue("newer");
  act(() => {
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
  expect(state()).toBe("new version");
});

it("does not let an offline look delay the next one", async () => {
  checkPublishedVersion.mockResolvedValue("unknown");
  mount();
  // the route failed because the connection was down
  act(() => {
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);

  // the connection comes back seconds later: it looks again right away
  checkPublishedVersion.mockResolvedValue("newer");
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(2);
  expect(state()).toBe("new version");
});

it("looks right away when the layout mounts on a page loaded long ago", async () => {
  // logout and login again, hours after the page was loaded
  pageAge.mockReturnValue(RETURN_GAP_MS + 1);
  checkPublishedVersion.mockResolvedValue("newer");
  mount();
  await pass(1000);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  expect(state()).toBe("new version");
});

it("compares nothing while developing, where a missing file is all there is to go by", async () => {
  runningMainScript.mockReturnValue(null);
  pageAge.mockReturnValue(RETURN_GAP_MS + 1);
  const { manager } = mount();
  expect(manager.subscribeWsRefreshRequired).not.toHaveBeenCalled();
  await pass(SLOW_CLOCK_MS * 2);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pass(1000);
  expect(checkPublishedVersion).not.toHaveBeenCalled();

  act(() => {
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  });
  expect(state()).toBe("new version");
  expect(checkPublishedVersion).not.toHaveBeenCalled();
});

it("works without a socket manager", async () => {
  render(
    <SocketContext.Provider value={null}>
      <Probe />
    </SocketContext.Provider>
  );
  await pass(SLOW_CLOCK_MS);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
});

it("leaves nothing behind when the layout goes away", async () => {
  const { manager, unmount } = mount();
  manager.reconnect();
  unmount();
  expect(manager.listeners.size).toBe(0);
  await pass(SLOW_CLOCK_MS * 2);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event(UPDATE_AVAILABLE_EVENT));
  });
  await pass(1000);
  expect(checkPublishedVersion).not.toHaveBeenCalled();
});

it("ignores an answer that arrives after the layout went away", async () => {
  let answer;
  checkPublishedVersion.mockImplementation(
    () =>
      new Promise(resolve => {
        answer = resolve;
      })
  );
  const { manager, unmount } = mount();
  manager.reconnect();
  await pass(AFTER_RECONNECT_MS[0]);
  expect(checkPublishedVersion).toHaveBeenCalledTimes(1);
  unmount();
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => {
    answer("newer");
    await Promise.resolve();
  });
  // no state update on an unmounted component
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});
