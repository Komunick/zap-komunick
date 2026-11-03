import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import ChatPopover from "./ChatPopover";
import { AuthContext } from "../../context/Auth/AuthContext";
import { createKomunickTheme } from "../../theme/komunick";
import api from "../../services/api";

jest.mock("../../services/api", () => ({ get: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("use-sound", () => () => [jest.fn()]);
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({})
}));
const mockListeners = new Map();
const mockSocket = {
  on: jest.fn((name, handler) => mockListeners.set(name, handler)),
  disconnect: jest.fn()
};
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({ GetSocket: () => mockSocket })
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockListeners.clear();
  mockSocket.on.mockImplementation((name, handler) =>
    mockListeners.set(name, handler)
  );
  localStorage.setItem("companyId", "10");
  api.get.mockResolvedValue({
    data: {
      records: [
        {
          id: 301,
          uuid: "fixture-group",
          lastMessage: "Última mensagem fictícia privada",
          updatedAt: "2026-10-30T12:00:00Z",
          users: [{ userId: 101, unreads: 1 }]
        }
      ],
      hasMore: false
    }
  });
});
afterEach(() => jest.useRealTimers());

test("a membership tombstone removes the cached private preview", async () => {
  render(
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <AuthContext.Provider value={{ user: { id: 101 } }}>
        <ChatPopover />
      </AuthContext.Provider>
    </ThemeProvider>
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  const button = screen.getByRole("button");
  fireEvent.click(button);
  expect(
    await screen.findByText("Última mensagem fictícia privada")
  ).toBeInTheDocument();
  act(() =>
    mockListeners.get("company-10-chat")({ action: "delete", id: "301" })
  );
  expect(
    screen.queryByText("Última mensagem fictícia privada")
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("tickets.notification.nomessages")
  ).toBeInTheDocument();
});

test("a pending old list cannot restore a preview after membership is removed", async () => {
  let resolve;
  api.get.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  render(
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <AuthContext.Provider value={{ user: { id: 101 } }}>
        <ChatPopover />
      </AuthContext.Provider>
    </ThemeProvider>
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole("button"));
  act(() =>
    mockListeners.get("company-10-chat")({ action: "delete", id: 301 })
  );
  await act(async () =>
    resolve({
      data: {
        records: [
          {
            id: 301,
            uuid: "fixture-group",
            lastMessage: "Resposta privada obsoleta",
            updatedAt: "2026-10-30T12:00:00Z",
            users: [{ userId: 101, unreads: 1 }]
          }
        ],
        hasMore: false
      }
    })
  );
  expect(
    screen.queryByText("Resposta privada obsoleta")
  ).not.toBeInTheDocument();
});

test("a legitimate personal update restores a re-added chat without an older preview", async () => {
  let resolve;
  api.get.mockImplementation(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  render(
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <AuthContext.Provider value={{ user: { id: 101 } }}>
        <ChatPopover />
      </AuthContext.Provider>
    </ThemeProvider>
  );
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  fireEvent.click(screen.getByRole("button"));
  act(() =>
    mockListeners.get("company-10-chat")({ action: "delete", id: 301 })
  );
  const record = {
    id: 301,
    uuid: "fixture-group",
    lastMessage: "Conteúdo atual autorizado",
    updatedAt: "2026-10-30T12:00:00Z",
    users: [{ userId: 101, unreads: 0 }]
  };
  act(() =>
    mockListeners.get("company-10-chat-user-101")({ action: "update", record })
  );
  await act(async () =>
    resolve({
      data: {
        records: [{ ...record, lastMessage: "Preview antigo descartado" }],
        hasMore: false
      }
    })
  );
  expect(screen.getByText("Conteúdo atual autorizado")).toBeInTheDocument();
  expect(
    screen.queryByText("Preview antigo descartado")
  ).not.toBeInTheDocument();
});
