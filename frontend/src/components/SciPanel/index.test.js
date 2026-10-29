import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import i18next from "i18next";
import SciPanel, { SCI_TIMEOUT_MS } from "./index";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { komunickMessages } from "../../translate/languages/komunick";
import { i18n } from "../../translate/i18n";

jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext(null)
}));
jest.mock("../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));
jest.mock("../../translate/i18n", () => ({
  i18n: {
    language: "pt-BR",
    t: (key, values) =>
      values?.name
        ? `${key} ${values.name}`
        : values?.page
          ? `${key} ${values.page}`
          : key
  }
}));
const client1 = {
  externalClientId: "mock-001",
  name: "Fixture Company One",
  documentLabel: "CNPJ fictício inválido A"
};
const client2 = {
  externalClientId: "mock-002",
  name: "Fixture Company Two",
  documentLabel: "CNPJ fictício inválido B"
};
const status = {
  enabled: true,
  mode: "mock",
  simulated: true,
  canManageLinks: true,
  reason: null,
  limits: { pageSize: 5, maxPage: 100 }
};
const source = {
  provider: "sci",
  label: "Simulação local SCI",
  fetchedAt: "2026-10-27T12:00:00.000Z",
  updatedAt: "2026-10-26T12:00:00.000Z",
  stale: false
};
const list = clients => ({ mode: "mock", simulated: true, clients, source });
const detail = (id, page = 1, overrides = {}) => ({
  mode: "mock",
  simulated: true,
  client: id === "mock-001" ? client1 : client2,
  publications: Array.from(
    { length: Math.min(5, 12 - (page - 1) * 5) },
    (_, offset) => ({
      id: `fixture-${id}-${page}-${offset}`,
      title:
        offset === 0
          ? `Fixture publication ${id} page ${page}`
          : `Other publication ${page}-${offset}`,
      categoryLabel: "Categoria fictícia",
      periodLabel: "Competência simulada",
      publishedAt: "2026-10-25T12:00:00.000Z"
    })
  ),
  pagination: { page, pageSize: 5, total: 12, hasMore: page < 3 },
  source,
  ...overrides
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
let linked;
const respond = async (url, config) => {
  if (url.endsWith("/status")) return { data: status };
  if (url.endsWith("/catalog")) return { data: list([client1, client2]) };
  if (url.endsWith("/clients")) return { data: list(linked) };
  return { data: detail(url.split("/").pop(), config.params.page) };
};
const button = key =>
  screen.getByRole("button", { name: `sci.${key}`, exact: true });
const panel = props => (
  <SciPanel ticketId={301} contactId={201} companyId={10} {...props} />
);
async function openPanel() {
  await waitFor(() => expect(button("open")).toBeEnabled());
  fireEvent.click(button("open"));
  await screen.findByLabelText("sci.selectedClient");
}
async function choose(id = "mock-001") {
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: id }
  });
  await screen.findByText(`Fixture publication ${id} page 1`);
}
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  linked = [client1, client2];
  i18n.language = "pt-BR";
  api.get.mockImplementation(respond);
});
afterEach(() => jest.restoreAllMocks());

test("source dates remain readable with real i18next without changing global escaping", async () => {
  const translator = i18next.createInstance();
  await translator.init({
    lng: "pt",
    resources: {
      pt: {
        translation: {
          sci: {
            updatedAt: "Atualizado em {{date}}",
            fetchedAt: "Consultado em {{date}}"
          },
          untouched: "Valor {{text}}"
        }
      }
    }
  });
  jest
    .spyOn(i18n, "t")
    .mockImplementation((key, options) => translator.t(key, options));
  render(panel());
  await openPanel();
  await screen.findByText(
    `Atualizado em ${new Date(source.updatedAt).toLocaleString("pt-BR")}`
  );
  expect(
    screen.getByText(
      `Consultado em ${new Date(source.fetchedAt).toLocaleString("pt-BR")}`
    )
  ).toBeVisible();
  expect(screen.queryByText(/&#x2F;/)).not.toBeInTheDocument();
  expect(translator.t("untouched", { text: "<b>fictício</b>" })).toBe(
    "Valor &lt;b&gt;fictício&lt;&#x2F;b&gt;"
  );
});

test("unresolved ticket does not request status or expose an action", async () => {
  const view = render(panel({ ticketId: undefined }));
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  view.rerender(panel());
  await waitFor(() => expect(button("open")).toBeEnabled());
  expect(api.get.mock.calls[0][0]).toBe("/tickets/301/sci/status");
});

test("company off hides the panel even for an administrator", async () => {
  api.get.mockResolvedValue({
    data: {
      ...status,
      enabled: false,
      mode: "disabled",
      reason: "SERVER_DISABLED"
    }
  });
  render(panel());
  await waitFor(() =>
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  );
  expect(api.post).not.toHaveBeenCalled();
});

test("explicit selection is required and results remain only in memory", async () => {
  render(panel());
  await openPanel();
  expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("");
  expect(
    api.get.mock.calls.filter(([url]) => url.includes("/clients/"))
  ).toHaveLength(0);
  await choose();
  expect(screen.getByText("sci.simulation")).toBeInTheDocument();
  expect(screen.getByText("sci.registration")).toBeInTheDocument();
  expect(screen.getByText("Simulação local SCI")).toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.delete).not.toHaveBeenCalled();
});

test("status still loading, failed or contradictory never exposes an action", async () => {
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  const view = render(panel());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  await act(async () =>
    pending.resolve({ data: { ...status, mode: "disabled", reason: null } })
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  api.get.mockRejectedValue(new Error("private-fictitious-error"));
  view.rerender(panel({ ticketId: 302 }));
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith(
      "/tickets/302/sci/status",
      expect.anything()
    )
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("Portuguese locale variants format source timestamps without losing the panel", async () => {
  i18n.language = "pt_PT";
  render(panel());
  await openPanel();
  await choose();
  expect(screen.getByText("Simulação local SCI")).toBeInTheDocument();
});

test("pagination is scoped to the explicitly selected client", async () => {
  render(panel());
  await openPanel();
  await choose();
  fireEvent.click(button("next"));
  await screen.findByText("Fixture publication mock-001 page 2");
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith(
    "/tickets/301/sci/clients/mock-001",
    expect.objectContaining({ params: { page: 2 } })
  );
});

test("changing client ignores a late result from the previous selection", async () => {
  const pending = deferred();
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  render(panel());
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  const signal = api.get.mock.calls.find(([url]) =>
    url.endsWith("/clients/mock-001")
  )[1].signal;
  await choose("mock-002");
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Fixture publication mock-002 page 1")
  ).toBeInTheDocument();
});

test("cancel and reopening never expose a late query result", async () => {
  const pending = deferred();
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  render(panel());
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  fireEvent.click(button("close"));
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  await openPanel();
  expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("");
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
});

test("ticket or contact change clears the result and aborts the previous context", async () => {
  const view = render(panel());
  await openPanel();
  await choose();
  view.rerender(panel({ ticketId: 302, contactId: 202 }));
  await waitFor(() => expect(button("open")).toBeEnabled());
  await openPanel();
  expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("");
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
});

test("stale and empty data are visibly qualified", async () => {
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-002")
      ? {
          data: detail("mock-002", 1, {
            publications: [],
            pagination: { page: 1, pageSize: 5, total: 0, hasMore: false },
            source: { ...source, stale: true }
          })
        }
      : respond(url, config)
  );
  render(panel());
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-002" }
  });
  await screen.findByText("sci.noPublications");
  expect(screen.getByText("sci.stale")).toBeInTheDocument();
  expect(button("next")).toBeDisabled();
});

test("failure clears old client data and never presents an old source as fresh", async () => {
  render(panel());
  await openPanel();
  await choose();
  api.get.mockRejectedValueOnce({
    response: {
      data: {
        error: "ERR_SCI_FUNCTIONAL_ERROR",
        secret: "private-fictitious-payload"
      }
    }
  });
  fireEvent.click(button("next"));
  await screen.findByText("sci.functionalError");
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Simulação local SCI")).not.toBeInTheDocument();
  expect(
    screen.queryByText("private-fictitious-payload")
  ).not.toBeInTheDocument();
});

test.each([
  { simulated: false },
  { client: { ...client2 } },
  { publications: [null] },
  {
    publications: detail("mock-001").publications.map(item => ({
      ...item,
      url: "https://private.invalid/document"
    }))
  },
  {
    publications: detail("mock-001").publications.map(item => ({
      ...item,
      publishedAt: "2099-01-01T00:00:00.000Z"
    }))
  },
  {
    publications: detail("mock-001").publications.map(item => ({
      ...item,
      id: "same-id"
    }))
  },
  { publications: detail("mock-001").publications.slice(0, 1) },
  { documentContent: "private-fictitious-document" },
  { source: { ...source, provider: "acessorias" } },
  { source: { ...source, label: "SCI real" } },
  { pagination: { page: 1, pageSize: 5, total: 12, hasMore: false } },
  { source: { ...source, stale: "false" } }
])("rejects invalid or wrong-client output (%j)", async invalid => {
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001")
      ? { data: detail("mock-001", 1, invalid) }
      : respond(url, config)
  );
  render(panel());
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  await screen.findByText("sci.invalidOutput");
  expect(screen.queryByText("sci.registration")).not.toBeInTheDocument();
});

test("staff can query linked clients but never sees catalog or link controls", async () => {
  api.get.mockImplementation((url, config) =>
    url.endsWith("/status")
      ? { data: { ...status, canManageLinks: false } }
      : respond(url, config)
  );
  render(panel());
  await openPanel();
  expect(
    screen.queryByRole("button", { name: "sci.linkClient" })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /sci.unlinkNamed/ })
  ).not.toBeInTheDocument();
  await choose();
  expect(api.post).not.toHaveBeenCalled();
});

test("administrator explicitly confirms linking a catalog client and unlinking locally", async () => {
  linked = [client1];
  api.post.mockImplementation(async (_url, body) => {
    linked = [client1, client2];
    return {
      data: {
        externalClientId: body.externalClientId,
        linked: true,
        created: true
      }
    };
  });
  api.delete.mockImplementation(async () => {
    linked = [client1];
    return {
      data: { externalClientId: "mock-002", linked: false, deleted: true }
    };
  });
  render(panel());
  await openPanel();
  fireEvent.click(button("linkClient"));
  const link = await screen.findByRole("button", {
    name: "sci.linkNamed Fixture Company Two"
  });
  fireEvent.click(link);
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(button("confirmLink"));
  await screen.findByRole("button", {
    name: "sci.unlinkNamed Fixture Company Two"
  });
  expect(api.post).toHaveBeenCalledWith(
    "/tickets/301/sci/links",
    { externalClientId: "mock-002" },
    expect.anything()
  );
  fireEvent.click(
    screen.getByRole("button", {
      name: "sci.unlinkNamed Fixture Company Two"
    })
  );
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(button("confirmUnlink"));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", {
        name: "sci.unlinkNamed Fixture Company Two"
      })
    ).not.toBeInTheDocument()
  );
  expect(api.delete).toHaveBeenCalledWith(
    "/tickets/301/sci/links/mock-002",
    expect.anything()
  );
  expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("");
});

test("a current-contact link event clears visible results, while other contacts are ignored", async () => {
  const handlers = {};
  const socket = {
    on: jest.fn((name, callback) => {
      handlers[name] = callback;
    }),
    off: jest.fn(),
    disconnect: jest.fn()
  };
  render(
    <SocketContext.Provider value={{ GetSocket: () => socket }}>
      {panel()}
    </SocketContext.Provider>
  );
  await openPanel();
  await choose();
  act(() => handlers["company-10-sci-links"]({ contactId: 999 }));
  expect(
    screen.getByText("Fixture publication mock-001 page 1")
  ).toBeInTheDocument();
  linked = [client2];
  act(() => handlers["company-10-sci-links"]({ contactId: 201 }));
  await waitFor(() =>
    expect(
      screen.queryByText("Fixture publication mock-001 page 1")
    ).not.toBeInTheDocument()
  );
  await waitFor(() =>
    expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("")
  );
});

test("a link event aborts pending client data and its late result cannot reappear", async () => {
  const pending = deferred();
  const handlers = {};
  const socket = {
    on: jest.fn((name, callback) => {
      handlers[name] = callback;
    }),
    off: jest.fn(),
    disconnect: jest.fn()
  };
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  render(
    <SocketContext.Provider value={{ GetSocket: () => socket }}>
      {panel()}
    </SocketContext.Provider>
  );
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  const signal = api.get.mock.calls.find(([url]) =>
    url.endsWith("/clients/mock-001")
  )[1].signal;
  linked = [client2];
  act(() => handlers["company-10-sci-links"]({ contactId: 201 }));
  await waitFor(() =>
    expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("")
  );
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
});

test("timeout invalidates a query even if its transport eventually resolves", async () => {
  const pending = deferred();
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  render(panel());
  await openPanel();
  const timer = jest.spyOn(global, "setTimeout");
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  act(() => timer.mock.calls.find(call => call[1] === SCI_TIMEOUT_MS)[0]());
  await screen.findByText("sci.timeout");
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
});

test("publication metadata is visible without document links or read actions", async () => {
  render(panel());
  await openPanel();
  await choose();
  expect(screen.getByText("sci.publications")).toBeVisible();
  expect(screen.getAllByText(/Categoria fictícia/)).toHaveLength(5);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.delete).not.toHaveBeenCalled();
});

test("all three publication pages contain five, five and two items", async () => {
  render(panel());
  await openPanel();
  await choose();
  expect(screen.getAllByText(/Categoria fictícia/)).toHaveLength(5);
  fireEvent.click(button("next"));
  await screen.findByText("Fixture publication mock-001 page 2");
  expect(screen.getAllByText(/Categoria fictícia/)).toHaveLength(5);
  fireEvent.click(button("next"));
  await screen.findByText("Fixture publication mock-001 page 3");
  expect(screen.getAllByText(/Categoria fictícia/)).toHaveLength(2);
  expect(button("next")).toBeDisabled();
  fireEvent.click(button("previous"));
  await screen.findByText("Fixture publication mock-001 page 2");
  expect(screen.getAllByText(/Categoria fictícia/)).toHaveLength(5);
});

test("switching company or ticket context aborts data even with the same ticket id", async () => {
  const pending = deferred();
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  const view = render(panel({ contextKey: "queue-1" }));
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  const signal = api.get.mock.calls.find(([url]) =>
    url.endsWith("/clients/mock-001")
  )[1].signal;
  view.rerender(panel({ companyId: 20, contextKey: "queue-2" }));
  await waitFor(() => expect(button("open")).toBeEnabled());
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  await openPanel();
  expect(screen.getByLabelText("sci.selectedClient")).toHaveValue("");
});

test("current viewer profile or sector changes invalidate the panel and late data", async () => {
  const pending = deferred();
  api.get.mockImplementation((url, config) =>
    url.endsWith("/clients/mock-001") ? pending.promise : respond(url, config)
  );
  const view = render(
    <AuthContext.Provider
      value={{
        user: { id: 10, companyId: 10, profile: "admin", queues: [{ id: 401 }] }
      }}
    >
      {panel()}
    </AuthContext.Provider>
  );
  await openPanel();
  fireEvent.change(screen.getByLabelText("sci.selectedClient"), {
    target: { value: "mock-001" }
  });
  const signal = api.get.mock.calls.find(([url]) =>
    url.endsWith("/clients/mock-001")
  )[1].signal;
  api.get.mockRejectedValue({
    response: { data: { error: "ERR_NO_PERMISSION" } }
  });
  view.rerender(
    <AuthContext.Provider
      value={{
        user: { id: 10, companyId: 10, profile: "user", queues: [{ id: 402 }] }
      }}
    >
      {panel()}
    </AuthContext.Provider>
  );
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => pending.resolve({ data: detail("mock-001") }));
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("SCI flag events clear results while Acessórias flag events do not affect SCI", async () => {
  const handlers = {};
  const socket = {
    on: jest.fn((name, callback) => {
      handlers[name] = callback;
    }),
    off: jest.fn(),
    disconnect: jest.fn()
  };
  render(
    <SocketContext.Provider value={{ GetSocket: () => socket }}>
      {panel()}
    </SocketContext.Provider>
  );
  await openPanel();
  await choose();
  act(() => handlers.settings({ key: "acessoriasEnabled", value: "disabled" }));
  expect(
    screen.getByText("Fixture publication mock-001 page 1")
  ).toBeInTheDocument();
  api.get.mockResolvedValue({
    data: { ...status, enabled: false, reason: "COMPANY_DISABLED" }
  });
  act(() => handlers.settings({ key: "sciEnabled", value: "disabled" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("catalog metadata with an extra private field is rejected before rendering", async () => {
  api.get.mockImplementation((url, config) =>
    url.endsWith("/catalog")
      ? {
          data: {
            ...list([{ ...client2, name: "Hidden private catalog client" }]),
            accessToken: "private-catalog-canary"
          }
        }
      : respond(url, config)
  );
  render(panel());
  await openPanel();
  fireEvent.click(button("linkClient"));
  await screen.findByText("sci.invalidOutput");
  expect(
    screen.queryByText("Hidden private catalog client")
  ).not.toBeInTheDocument();
  expect(screen.queryByText("private-catalog-canary")).not.toBeInTheDocument();
});

test("canceling local link confirmation never starts a mutation", async () => {
  linked = [client1];
  render(panel());
  await openPanel();
  fireEvent.click(button("linkClient"));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "sci.linkNamed Fixture Company Two"
    })
  );
  fireEvent.click(button("cancel"));
  expect(screen.queryByText("sci.confirmLinkTitle")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
  expect(api.delete).not.toHaveBeenCalled();
});

test.each([
  ["ERR_SCI_UPSTREAM_UNAUTHORIZED", "upstreamUnauthorized"],
  ["ERR_SCI_RATE_LIMITED", "rateLimited"],
  ["ERR_SCI_TIMEOUT", "timeout"],
  ["ERR_SCI_UNAVAILABLE", "unavailable"],
  ["ERR_NO_PERMISSION", "permission"],
  ["ERR_SCI_CONTEXT_CHANGED", "contextChanged"]
])("provider/access failure %s has a safe UI state", async (code, key) => {
  render(panel());
  await openPanel();
  await choose();
  api.get.mockRejectedValueOnce({
    response: { data: { error: code, secret: "private-error-canary" } }
  });
  fireEvent.click(button("next"));
  await screen.findByText(`sci.${key}`);
  expect(
    screen.queryByText("Fixture publication mock-001 page 1")
  ).not.toBeInTheDocument();
  expect(screen.queryByText("private-error-canary")).not.toBeInTheDocument();
});

test("SCI texts and metadata labels are available in all supported locales", () => {
  for (const language of ["pt", "pt_PT", "en", "es"]) {
    const messages = komunickMessages[language].translations;
    expect(messages.sci.title).toMatch(/SCI/);
    expect(messages.sci.publishedAt).toContain("{{date}}");
    expect(messages.sci.publications).toBeTruthy();
    expect(messages.sci.scope).not.toMatch(/Acessórias/);
    expect(messages.audit.actions.sci_link_created).toBeTruthy();
    expect(messages.audit.actions.sci_link_deleted).toBeTruthy();
  }
});
