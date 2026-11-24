import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
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

const image = name => new File(["ficticio"], name, { type: "image/png" });
const pdf = name => new File(["ficticio"], name, { type: "application/pdf" });

const { createObjectURL, revokeObjectURL } = URL;
let open;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("signOption", "false");
  api.get.mockResolvedValue({ data: "disabled" });
  open = new Set();
  let count = 0;
  URL.createObjectURL = jest.fn(file => {
    count += 1;
    const url = `blob:${count}:${file.name}`;
    open.add(url);
    return url;
  });
  URL.revokeObjectURL = jest.fn(url => open.delete(url));
});

afterAll(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

const attach = (files, mode = "light") => {
  const rendered = render(
    <ThemeProvider theme={createKomunickTheme({ mode })}>
      <ReplyMessageContext.Provider
        value={{ replyingMessage: null, setReplyingMessage: jest.fn() }}
      >
        <MessageInput
          width="md"
          ticket={{ id: 301, status: "open", contactId: 401 }}
        />
      </ReplyMessageContext.Provider>
    </ThemeProvider>
  );
  fireEvent.change(rendered.container.querySelector("#upload-button"), {
    target: { files }
  });
  return rendered;
};

test("an image shows its preview and its name before sending", () => {
  attach([image("foto.png")]);

  expect(screen.getByAltText("foto.png")).toHaveAttribute(
    "src",
    expect.stringMatching(/^blob:.*foto\.png$/)
  );
  expect(screen.getByText("foto.png")).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

test("several files get thumbnails that choose what is shown", () => {
  attach([image("um.png"), image("dois.png"), pdf("guia.pdf")]);

  const second = screen.getByRole("button", { name: "dois.png" });
  expect(second).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(second);
  expect(second).toHaveAttribute("aria-pressed", "true");
  expect(screen.getAllByAltText("dois.png")).toHaveLength(2);
  expect(screen.getByText(/^dois\.png/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "guia.pdf" }));
  expect(screen.getAllByAltText("dois.png")).toHaveLength(1);
});

test("an image the browser cannot draw falls back to the icon", () => {
  attach([image("foto.heic")]);
  fireEvent.error(screen.getByAltText("foto.heic"));

  expect(screen.queryByAltText("foto.heic")).not.toBeInTheDocument();
  expect(screen.getByText("foto.heic")).toBeInTheDocument();
});

test("a document alone keeps only the bar", () => {
  attach([pdf("guia.pdf")]);

  expect(screen.getByText("guia.pdf")).toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test("canceling frees the preview and starts the next one from the first file", () => {
  const { container } = attach([image("um.png"), image("dois.png")]);
  fireEvent.click(screen.getByRole("button", { name: "dois.png" }));
  fireEvent.click(screen.getByLabelText("cancel-upload"));
  expect(open.size).toBe(0);

  fireEvent.change(container.querySelector("#upload-button"), {
    target: { files: [image("tres.png")] }
  });
  expect(screen.getByAltText("tres.png")).toBeInTheDocument();
});

test.each([
  ["light", "#FFFFFF"],
  ["dark", "#22302A"]
])("the send bar follows the %s theme", (mode, color) => {
  attach([image("foto.png")], mode);

  const bar = screen.getByLabelText("send-upload").closest(".MuiPaper-root");
  const rules = Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules))
    .filter(
      rule =>
        /viewMediaInputWrapper/.test(rule.selectorText) &&
        bar.matches(rule.selectorText)
    );
  expect(rules).toHaveLength(1);
  expect(rules[0].cssText).toContain(`background-color: ${color}`);
});
