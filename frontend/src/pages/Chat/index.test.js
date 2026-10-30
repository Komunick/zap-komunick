import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route } from "react-router-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import Chat from "./index";
import { AuthContext } from "../../context/Auth/AuthContext";
import { createKomunickTheme } from "../../theme/komunick";
import api from "../../services/api";

jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({})
}));
const mockListeners = new Map();
const mockSocket = {
  on: jest.fn((name, fn) => mockListeners.set(name, fn)),
  off: jest.fn(name => mockListeners.delete(name))
};
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({ GetSocket: () => mockSocket })
}));
jest.mock("@material-ui/core/withWidth", () => ({
  __esModule: true,
  default: () => Component => props => <Component width="lg" {...props} />,
  isWidthUp: () => true
}));
jest.mock("../../components/UsersFilter", () => ({ UsersFilter: () => null }));
jest.mock("mic-recorder-to-mp3", () => jest.fn(() => ({})));
jest.mock(
  "../../components/MessageInputCustom/RecordingTimer",
  () => () => null
);
jest.mock("../../components/MediaGalleryLightbox", () => ({
  __esModule: true,
  default: () => null,
  buildMediaGalleryData: () => ({ slides: [], byMessageId: {} })
}));

const chat = id => ({
  id,
  uuid: "fixture-chat-" + id,
  title: "Grupo fictício " + id,
  users: [{ userId: 7, unreads: 0, user: { id: 7, name: "Pessoa fictícia" } }],
  updatedAt: "2026-10-30T12:00:00Z",
  ownerId: 8
});
const message = (id, chatId, text) => ({
  id,
  chatId,
  message: text,
  senderId: 8,
  sender: { id: 8, name: "Colega fictício" },
  createdAt: "2026-10-30T12:00:00Z"
});
const response = (records = [], hasMore = false) => ({
  data: { records, hasMore }
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const mount = () =>
  render(
    <MemoryRouter initialEntries={["/chats"]}>
      <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
        <AuthContext.Provider
          value={{ user: { id: 7, name: "Pessoa fictícia" } }}
        >
          <Route path="/chats/:id?">
            <Chat />
          </Route>
        </AuthContext.Provider>
      </ThemeProvider>
    </MemoryRouter>
  );
const setup = history =>
  api.get.mockImplementation(url => {
    if (url === "/users/list")
      return Promise.resolve({
        data: [
          { id: 8, name: "Colega fictício", email: "colega@fixture.local.test" }
        ]
      });
    if (url === "/chats")
      return Promise.resolve(response([chat(101), chat(102)]));
    return history(url);
  });
const choose = async id =>
  fireEvent.click(
    await screen.findByRole("button", {
      name: new RegExp("Grupo fictício " + id)
    })
  );
const upload = async () => {
  fireEvent.change(
    screen.getByLabelText("chatPage.attachFiles", { selector: "input" }),
    {
      target: {
        files: [
          new File(["fictício"], "anexo-ficticio.txt", { type: "text/plain" })
        ]
      }
    }
  );
  fireEvent.click(screen.getByRole("button", { name: "chatPage.sendFiles" }));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockSocket.on.mockImplementation((name, fn) => mockListeners.set(name, fn));
  mockSocket.off.mockImplementation(name => mockListeners.delete(name));
  localStorage.setItem("companyId", "1");
  Element.prototype.scrollIntoView = jest.fn();
});

test("a late response from another conversation never enters the current history", async () => {
  const old = deferred();
  setup(url =>
    url.includes("/101/")
      ? old.promise
      : Promise.resolve(response([message(2, 102, "Somente conversa atual")]))
  );
  mount();
  await choose(101);
  await choose(102);
  await screen.findByText("Somente conversa atual");
  await act(async () =>
    old.resolve(response([message(1, 101, "Mensagem da conversa anterior")]))
  );
  expect(
    screen.queryByText("Mensagem da conversa anterior")
  ).not.toBeInTheDocument();
  expect(screen.getByText("Somente conversa atual")).toBeInTheDocument();
});

test.each(["pending", "failed"])(
  "upload refresh initializes pagination when initial history is %s",
  async state => {
    const initial = deferred();
    let firstPage = 0;
    setup(url => {
      if (url.includes("pageNumber=2"))
        return Promise.resolve(
          response([message(1, 101, "Mensagem antiga preservada")])
        );
      firstPage += 1;
      return firstPage === 1
        ? initial.promise
        : Promise.resolve(
            response([message(21, 101, "Mensagem recente com anexo")], true)
          );
    });
    api.post.mockResolvedValue({
      data: message(21, 101, "Mensagem recente com anexo")
    });
    mount();
    await choose(101);
    if (state === "failed") {
      await act(async () =>
        initial.reject(new Error("fixture-initial-history"))
      );
      await screen.findByText("chatPage.messagesError");
    }
    await upload();
    await screen.findByText("Mensagem recente com anexo");
    fireEvent.click(screen.getByRole("button", { name: "chatPage.loadMore" }));
    await screen.findByText("Mensagem antiga preservada");
    expect(api.get).toHaveBeenCalledWith("/chats/101/messages?pageNumber=2");
    if (state === "pending")
      await act(async () =>
        initial.resolve(
          response([message(3, 101, "Resposta inicial obsoleta")])
        )
      );
    expect(
      screen.queryByText("Resposta inicial obsoleta")
    ).not.toBeInTheDocument();
  }
);

test("upload refresh keeps older loaded messages and the next historical page", async () => {
  setup(url =>
    Promise.resolve(
      url.includes("pageNumber=2")
        ? response([message(1, 101, "Página dois mantida")], true)
        : url.includes("pageNumber=3")
          ? response([message(0, 101, "Página três disponível")])
          : response([message(21, 101, "Página um mantida")], true)
    )
  );
  api.post.mockResolvedValue({ data: {} });
  mount();
  await choose(101);
  await screen.findByText("Página um mantida");
  fireEvent.click(screen.getByRole("button", { name: "chatPage.loadMore" }));
  await screen.findByText("Página dois mantida");
  await upload();
  await waitFor(() =>
    expect(
      api.get.mock.calls.filter(([url]) => url.includes("pageNumber=1"))
    ).toHaveLength(2)
  );
  await waitFor(() =>
    expect(
      screen.queryByText("chatPage.loadingMessages")
    ).not.toBeInTheDocument()
  );
  fireEvent.click(screen.getByRole("button", { name: "chatPage.loadMore" }));
  await screen.findByText("Página três disponível");
  expect(screen.getByText("Página dois mantida")).toBeInTheDocument();
  expect(screen.getByText("Página um mantida")).toBeInTheDocument();
});

test("company people stay available while conversations are delayed or fail", async () => {
  const conversations = deferred();
  api.get.mockImplementation(url =>
    url === "/chats"
      ? conversations.promise
      : Promise.resolve({
          data: [
            {
              id: 8,
              name: "Colega fictício",
              email: "colega@fixture.local.test"
            }
          ]
        })
  );
  mount();
  expect(
    await screen.findByRole("button", { name: /Colega fictício/ })
  ).toBeEnabled();
  await act(async () => conversations.reject(new Error("fixture-chat-list")));
  expect(screen.getByRole("button", { name: /Colega fictício/ })).toBeEnabled();
  expect(screen.getByText("chatPage.conversationsError")).toBeInTheDocument();
});

test("confirmed text appears even without a socket and its later event is deduplicated", async () => {
  setup(() => Promise.resolve(response()));
  const sent = {
    ...message(30, 101, "Texto confirmado fictício"),
    senderId: 7
  };
  api.post.mockResolvedValue({ data: sent });
  mount();
  await choose(101);
  await screen.findByText("chatPage.emptyMessages");
  fireEvent.change(
    screen.getByRole("textbox", { name: "chatPage.messageInput" }),
    { target: { value: sent.message } }
  );
  fireEvent.click(screen.getByRole("button", { name: "chatPage.send" }));
  await screen.findByText(sent.message);
  act(() =>
    mockListeners.get("company-1-chat-101")({
      action: "new-message",
      newMessage: sent,
      chat: chat(101)
    })
  );
  expect(screen.getAllByText(sent.message)).toHaveLength(1);
});

const retryWithDelayedList = () => {
  const delayed = deferred();
  let listLoads = 0,
    peopleLoads = 0;
  api.get.mockImplementation(url => {
    if (url === "/chats")
      return ++listLoads === 1
        ? Promise.resolve(response([chat(101), chat(102)]))
        : delayed.promise;
    if (url === "/users/list")
      return ++peopleLoads === 1
        ? Promise.reject(new Error("fixture-people-list"))
        : Promise.resolve({
            data: [
              {
                id: 8,
                name: "Colega fictício",
                email: "colega@fixture.local.test"
              }
            ]
          });
    return Promise.resolve(response());
  });
  return delayed;
};

test("list retry keeps a direct conversation opened after its stale snapshot", async () => {
  const delayed = retryWithDelayedList();
  const direct = {
    ...chat(103),
    isDirect: true,
    title: "",
    users: [
      { userId: 7, unreads: 0 },
      { userId: 8, unreads: 0 }
    ]
  };
  api.post.mockResolvedValue({ data: direct });
  mount();
  await screen.findByText("chatPage.conversationsError");
  fireEvent.click(screen.getByRole("button", { name: "chatPage.retry" }));
  fireEvent.click(
    await screen.findByRole("button", { name: /Colega fictício/ })
  );
  await screen.findByRole("textbox", { name: "chatPage.messageInput" });
  await act(async () => delayed.resolve(response([chat(101), chat(102)])));
  expect(
    screen.getByRole("textbox", { name: "chatPage.messageInput" })
  ).toBeInTheDocument();
});

test("list retry never resurrects a conversation deleted by a newer socket event", async () => {
  const delayed = retryWithDelayedList();
  mount();
  await screen.findByText("chatPage.conversationsError");
  fireEvent.click(screen.getByRole("button", { name: "chatPage.retry" }));
  await choose(101);
  act(() => mockListeners.get("company-1-chat")({ action: "delete", id: 101 }));
  expect(
    screen.queryByRole("button", { name: /Grupo fictício 101/ })
  ).not.toBeInTheDocument();
  await act(async () => delayed.resolve(response([chat(101), chat(102)])));
  expect(
    screen.queryByRole("button", { name: /Grupo fictício 101/ })
  ).not.toBeInTheDocument();
});
