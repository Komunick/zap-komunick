import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import MessageInput from "./index";
import { createKomunickTheme } from "../../theme/komunick";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import api from "../../services/api";

jest.mock("../IntegratedAssistant", () => () => null);
jest.mock("../TicketAssistant", () => () => null);
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("react-toastify", () => ({ toast: { warn: jest.fn() } }));
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
const pdf = (name = "guia-ficticia.pdf") =>
  new File(["%PDF-1.4 ficticio"], name, { type: "application/pdf" });
const empty = () => new File([], "vazio.pdf", { type: "application/pdf" });

const view = (props = {}) => (
  <ThemeProvider theme={theme}>
    <ReplyMessageContext.Provider
      value={{ replyingMessage: null, setReplyingMessage: jest.fn() }}
    >
      <MessageInput
        width="md"
        ticket={{ id: 301, status: "open", contactId: 401, ...props.ticket }}
        dropRequest={props.dropRequest}
      />
    </ReplyMessageContext.Provider>
  </ThemeProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("signOption", "false");
  api.get.mockResolvedValue({ data: "disabled" });
});

test("a drop puts the files in the composer, ready to send", async () => {
  const rendered = render(view());
  rendered.rerender(
    view({ dropRequest: { id: 1, files: [pdf(), pdf("b.pdf")] } })
  );

  expect(await screen.findByText(/guia-ficticia\.pdf/)).toBeInTheDocument();
  expect(screen.getByText(/messagesInput\.moreFiles/)).toBeInTheDocument();
  expect(screen.getByLabelText("send-upload")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("dropped folders and empty files get the same rejection as the button", async () => {
  const rendered = render(view());
  rendered.rerender(
    view({
      dropRequest: {
        id: 1,
        files: [{ name: "Pasta", isFolder: true }, empty(), pdf()]
      }
    })
  );

  expect(await screen.findByText(/guia-ficticia\.pdf/)).toBeInTheDocument();
  expect(toast.warn).toHaveBeenCalledWith("messagesInput.skippedFiles");
});

test("the attach button skips empty files too", async () => {
  const { container } = render(view());
  const input = container.querySelector("#upload-button");

  fireEvent.change(input, { target: { files: [empty()] } });

  expect(toast.warn).toHaveBeenCalledWith("messagesInput.skippedFiles");
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
});

test("a closed ticket refuses dropped files like the disabled button", async () => {
  const closed = { ticket: { status: "closed" } };
  const rendered = render(view(closed));
  rendered.rerender(
    view({ ...closed, dropRequest: { id: 1, files: [pdf()] } })
  );

  await waitFor(() =>
    expect(toast.warn).toHaveBeenCalledWith("messagesInput.dropUnavailable")
  );
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
});

test("a drop made before the composer existed is ignored", async () => {
  render(view({ dropRequest: { id: 7, files: [pdf()] } }));

  expect(
    await screen.findByPlaceholderText("messagesInput.placeholderOpen")
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
  expect(toast.warn).not.toHaveBeenCalled();
});
