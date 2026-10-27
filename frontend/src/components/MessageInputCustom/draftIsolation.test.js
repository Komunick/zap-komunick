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
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import api from "../../services/api";

let mockAssistantProps;
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
jest.mock("../../services/api", () => ({ post: jest.fn() }));
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
jest.mock("../../hooks/useLocalStorage", () => ({
  useLocalStorage: () => [false, jest.fn()]
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
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
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
