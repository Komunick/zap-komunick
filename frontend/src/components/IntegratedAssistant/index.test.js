import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegratedAssistant, { INTEGRATED_TIMEOUT_MS } from "./index";
import { validClients, validResult, validStatus } from "./contract";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const mockSocketCallbacks = {};
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../translate/i18n", () => ({
  i18n: { t: key => key, language: "pt-BR" }
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({
    user: { id: 101, companyId: 11, profile: "admin", queues: [{ id: 401 }] }
  })
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({
    GetSocket: () => ({
      on: (event, callback) => {
        mockSocketCallbacks[event] = callback;
      },
      off: jest.fn(),
      disconnect: jest.fn()
    })
  })
}));
const providers = ["acessorias", "sci"];
const source = provider => ({
  provider,
  label:
    provider === "sci" ? "Simulação local SCI" : "Simulação local Acessórias",
  fetchedAt: "2026-10-30T12:00:00.000Z",
  updatedAt: "2026-10-29T12:00:00.000Z",
  stale: false
});
const client = (provider, id = "mock-001") => ({
  externalClientId: id,
  name: `Fictitious ${provider} client ${id}`,
  documentLabel: "Invalid fictitious identifier 00.000.000/0000-00"
});
const status = () => ({
  enabled: true,
  mode: "mock",
  simulated: true,
  requiresReview: true,
  reason: null,
  limits: { maxMessages: 30, maxCharacters: 12000, pageSize: 5, maxPage: 100 },
  providers: Object.fromEntries(
    providers.map(provider => [
      provider,
      { enabled: true, mode: "mock", reason: null }
    ])
  )
});
const clients = () => ({
  mode: "mock",
  simulated: true,
  providers: Object.fromEntries(
    providers.map(provider => [
      provider,
      {
        state: "ready",
        clients: [client(provider), client(provider, "mock-002")],
        source: source(provider),
        errorCode: null
      }
    ])
  )
});
const detail = (provider, selected, total = 12) => {
  const start = (selected.page - 1) * 5;
  const items = Array.from(
    { length: Math.min(5, Math.max(0, total - start)) },
    (_, index) => ({
      id: `${selected.externalClientId}-item-${String(start + index + 1).padStart(2, "0")}`,
      title: `Fictitious ${provider} item ${start + index + 1}`,
      periodLabel: "Fictitious period",
      ...(provider === "sci"
        ? {
            categoryLabel: "Fictitious category",
            publishedAt: "2026-01-01T12:00:00.000Z"
          }
        : { status: "pending", dueLabel: "Unconfirmed fictitious due date" })
    })
  );
  return {
    mode: "mock",
    simulated: true,
    client: client(provider, selected.externalClientId),
    [provider === "sci" ? "publications" : "pendingItems"]: items,
    pagination: {
      page: selected.page,
      pageSize: 5,
      total,
      hasMore: selected.page * 5 < total
    },
    source: source(provider)
  };
};
const sources = (acessorias = "mock-001", sci = "mock-001") => ({
  acessorias: acessorias ? { externalClientId: acessorias, page: 1 } : null,
  sci: sci ? { externalClientId: sci, page: 1 } : null
});
const result = (kind = "summary", selection = sources()) => ({
  ticketId: 301,
  contactId: 201,
  kind,
  mode: "mock",
  simulated: true,
  requiresReview: true,
  text: "Fictitious integrated result for human review",
  references: [
    {
      messageId: "fictional-message-A",
      excerpt: "Fictitious conversation excerpt"
    }
  ],
  context: {
    maxMessages: 30,
    maxCharacters: 12000,
    messageCount: 1,
    characterCount: 29,
    partial: false
  },
  sources: Object.fromEntries(
    providers.map(provider => [
      provider,
      selection[provider]
        ? {
            state: "ready",
            data: detail(provider, selection[provider]),
            errorCode: null
          }
        : { state: "notSelected", data: null, errorCode: null }
    ])
  ),
  warnings: ["SIMULATED", "REVIEW_REQUIRED", "PARTIAL_PAGES"],
  generatedAt: "2026-10-30T12:00:00.000Z",
  contextVersion: "a".repeat(64)
});
const button = key =>
  screen.getByRole("button", { name: `integratedAssistant.${key}` });
const select = provider =>
  screen.getByLabelText(`integratedAssistant.${provider}Client`);
const page = provider =>
  screen.getByLabelText(`integratedAssistant.${provider}Page`);
const renderPanel = (props = {}) =>
  render(
    <IntegratedAssistant
      ticketId={301}
      contactId={201}
      companyId={11}
      onUseDraft={jest.fn()}
      {...props}
    />
  );
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const choose = (provider, id = "mock-001") =>
  fireEvent.change(select(provider), { target: { value: id } });
async function open() {
  await waitFor(() => expect(button("open")).toBeEnabled());
  fireEvent.click(button("open"));
  await waitFor(() => expect(select("sci")).toBeEnabled());
}
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockSocketCallbacks).forEach(
    key => delete mockSocketCallbacks[key]
  );
  sessionStorage.clear();
  localStorage.clear();
  api.get.mockImplementation(url =>
    Promise.resolve({ data: url.endsWith("/clients") ? clients() : status() })
  );
  api.post.mockImplementation((url, input) =>
    Promise.resolve({
      data: url.endsWith("/review")
        ? { valid: true, mode: "mock", simulated: true }
        : result(input.kind, input.sources)
    })
  );
});
afterEach(() => jest.useRealTimers());

test("invalid or unresolved tickets never request status or show an action", () => {
  renderPanel({ ticketId: undefined });
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("disabled or unknown availability never opens integrated queries", async () => {
  api.get.mockResolvedValue({
    data: {
      ...status(),
      enabled: false,
      mode: "disabled",
      reason: "SERVER_DISABLED"
    }
  });
  renderPanel();
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  expect(
    screen.queryByRole("button", { name: "integratedAssistant.open" })
  ).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("availability returns after an initially blocked composer is unlocked", async () => {
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  const accept = jest.fn();
  const view = renderPanel({ disabled: true, onUseDraft: accept });
  expect(
    screen.queryByRole("button", { name: "integratedAssistant.open" })
  ).not.toBeInTheDocument();
  view.rerender(
    <IntegratedAssistant
      ticketId={301}
      contactId={201}
      companyId={11}
      onUseDraft={accept}
      disabled={false}
    />
  );
  await act(async () => pending.resolve({ data: status() }));
  await waitFor(() => expect(button("open")).toBeEnabled());
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get.mock.calls[0][1].signal.aborted).toBe(false);
});
test("opening starts with independent empty selections and performs no generation", async () => {
  renderPanel();
  await open();
  expect(select("acessorias")).toHaveValue("");
  expect(select("sci")).toHaveValue("");
  expect(button("summary")).toBeDisabled();
  expect(button("reply")).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.get.mock.calls.every(([url]) => !url.includes("/catalog"))).toBe(
    true
  );
});
test("same IDs in two providers and independent pages remain explicit in a bounded request", async () => {
  renderPanel();
  await open();
  choose("acessorias");
  choose("sci");
  fireEvent.change(page("acessorias"), { target: { value: "2" } });
  fireEvent.change(page("sci"), { target: { value: "3" } });
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(button("summary"));
  await screen.findByText("Fictitious integrated result for human review");
  expect(api.post).toHaveBeenCalledWith(
    "/tickets/301/integrated-assistant",
    {
      kind: "summary",
      sources: {
        acessorias: { externalClientId: "mock-001", page: 2 },
        sci: { externalClientId: "mock-001", page: 3 }
      }
    },
    expect.objectContaining({ signal: expect.anything() })
  );
  expect(
    screen.getByRole("region", { name: "integratedAssistant.acessoriasResult" })
      .textContent
  ).toContain("Fictitious acessorias item 6");
  expect(
    screen.getByRole("region", { name: "integratedAssistant.sciResult" })
      .textContent
  ).toContain("Fictitious sci item 11");
  expect(
    screen.queryByRole("button", { name: "integratedAssistant.useDraft" })
  ).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
});
test.each(["0", "101", "1.5", ""])(
  "page %s is rejected before generation",
  async value => {
    renderPanel();
    await open();
    choose("sci");
    fireEvent.change(page("sci"), { target: { value } });
    expect(button("summary")).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  }
);
test("a one-source reply stays editable until fresh review succeeds and never submits the edited text", async () => {
  const accept = jest.fn();
  renderPanel({ onUseDraft: accept });
  await open();
  choose("sci");
  fireEvent.click(button("reply"));
  fireEvent.change(await screen.findByLabelText("integratedAssistant.draft"), {
    target: { value: "Human reviewed fictitious reply" }
  });
  expect(accept).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  fireEvent.click(button("useDraft"));
  fireEvent.click(button("useDraft"));
  await waitFor(() => expect(accept).toHaveBeenCalledTimes(1));
  expect(accept).toHaveBeenCalledWith("Human reviewed fictitious reply", 301);
  expect(api.post).toHaveBeenLastCalledWith(
    "/tickets/301/integrated-assistant/review",
    {
      kind: "reply",
      sources: sources(null, "mock-001"),
      contextVersion: "a".repeat(64)
    },
    expect.objectContaining({ signal: expect.anything() })
  );
  expect(JSON.stringify(api.post.mock.calls)).not.toContain(
    "Human reviewed fictitious reply"
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
});
test("review rejects a revoked snapshot without any socket event and never calls the composer", async () => {
  const accept = jest.fn();
  renderPanel({ onUseDraft: accept });
  await open();
  choose("sci");
  fireEvent.click(button("reply"));
  await screen.findByLabelText("integratedAssistant.draft");
  api.post.mockRejectedValueOnce({
    response: { data: { error: "ERR_INTEGRATED_ASSISTANT_CONTEXT_CHANGED" } }
  });
  fireEvent.click(button("useDraft"));
  await screen.findByText("integratedAssistant.contextChanged");
  expect(accept).not.toHaveBeenCalled();
  expect(
    screen.queryByLabelText("integratedAssistant.draft")
  ).not.toBeInTheDocument();
});
test("a disabled composer during the final review prevents late insertion", async () => {
  const accept = jest.fn();
  const pending = deferred();
  const view = renderPanel({ onUseDraft: accept });
  await open();
  choose("sci");
  fireEvent.click(button("reply"));
  await screen.findByLabelText("integratedAssistant.draft");
  api.post.mockReturnValueOnce(pending.promise);
  fireEvent.click(button("useDraft"));
  view.rerender(
    <IntegratedAssistant
      ticketId={301}
      contactId={201}
      companyId={11}
      onUseDraft={accept}
      disabled
    />
  );
  await act(async () =>
    pending.resolve({ data: { valid: true, mode: "mock", simulated: true } })
  );
  expect(accept).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
});
test("composer refusal keeps human text in memory and does not insert", async () => {
  const accept = jest.fn(() => false);
  renderPanel({ onUseDraft: accept });
  await open();
  choose("sci");
  fireEvent.click(button("reply"));
  const draft = await screen.findByLabelText("integratedAssistant.draft");
  fireEvent.change(draft, { target: { value: "Human fixture edit" } });
  fireEvent.click(button("useDraft"));
  await screen.findByText("integratedAssistant.composerBlocked");
  expect(draft).toHaveValue("Human fixture edit");
  expect(sessionStorage.length).toBe(0);
});
test("cancel aborts generation and ignores a result that still resolves", async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  renderPanel();
  await open();
  choose("sci");
  fireEvent.click(button("summary"));
  const signal = api.post.mock.calls[0][2].signal;
  fireEvent.click(button("cancel"));
  expect(signal.aborted).toBe(true);
  await act(async () =>
    pending.resolve({ data: result("summary", sources(null, "mock-001")) })
  );
  expect(
    screen.queryByText("Fictitious integrated result for human review")
  ).not.toBeInTheDocument();
});
test("selection or page changes clear every generated result and require a new explicit query", async () => {
  renderPanel();
  await open();
  choose("sci");
  fireEvent.click(button("summary"));
  await screen.findByText("Fictitious integrated result for human review");
  fireEvent.change(page("sci"), { target: { value: "2" } });
  expect(
    screen.queryByText("Fictitious integrated result for human review")
  ).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);
  choose("sci", "mock-002");
  expect(page("sci")).toHaveValue(1);
  expect(api.post).toHaveBeenCalledTimes(1);
});
test("actor changes remount state and ignore pending data even for the same ticket", async () => {
  const pending = deferred();
  api.post.mockReturnValueOnce(pending.promise);
  const wrap = user => (
    <AuthContext.Provider value={{ user }}>
      <IntegratedAssistant
        ticketId={301}
        contactId={201}
        companyId={11}
        onUseDraft={jest.fn()}
      />
    </AuthContext.Provider>
  );
  const view = render(
    wrap({ id: 101, companyId: 11, profile: "admin", queues: [{ id: 401 }] })
  );
  await open();
  choose("sci");
  fireEvent.click(button("summary"));
  view.rerender(
    wrap({ id: 102, companyId: 11, profile: "user", queues: [{ id: 402 }] })
  );
  await act(async () =>
    pending.resolve({ data: result("summary", sources(null, "mock-001")) })
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
  expect(
    screen.queryByText("Fictitious integrated result for human review")
  ).not.toBeInTheDocument();
});
test.each([
  "integratedAssistantEnabled",
  "aiAssistantEnabled",
  "acessoriasEnabled",
  "sciEnabled"
])("changing %s invalidates results and closes the dialog", async key => {
  renderPanel();
  await open();
  choose("sci");
  fireEvent.click(button("reply"));
  await screen.findByLabelText("integratedAssistant.draft");
  await act(async () =>
    mockSocketCallbacks.settings({ key, value: "disabled" })
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
  expect(
    screen.queryByLabelText("integratedAssistant.draft")
  ).not.toBeInTheDocument();
});
test.each(["acessorias", "sci"])(
  "a matching %s link event discards pending data and reloads only authorized links",
  async provider => {
    const pending = deferred();
    api.post.mockReturnValueOnce(pending.promise);
    renderPanel();
    await open();
    choose("sci");
    fireEvent.click(button("summary"));
    await act(async () =>
      mockSocketCallbacks[`company-11-${provider}-links`]({ contactId: 201 })
    );
    await act(async () =>
      pending.resolve({ data: result("summary", sources(null, "mock-001")) })
    );
    expect(
      screen.queryByText("Fictitious integrated result for human review")
    ).not.toBeInTheDocument();
    expect(select("sci")).toHaveValue("");
  }
);
test("operational errors stay per source and preserve a valid stale or empty source", async () => {
  const output = result();
  output.sources.acessorias = {
    state: "error",
    data: null,
    errorCode: "ERR_ACESSORIAS_RATE_LIMITED"
  };
  output.sources.sci.data = detail("sci", sources().sci, 0);
  output.sources.sci.data.source.stale = true;
  output.warnings.push("PARTIAL_SOURCES", "STALE_SOURCES");
  api.post.mockResolvedValue({ data: output });
  renderPanel();
  await open();
  choose("acessorias");
  choose("sci");
  fireEvent.click(button("summary"));
  await screen.findByText("Fictitious integrated result for human review");
  expect(
    within(
      screen.getByRole("region", {
        name: "integratedAssistant.acessoriasResult"
      })
    ).getByText("integratedAssistant.rateLimited")
  ).toBeInTheDocument();
  const sci = within(
    screen.getByRole("region", { name: "integratedAssistant.sciResult" })
  );
  expect(sci.getByText("integratedAssistant.stale")).toBeInTheDocument();
  expect(sci.getByText("integratedAssistant.emptySource")).toBeInTheDocument();
  expect(
    screen.getByText("integratedAssistant.warnings.PARTIAL_SOURCES")
  ).toBeInTheDocument();
});

test.each(["acessorias", "sci"])(
  "CLIENT_NOT_FOUND remains a partial %s source failure after an authorized selection",
  async provider => {
    const output = result();
    output.sources[provider] = {
      state: "error",
      data: null,
      errorCode: `ERR_${provider.toUpperCase()}_CLIENT_NOT_FOUND`
    };
    output.warnings.push("PARTIAL_SOURCES");
    expect(validResult(output, 301, 201, "summary", sources())).toBe(true);
    api.post.mockResolvedValue({ data: output });
    renderPanel();
    await open();
    choose("acessorias");
    choose("sci");
    fireEvent.click(button("summary"));
    await screen.findByText("Fictitious integrated result for human review");
    const failedSource = within(
      screen.getByRole("region", {
        name: `integratedAssistant.${provider}Result`
      })
    );
    expect(
      failedSource.getByText("integratedAssistant.sourceNotFound")
    ).toBeInTheDocument();
    const validProvider = provider === "sci" ? "acessorias" : "sci";
    expect(
      within(
        screen.getByRole("region", {
          name: `integratedAssistant.${validProvider}Result`
        })
      ).getByText(client(validProvider).name)
    ).toBeInTheDocument();
  }
);

test("an errorCode from another provider cannot relabel a source failure", () => {
  const output = result();
  output.sources.sci = {
    state: "error",
    data: null,
    errorCode: "ERR_ACESSORIAS_RATE_LIMITED"
  };
  expect(validResult(output, 301, 201, "summary", sources())).toBe(false);
  const list = clients();
  list.providers.acessorias = {
    state: "error",
    clients: [],
    source: null,
    errorCode: "ERR_SCI_UNAVAILABLE"
  };
  expect(validClients(list)).toBe(false);
});
test("timeout invalidates an unresolved query without retaining results", async () => {
  renderPanel();
  await open();
  choose("sci");
  api.post.mockReturnValueOnce(new Promise(() => {}));
  jest.useFakeTimers("legacy");
  fireEvent.click(button("summary"));
  await act(async () => jest.advanceTimersByTime(INTEGRATED_TIMEOUT_MS + 1));
  expect(screen.getByText("integratedAssistant.timeout")).toBeInTheDocument();
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
});
test("unexpected fields or document links reject the complete result without displaying content", async () => {
  const output = result("summary", sources(null, "mock-001"));
  output.sources.sci.data.downloadUrl =
    "https://example.invalid/private-document";
  api.post.mockResolvedValue({ data: output });
  renderPanel();
  await open();
  choose("sci");
  fireEvent.click(button("summary"));
  await screen.findByText("integratedAssistant.invalidOutput");
  expect(
    screen.queryByText("Fictitious integrated result for human review")
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
test("disabled sources cannot reuse clients from other provider availability", async () => {
  const data = clients();
  data.providers.acessorias = {
    state: "disabled",
    clients: [],
    source: null,
    errorCode: "ERR_ACESSORIAS_DISABLED"
  };
  api.get.mockImplementation(url =>
    Promise.resolve({ data: url.endsWith("/clients") ? data : status() })
  );
  renderPanel();
  await open();
  expect(select("acessorias")).toBeDisabled();
  expect(select("sci")).toBeEnabled();
  expect(
    screen.getByText("integratedAssistant.sourceDisabled")
  ).toBeInTheDocument();
});

test("strict contracts accept the approved bounded shapes", () => {
  expect(validStatus(status())).toBe(true);
  expect(validClients(clients())).toBe(true);
  expect(validResult(result(), 301, 201, "summary", sources())).toBe(true);
});
test.each([
  value => {
    value.ticketId = 302;
  },
  value => {
    value.contactId = 202;
  },
  value => {
    value.mode = "real";
  },
  value => {
    value.sources.sci.data.source.provider = "acessorias";
  },
  value => {
    value.sources.sci.data.client.externalClientId = "other-client";
  },
  value => {
    value.sources.sci.data.pagination.page = 2;
  },
  value => {
    value.sources.sci.data.publications.push(
      value.sources.sci.data.publications[0]
    );
  },
  value => {
    value.references[0].secret = "fictitious-secret";
  },
  value => {
    value.context.maxMessages = 300;
  },
  value => {
    value.contextVersion = "not-a-version";
  },
  value => {
    value.warnings.push("UNKNOWN_PERMISSION");
  },
  value => {
    value.sources.sci.data.publications[0].url = "https://example.invalid/file";
  }
])(
  "strict result rejects a foreign context, expanded permission or extra payload",
  mutate => {
    const value = result();
    mutate(value);
    expect(validResult(value, 301, 201, "summary", sources())).toBe(false);
  }
);
