import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import Compressor from "compressorjs";
import { toast } from "react-toastify";
import MessageInput from "./index";
import { createKomunickTheme } from "../../theme/komunick";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";

// Zap Komunick: sending several files at once from a ticket. The composer
// used to post after a fixed 2 seconds, with whatever was compressed by then.

jest.mock("../IntegratedAssistant", () => () => null);
jest.mock("../TicketAssistant", () => () => null);
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, options) =>
      key === "messagesInput.sendStopped"
        ? `${key} ${options.sent}/${options.total} ${options.name}`
        : key
  }
}));
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
const photo = name => new File(["foto ficticia"], name, { type: "image/jpeg" });
const pdf = name =>
  new File(["%PDF-1.4 ficticio"], name, { type: "application/pdf" });

const { createObjectURL, revokeObjectURL } = URL;

// Every photo takes this long to compress: more than the 2 seconds the
// composer used to wait.
const COMPRESSION_MS = 3000;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  localStorage.setItem("signOption", "false");
  api.get.mockResolvedValue({ data: "disabled" });
  api.post.mockResolvedValue({});
  URL.createObjectURL = jest.fn(file => `blob:${file.name}`);
  URL.revokeObjectURL = jest.fn();
  Compressor.mockImplementation((file, options) => {
    setTimeout(
      () =>
        options.success(new File(["menor"], file.name, { type: "image/jpeg" })),
      COMPRESSION_MS
    );
  });
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

const view = ticket => (
  <ThemeProvider theme={theme}>
    <ReplyMessageContext.Provider
      value={{ replyingMessage: null, setReplyingMessage: jest.fn() }}
    >
      <MessageInput
        width="md"
        ticket={{ id: 301, status: "open", contactId: 401, ...ticket }}
      />
    </ReplyMessageContext.Provider>
  </ThemeProvider>
);

const attach = files => {
  const rendered = render(view());
  fireEvent.change(rendered.container.querySelector("#upload-button"), {
    target: { files }
  });
  return rendered;
};

// Lets time pass, one second at a time, with the promises in between.
const wait = async ms => {
  for (let passed = 0; passed < ms; passed += 1000) {
    await act(async () => {
      jest.advanceTimersByTime(1000);
      for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
    });
  }
};

const requests = () =>
  api.post.mock.calls.map(([url, formData]) => ({
    url,
    medias: formData.getAll("medias").map(file => file.name)
  }));

test("photos that take longer than 2 seconds to compress are all sent, in the order chosen", async () => {
  attach([
    photo("um.jpg"),
    photo("dois.jpg"),
    pdf("guia.pdf"),
    photo("tres.jpg")
  ]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(15000);

  expect(requests()).toEqual([
    { url: "/messages/301", medias: ["um.jpg"] },
    { url: "/messages/301", medias: ["dois.jpg"] },
    { url: "/messages/301", medias: ["guia.pdf"] },
    { url: "/messages/301", medias: ["tres.jpg"] }
  ]);
  // everything went: the composer is back to the text field
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("messagesInput.placeholderOpen")
  ).toBeInTheDocument();
  expect(toastError).not.toHaveBeenCalled();
});

test("nothing is posted before the first photo is ready", async () => {
  attach([photo("um.jpg"), photo("dois.jpg")]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(2000);

  expect(api.post).not.toHaveBeenCalled();
});

test("a second click while the files are on their way does not send them twice", async () => {
  attach([photo("um.jpg"), photo("dois.jpg")]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(1000);
  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(10000);

  expect(requests().map(request => request.medias)).toEqual([
    ["um.jpg"],
    ["dois.jpg"]
  ]);
});

test("when a file fails, it and the ones after it stay selected and the attendant is told which", async () => {
  const failure = { response: { data: { error: "ERR_SENDING_WAPP_MSG" } } };
  api.post.mockResolvedValueOnce({}).mockRejectedValueOnce(failure);
  attach([photo("um.jpg"), photo("dois.jpg"), photo("tres.jpg")]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(15000);

  expect(requests().map(request => request.medias)).toEqual([
    ["um.jpg"],
    ["dois.jpg"]
  ]);
  expect(toastError).toHaveBeenCalledWith(failure);
  expect(toast.warn).toHaveBeenCalledWith(
    "messagesInput.sendStopped 1/3 dois.jpg"
  );
  expect(
    screen.queryByRole("button", { name: "um.jpg" })
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "dois.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "tres.jpg" })).toBeInTheDocument();

  // trying again sends only what was left
  api.post.mockResolvedValue({});
  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(10000);

  expect(requests().map(request => request.medias)).toEqual([
    ["um.jpg"],
    ["dois.jpg"],
    ["dois.jpg"],
    ["tres.jpg"]
  ]);
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
});

test("a single file that fails stays selected, without the list notice", async () => {
  const failure = new Error("Network Error");
  api.post.mockRejectedValueOnce(failure);
  attach([pdf("guia.pdf")]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  await wait(1000);

  expect(toastError).toHaveBeenCalledWith(failure);
  expect(toast.warn).not.toHaveBeenCalled();
  expect(screen.getByText("guia.pdf")).toBeInTheDocument();
  expect(screen.getByLabelText("send-upload")).toBeInTheDocument();
});

test("files left from one ticket do not show up when the composer moves to another", async () => {
  api.post.mockRejectedValue(new Error("Network Error"));
  const rendered = attach([pdf("contrato-do-cliente-a.pdf"), pdf("b.pdf")]);

  fireEvent.click(screen.getByLabelText("send-upload"));
  rendered.rerender(view({ id: 302, contactId: 402 }));
  await wait(2000);

  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe("/messages/301");
  expect(screen.queryByText(/contrato-do-cliente-a/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText("send-upload")).not.toBeInTheDocument();
});

test("pasting several files attaches all of them", async () => {
  render(view());

  fireEvent.paste(
    screen.getByPlaceholderText("messagesInput.placeholderOpen"),
    {
      clipboardData: {
        files: [photo("um.jpg"), photo("dois.jpg"), pdf("guia.pdf")]
      }
    }
  );

  expect(screen.getByRole("button", { name: "um.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "dois.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "guia.pdf" })).toBeInTheDocument();
});
