import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import MessageInput from "./index";
import { createKomunickTheme } from "../../theme/komunick";
import { AuthContext } from "../../context/Auth/AuthContext";
import { EditMessageContext } from "../../context/EditingMessage/EditingMessageContext";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import api from "../../services/api";

let mockAssistantProps;
let mockIntegratedProps;
jest.mock("../IntegratedAssistant", () => props => {
  mockIntegratedProps = props;
  return (
    <button
      disabled={props.disabled}
      onClick={() =>
        props.onUseDraft("Integrated reviewed fixture", props.ticketId)
      }
    >
      Use integrated fixture
    </button>
  );
});
jest.mock("../TicketAssistant", () => props => {
  mockAssistantProps = props;
  return (
    <button
      disabled={props.disabled}
      onClick={() => props.onUseDraft("Reviewed fixture", props.ticketId)}
    >
      Use assistant fixture
    </button>
  );
});
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("mic-recorder-to-mp3", () =>
  jest.fn().mockImplementation(() => ({}))
);
jest.mock("emoji-mart", () => ({ Picker: () => null }));
jest.mock("compressorjs", () => jest.fn());
jest.mock("react-whatsmarked", () => ({ children }) => <span>{children}</span>);
jest.mock("../../hooks/useQuickMessages", () => () => ({
  list: async () => []
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({
    user: { id: 101, name: "Fixture User" }
  })
}));
jest.mock("../../context/EditingMessage/EditingMessageContext", () => ({
  EditMessageContext: require("react").createContext({
    editingMessage: null,
    setEditingMessage: jest.fn()
  })
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({
    GetSocket: () => ({ disconnect: jest.fn(), emit: jest.fn() })
  })
}));
const theme = createKomunickTheme({ mode: "light" });
const ticket = id => ({
  id,
  status: "open",
  contactId: id + 100,
  queueId: 401,
  userId: 101
});
const field = () =>
  screen.getByPlaceholderText("messagesInput.placeholderOpen");
const replySetter = jest.fn();
const viewOf = (id, reply = null) => (
  <ThemeProvider theme={theme}>
    <ReplyMessageContext.Provider
      value={{ replyingMessage: reply, setReplyingMessage: replySetter }}
    >
      <MessageInput width="md" ticket={ticket(id)} />
    </ReplyMessageContext.Provider>
  </ThemeProvider>
);
const viewForCompany = (user, editingMessage = null) => (
  <AuthContext.Provider value={{ user }}>
    <EditMessageContext.Provider
      value={{ editingMessage, setEditingMessage: jest.fn() }}
    >
      {viewOf(301)}
    </EditMessageContext.Provider>
  </AuthContext.Provider>
);
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  localStorage.setItem("signOption", "false");
  jest.clearAllMocks();
  api.get.mockResolvedValue({ data: "disabled" });
  api.post.mockResolvedValue({ data: {} });
});

test("keeps ticket-owned drafts through A/B/A switches", async () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  sessionStorage.setItem("messageDraft-302", "Human B");
  const view = render(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  view.rerender(viewOf(302));
  await waitFor(() => expect(field()).toHaveValue("Human B"));
  view.rerender(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  expect(sessionStorage.getItem("messageDraft-302")).toBe("Human B");
});

test("an unresolved ticket has no composer and loads the real ticket draft when ready", async () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  const view = render(viewOf(undefined));
  expect(
    screen.queryByPlaceholderText("messagesInput.placeholderOpen")
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Use assistant fixture")).not.toBeInTheDocument();
  expect(sessionStorage.getItem("messageDraft-undefined")).toBeNull();
  view.rerender(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  expect(sessionStorage.getItem("messageDraft-undefined")).toBeNull();
});

test("accepting appends through the actual composer without sending", async () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  render(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  fireEvent.click(screen.getByText("Use assistant fixture"));
  expect(field()).toHaveValue("Human A\n\nReviewed fixture");
  expect(sessionStorage.getItem("messageDraft-301")).toBe(
    "Human A\n\nReviewed fixture"
  );
  expect(api.post).not.toHaveBeenCalled();
});

test("a reviewed callback cannot insert after entering reply mode or changing ticket", async () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  sessionStorage.setItem("messageDraft-302", "Human B");
  const view = render(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  const accept = mockAssistantProps.onUseDraft;
  view.rerender(
    viewOf(301, { body: "Fictitious quoted message", fromMe: false })
  );
  expect(accept("Late suggestion", 301)).toBe(false);
  expect(field()).toHaveValue("Human A");
  view.rerender(viewOf(302));
  await waitFor(() => expect(field()).toHaveValue("Human B"));
  expect(accept("Late suggestion", 301)).toBe(false);
  expect(field()).toHaveValue("Human B");
});

test("integrated review reuses the actual draft guard and preserves existing text without sending", async () => {
  sessionStorage.setItem("messageDraft-301", "Human A");
  sessionStorage.setItem("messageDraft-302", "Human B");
  const view = render(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  fireEvent.click(screen.getByText("Use integrated fixture"));
  expect(field()).toHaveValue("Human A\n\nIntegrated reviewed fixture");
  const accept = mockIntegratedProps.onUseDraft;
  view.rerender(viewOf(301, { body: "Fictitious reply", fromMe: false }));
  expect(accept("Late integrated fixture", 301)).toBe(false);
  view.rerender(viewOf(302));
  await waitFor(() => expect(field()).toHaveValue("Human B"));
  expect(accept("Late integrated fixture", 301)).toBe(false);
  expect(field()).toHaveValue("Human B");
  expect(api.post).not.toHaveBeenCalled();
});

test("sending with a pending mock request clears only the sent ticket draft", async () => {
  let resolve;
  api.post.mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  sessionStorage.setItem("messageDraft-301", "Human A");
  sessionStorage.setItem("messageDraft-302", "Human B");
  const view = render(viewOf(301));
  await waitFor(() => expect(field()).toHaveValue("Human A"));
  fireEvent.click(screen.getByRole("button", { name: "sendMessage" }));
  view.rerender(viewOf(302));
  await act(async () => resolve({ data: {} }));
  expect(field()).toHaveValue("Human B");
  expect(sessionStorage.getItem("messageDraft-301")).toBeNull();
  expect(sessionStorage.getItem("messageDraft-302")).toBe("Human B");
  expect(api.post).toHaveBeenCalledWith(
    "/messages/301",
    expect.objectContaining({ body: "Human A" })
  );
});

test("company policy locks the signature without changing the saved browser preference", async () => {
  api.get.mockResolvedValueOnce({ data: "enabled" });
  sessionStorage.setItem("messageDraft-301", "Fictitious text");
  render(viewForCompany({ id: 101, companyId: 2, name: "Camila Oliveira" }));

  const control = await screen.findByRole("button", {
    name: "companyMessageSignature.required"
  });
  expect(api.get).toHaveBeenCalledWith("/settings/forceMessageSignature");
  expect(control).toBeDisabled();
  expect(control).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(control);
  expect(localStorage.getItem("signOption")).toBe("false");
  expect(api.post).not.toHaveBeenCalled();

  await waitFor(() => expect(field()).toHaveValue("Fictitious text"));
  fireEvent.click(screen.getByRole("button", { name: "sendMessage" }));
  expect(api.post).toHaveBeenCalledWith(
    "/messages/301",
    expect.objectContaining({ body: "Fictitious text" })
  );
});

test("ignores a previous company's policy response and keeps the voluntary signature", async () => {
  let resolvePriorPolicy;
  api.get.mockReturnValueOnce(
    new Promise(resolve => {
      resolvePriorPolicy = resolve;
    })
  );
  const first = { id: 101, companyId: 2, name: "Camila Oliveira" };
  const second = { id: 102, companyId: 3, name: "Rafael Almeida" };
  const view = render(viewForCompany(first));
  expect(
    screen.getByRole("button", { name: "companyMessageSignature.loading" })
  ).toBeDisabled();
  view.rerender(viewForCompany(second));
  const control = await screen.findByRole("button", {
    name: "messagesInput.signMessage"
  });
  expect(control).toBeEnabled();
  expect(control).toHaveAttribute("aria-pressed", "false");
  await act(async () => resolvePriorPolicy({ data: "enabled" }));
  expect(control).toBeEnabled();
  expect(api.get).toHaveBeenCalledTimes(2);

  fireEvent.click(control);
  expect(localStorage.getItem("signOption")).toBe("true");
  fireEvent.change(field(), { target: { value: "Fictitious text" } });
  fireEvent.click(screen.getByRole("button", { name: "sendMessage" }));
  expect(api.post).toHaveBeenCalledWith(
    "/messages/301",
    expect.objectContaining({ body: "*Rafael Almeida:*\nFictitious text" })
  );
});

test.each([
  ["*Camila Oliveira:*\nExisting text", "Existing text"],
  ["*Original heading:*\nExisting text", "*Original heading:*\nExisting text"]
])(
  "unwraps only the current sender's signature on edit: %s",
  async (body, expected) => {
    api.get.mockResolvedValueOnce({ data: "enabled" });
    render(
      viewForCompany(
        { id: 101, companyId: 2, name: "Camila Oliveira" },
        { id: "fictitious-message", body }
      )
    );

    await screen.findByRole("button", {
      name: "companyMessageSignature.required"
    });
    await waitFor(() => expect(field()).toHaveValue(expected));
    fireEvent.click(screen.getByRole("button", { name: "sendMessage" }));
    expect(api.post).toHaveBeenCalledWith(
      "/messages/edit/fictitious-message",
      expect.objectContaining({ body: expected })
    );
  }
);

test("resolving the signature setting preserves text already written in an edit", async () => {
  let resolvePolicy;
  api.get.mockReturnValueOnce(
    new Promise(resolve => (resolvePolicy = resolve))
  );
  render(
    viewForCompany(
      { id: 101, companyId: 2, name: "Camila Oliveira" },
      { id: "fictitious-message", body: "*Camila Oliveira:*\nExisting text" }
    )
  );
  await waitFor(() =>
    expect(field()).toHaveValue("*Camila Oliveira:*\nExisting text")
  );
  fireEvent.change(field(), { target: { value: "New text" } });
  await act(async () => resolvePolicy({ data: "enabled" }));
  expect(field()).toHaveValue("New text");
});

test("a temporary settings failure leaves the normal browser preference available", async () => {
  api.get.mockRejectedValueOnce(new Error("fictitious settings error"));
  render(viewForCompany({ id: 101, companyId: 3, name: "Rafael Almeida" }));

  const control = await screen.findByRole("button", {
    name: "messagesInput.signMessage"
  });
  expect(control).toBeEnabled();
  expect(control).toHaveAttribute("aria-pressed", "false");
});
