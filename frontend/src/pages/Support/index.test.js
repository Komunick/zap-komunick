import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import Support from ".";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  SUPPORT_MAX_TOTAL_BYTES,
  addSupportFiles,
  isSupportFile,
  splitTickets,
  statusKey,
  supportActions
} from "../../helpers/supportTickets";

// The dialogs of this page take a while to mount when the whole suite runs.
configure({ asyncUtilTimeout: 8000 });
jest.setTimeout(30000);

let mockLiveHandler = null;
let mockSummary = { unread: 0, mineUnread: 0 };

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() }
}));
jest.mock("../../hooks/useSupportSummary", () => ({
  __esModule: true,
  default: handler => {
    mockLiveHandler = handler;
    return { summary: mockSummary, refresh: jest.fn() };
  }
}));
jest.mock("../../components/MainContainer", () => ({ children }) => (
  <div>{children}</div>
));
jest.mock("../../components/MainHeader", () => ({ children }) => (
  <div>{children}</div>
));
jest.mock("../../components/Title", () => ({ children }) => (
  <h1>{children}</h1>
));
jest.mock("../../components/PdfAttachmentView", () => ({ fileName }) => (
  <p>PDF {fileName}</p>
));
// Texts are the translation keys, followed by the values they would receive.
jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, values) =>
      values ? `${key} ${Object.values(values).join("|")}` : key,
    exists: key => key === "backendErrors.ERR_SUPPORT_RATE_LIMIT"
  }
}));

const file = (name, type, size = 1024) => {
  const item = new File(["x"], name, { type });
  Object.defineProperty(item, "size", { value: size });
  return item;
};

const ticket = overrides => ({
  id: 5,
  number: "CH-000005",
  title: "Conversa não abre",
  category: "error",
  priority: "high",
  status: "open",
  userName: "Ana",
  companyName: "Empresa Modelo",
  assignedUserName: null,
  lastMessageAt: "2026-11-24T18:00:00.000Z",
  createdAt: "2026-11-24T18:00:00.000Z",
  mine: true,
  unread: false,
  ...overrides
});

const message = overrides => ({
  id: 1,
  ticketId: 5,
  userName: "Ana",
  fromSupport: false,
  mine: true,
  kind: "message",
  event: null,
  body: "Ao clicar no cliente.",
  attachments: [],
  createdAt: "2026-11-24T18:00:00.000Z",
  ...overrides
});

// Answers of the fake server, by route.
let server;
const setServer = routes => {
  server = routes;
  api.get.mockImplementation(async url => {
    const key = Object.keys(server).find(route => url === route);
    if (!key) throw new Error(`unexpected GET ${url}`);
    const answer = server[key];
    return { data: typeof answer === "function" ? answer() : answer };
  });
};

const renderPage = (user, path = "/support") =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter initialEntries={[path]}>
        <Route path="/support/:ticketId?">
          <Support />
        </Route>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const requester = { id: 7, companyId: 2, profile: "user", super: false };
const superAdmin = { id: 1, companyId: 1, profile: "admin", super: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockLiveHandler = null;
  mockSummary = { unread: 0, mineUnread: 0 };
  api.post.mockResolvedValue({ data: {} });
});

describe("support helpers", () => {
  it("accepts images, videos and PDF only", () => {
    expect(isSupportFile(file("a.png", "image/png"))).toBe(true);
    expect(isSupportFile(file("a.mp4", "video/mp4"))).toBe(true);
    expect(isSupportFile(file("a.pdf", "application/pdf"))).toBe(true);
    expect(isSupportFile(file("a.MOV", ""))).toBe(true);
    expect(isSupportFile(file("a.exe", "application/x-msdownload"))).toBe(
      false
    );
    expect(isSupportFile(file("a.svg", "image/svg+xml"))).toBe(false);
  });

  it("stops at five files and at the total size", () => {
    const five = Array.from({ length: 5 }, (_, index) =>
      file(`p${index}.png`, "image/png")
    );
    expect(addSupportFiles(five, [file("p5.png", "image/png")])).toEqual({
      files: five,
      rejected: { code: "tooMany" }
    });
    const big = file("v.mp4", "video/mp4", SUPPORT_MAX_TOTAL_BYTES);
    expect(addSupportFiles([big], [file("p.png", "image/png")])).toEqual({
      files: [big],
      rejected: { code: "tooLarge" }
    });
  });

  it("separates finished tickets and names the waiting status for each side", () => {
    const list = [
      ticket({ id: 1, status: "waiting" }),
      ticket({ id: 2, status: "done" }),
      ticket({ id: 3, status: "cancelled" }),
      ticket({ id: 4, status: "open" })
    ];
    const groups = splitTickets(list);
    expect(groups.active.map(item => item.id)).toEqual([1, 4]);
    expect(groups.finished.map(item => item.id)).toEqual([2, 3]);
    expect(statusKey(ticket({ status: "waiting", mine: true }))).toBe(
      "waitingYou"
    );
    expect(statusKey(ticket({ status: "waiting", mine: false }))).toBe(
      "waiting"
    );
  });

  it("gives each side the buttons of its role", () => {
    expect(supportActions(ticket({ status: "open" }), false)).toEqual([
      "cancel"
    ]);
    expect(supportActions(ticket({ status: "in_progress" }), false)).toEqual(
      []
    );
    expect(
      supportActions(ticket({ status: "open", mine: false }), false)
    ).toEqual([]);
    expect(supportActions(ticket({ status: "open" }), true)).toEqual([
      "take",
      "request_info",
      "conclude",
      "cancel"
    ]);
    expect(supportActions(ticket({ status: "in_progress" }), true)).toEqual([
      "request_info",
      "conclude"
    ]);
    expect(supportActions(ticket({ status: "waiting" }), true)).toEqual([
      "resume",
      "conclude"
    ]);
    expect(supportActions(ticket({ status: "done" }), true)).toEqual([
      "reopen"
    ]);
  });
});

describe("Support page for a user", () => {
  it("lists the own tickets, without the queue, and marks what is unread", async () => {
    setServer({
      "/support/tickets": [
        ticket({ unread: true }),
        ticket({ id: 4, number: "CH-000004", title: "Antigo", status: "done" })
      ]
    });
    renderPage(requester);

    expect(await screen.findByText("Conversa não abre")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/support/tickets", {
      params: { scope: "mine", search: "" }
    });
    expect(screen.queryByText("support.tabs.queue")).not.toBeInTheDocument();
    expect(screen.getByTestId("support-unread")).toBeInTheDocument();
    expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
    expect(screen.getByText("support.groups.active (1)")).toBeInTheDocument();

    fireEvent.click(screen.getByText("support.groups.finished (1)"));
    expect(screen.getByText("Antigo")).toBeInTheDocument();
  });

  it("opens a ticket with category, priority and attachment and goes to its conversation", async () => {
    const created = ticket({ id: 9, number: "CH-000009", title: "Tela trava" });
    setServer({
      "/support/tickets": [],
      "/support/tickets/9": { ticket: created, messages: [] }
    });
    api.post.mockResolvedValue({ data: created });
    renderPage(requester);
    expect(await screen.findByText("support.empty.mine")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "support.open" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "support.form.submit" })
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "support.form.required"
    );
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/support.form.title/), {
      target: { value: "  Tela trava  " }
    });
    fireEvent.change(
      within(dialog).getByLabelText(/support.form.description/),
      { target: { value: "Ao enviar um anexo." } }
    );
    fireEvent.click(within(dialog).getByLabelText("support.form.blocking"));
    fireEvent.change(
      within(dialog).getByLabelText("support.attachments.add", {
        selector: "input"
      }),
      { target: { files: [file("print.png", "image/png")] } }
    );
    expect(within(dialog).getByText(/print\.png/)).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "support.form.submit" })
    );

    expect(
      await screen.findByRole("heading", { name: "Tela trava" })
    ).toBeInTheDocument();
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe("/support/tickets");
    expect(form.get("title")).toBe("Tela trava");
    expect(form.get("description")).toBe("Ao enviar um anexo.");
    expect(form.get("category")).toBe("error");
    expect(form.get("priority")).toBe("critical");
    expect(form.getAll("files").map(item => item.name)).toEqual(["print.png"]);
  });

  it("shows the conversation, reads it and sends a message with Enter", async () => {
    const open = ticket({ unread: true, status: "in_progress" });
    const first = message();
    const answer = message({
      id: 2,
      userName: "Suporte Komunick",
      fromSupport: true,
      mine: false,
      body: "Vamos olhar."
    });
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": { ticket: open, messages: [first, answer] }
    });
    api.post.mockImplementation(async url =>
      url.endsWith("/messages")
        ? {
            data: {
              ticket: { ...open, unread: false },
              messages: [first, answer, message({ id: 3, body: "Obrigada!" })]
            }
          }
        : { data: {} }
    );
    renderPage(requester, "/support/5");

    expect(await screen.findByText("Vamos olhar.")).toBeInTheDocument();
    expect(
      screen.getByText("support.who.support · Suporte Komunick")
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/support/tickets/5/read")
    );
    // In progress and taken by support: the requester has no status button.
    expect(
      screen.queryByRole("button", { name: "support.actions.cancel" })
    ).not.toBeInTheDocument();

    const box = screen.getByLabelText("support.composer.placeholder");
    fireEvent.change(box, { target: { value: "Obrigada!" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(api.post.mock.calls.some(([url]) => url.endsWith("/messages"))).toBe(
      false
    );
    fireEvent.keyDown(box, { key: "Enter" });

    expect(await screen.findByText("Obrigada!")).toBeInTheDocument();
    const [, form] = api.post.mock.calls.find(([url]) =>
      url.endsWith("/messages")
    );
    expect(form.get("body")).toBe("Obrigada!");
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("says a finished ticket reopens when the user writes", async () => {
    const done = ticket({ status: "done" });
    setServer({
      "/support/tickets": [done],
      "/support/tickets/5": {
        ticket: done,
        messages: [
          message(),
          message({
            id: 2,
            kind: "event",
            event: "done",
            fromSupport: true,
            mine: false,
            userName: "Suporte Komunick",
            body: "Corrigido hoje."
          })
        ]
      }
    });
    renderPage(requester, "/support/5");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "support.detail.finished"
    );
    expect(screen.getByText("Corrigido hoje.")).toBeInTheDocument();
    expect(
      screen.getByText(/support\.events\.done Suporte Komunick/)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("support.composer.reopen")
    ).toBeInTheDocument();
  });

  it("asks why before cancelling an open ticket", async () => {
    const open = ticket();
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": { ticket: open, messages: [message()] }
    });
    api.post.mockResolvedValue({
      data: { ticket: { ...open, status: "cancelled" }, messages: [message()] }
    });
    renderPage(requester, "/support/5");

    fireEvent.click(
      await screen.findByRole("button", { name: "support.actions.cancel" })
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "support.actions.confirm" })
    );
    expect(
      within(dialog).getByText("support.actions.textRequired")
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(
      within(dialog).getByLabelText("support.actions.prompt.cancel"),
      { target: { value: "Não preciso mais." } }
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "support.actions.confirm" })
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/support/tickets/5/actions", {
        action: "cancel",
        text: "Não preciso mais."
      })
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "support.detail.cancelled"
    );
  });

  it("keeps the text and shows the reason when the server refuses a message", async () => {
    const open = ticket();
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": { ticket: open, messages: [] }
    });
    api.post.mockRejectedValue({
      response: { data: { error: "ERR_SUPPORT_RATE_LIMIT" } }
    });
    renderPage(requester, "/support/5");

    const box = await screen.findByLabelText("support.composer.placeholder");
    fireEvent.change(box, { target: { value: "Oi" } });
    fireEvent.click(
      screen.getByRole("button", { name: "support.composer.send" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "backendErrors.ERR_SUPPORT_RATE_LIMIT"
    );
    expect(box).toHaveValue("Oi");
  });

  it("fetches the conversation again when the server says it changed", async () => {
    const open = ticket({ status: "in_progress" });
    let messages = [message()];
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": () => ({ ticket: open, messages })
    });
    renderPage(requester, "/support/5");
    expect(
      await screen.findByText("Ao clicar no cliente.")
    ).toBeInTheDocument();

    messages = [
      ...messages,
      message({
        id: 2,
        fromSupport: true,
        mine: false,
        userName: "Suporte Komunick",
        body: "Resposta ao vivo."
      })
    ];
    act(() => mockLiveHandler({ action: "message", ticketId: 5 }));

    expect(await screen.findByText("Resposta ao vivo.")).toBeInTheDocument();

    const calls = api.get.mock.calls.length;
    act(() => mockLiveHandler({ action: "message", ticketId: 99 }));
    await waitFor(() =>
      expect(api.get.mock.calls.slice(calls).map(([url]) => url)).toEqual([
        "/support/tickets"
      ])
    );
  });

  it("opens a PDF attachment inside the system", async () => {
    global.URL.createObjectURL = jest.fn(() => "blob:test");
    global.URL.revokeObjectURL = jest.fn();
    const open = ticket();
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": {
        ticket: open,
        messages: [
          message({
            attachments: [
              {
                id: "support-1.upload",
                name: "relatorio.pdf",
                mimeType: "application/pdf",
                size: 2048
              }
            ]
          })
        ]
      },
      "/support/tickets/5/attachments/support-1.upload": new Blob(["%PDF"])
    });
    renderPage(requester, "/support/5");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "support.attachments.open relatorio.pdf"
      })
    );

    expect(await screen.findByText("PDF relatorio.pdf")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      "/support/tickets/5/attachments/support-1.upload",
      { responseType: "blob" }
    );
    expect(
      screen.getByRole("link", { name: "support.attachments.download" })
    ).toHaveAttribute("download", "relatorio.pdf");
  });
});

describe("Support page for the super administrator", () => {
  it("starts on the queue of every company, with its numbers", async () => {
    mockSummary = {
      unread: 2,
      mineUnread: 0,
      queueUnread: 2,
      queue: { open: 3, unassigned: 2, inProgress: 1, waiting: 4 }
    };
    setServer({
      "/support/tickets": [ticket({ mine: false, unread: true })]
    });
    renderPage(superAdmin);

    expect(await screen.findByText("Conversa não abre")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/support/tickets", {
      params: { scope: "queue", search: "" }
    });
    expect(screen.getByText("Ana · Empresa Modelo")).toBeInTheDocument();
    const numbers = screen.getByTestId("support-summary");
    expect(numbers).toHaveTextContent("support.summary.open: 3");
    expect(numbers).toHaveTextContent("support.summary.unassigned: 2");
    expect(numbers).toHaveTextContent("support.summary.inProgress: 1");
    expect(numbers).toHaveTextContent("support.summary.waiting: 4");

    fireEvent.click(screen.getByText("support.tabs.mine"));
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith("/support/tickets", {
        params: { scope: "mine", search: "" }
      })
    );
  });

  it("takes a ticket with one click and concludes it with a reason", async () => {
    const open = ticket({
      mine: false,
      userEmail: "ana@example.invalid",
      userProfile: "user",
      screen: "1366x768"
    });
    const taken = {
      ...open,
      status: "in_progress",
      assignedUserName: "Suporte Komunick"
    };
    setServer({
      "/support/tickets": [open],
      "/support/tickets/5": {
        ticket: open,
        messages: [message({ mine: false })]
      }
    });
    api.post.mockImplementation(async (url, body) => {
      if (!url.endsWith("/actions")) return { data: {} };
      return {
        data: {
          ticket: body.action === "take" ? taken : { ...taken, status: "done" },
          messages: [message({ mine: false })]
        }
      };
    });
    renderPage(superAdmin, "/support/5");

    expect(
      await screen.findByText("Ana · ana@example.invalid")
    ).toBeInTheDocument();
    expect(screen.getByText("1366x768")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "support.actions.take" })
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/support/tickets/5/actions", {
        action: "take",
        text: undefined
      })
    );
    expect(
      await screen.findByRole("button", {
        name: "support.actions.request_info"
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "support.actions.take" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "support.actions.conclude" })
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("support.actions.prompt.conclude"),
      { target: { value: "Corrigido hoje." } }
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "support.actions.confirm" })
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/support/tickets/5/actions", {
        action: "conclude",
        text: "Corrigido hoje."
      })
    );
    expect(
      await screen.findByRole("button", { name: "support.actions.reopen" })
    ).toBeInTheDocument();
  });
});
