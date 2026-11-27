import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import MessageInput from "./index";
import { MIN_STAGE } from "../MediaSendPreview";
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

const attach = (files, mode = "light", props = {}) => {
  const rendered = render(
    <ThemeProvider theme={createKomunickTheme({ mode })}>
      <ReplyMessageContext.Provider
        value={{ replyingMessage: null, setReplyingMessage: jest.fn() }}
      >
        <MessageInput
          width="md"
          ticket={{ id: 301, status: "open", contactId: 401 }}
          {...props}
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

// On a low window (the browser zoomed in) the preview pushed the send bar out
// of the screen. The preview now gives way and the bar stays: the layout is
// checked in a real browser; here, the parts it is made of.
describe("the send bar never depends on the size of the preview", () => {
  test("the bar comes after the preview, inside the same composer, with cancel and send", () => {
    attach([image("foto.png")]);

    const composer = screen.getByTestId("media-send-composer");
    const preview = screen.getByTestId("media-send-preview");
    const bar = screen.getByTestId("media-send-bar");
    expect(composer).toContainElement(preview);
    expect(composer).toContainElement(bar);
    expect(
      preview.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(bar).toContainElement(screen.getByLabelText("cancel-upload"));
    expect(bar).toContainElement(screen.getByLabelText("send-upload"));
    // the picture lives in its own area, which is what shrinks
    expect(screen.getByTestId("media-send-stage")).toContainElement(
      screen.getByAltText("foto.png")
    );
  });

  // jsdom lays nothing out; what can be guarded here is that the rules the
  // layout stands on are still in the stylesheet.
  test("the composer and the preview may shrink and scroll, the bar may not", () => {
    attach([image("um.png"), image("dois.png")]);
    const styleOf = (element, name) => {
      const rules = Array.from(document.styleSheets)
        .flatMap(sheet => Array.from(sheet.cssRules))
        .filter(
          rule =>
            rule.selectorText &&
            new RegExp(name).test(rule.selectorText) &&
            element.matches(rule.selectorText)
        );
      expect(rules).toHaveLength(1);
      return rules[0].style;
    };

    const composer = styleOf(
      screen.getByTestId("media-send-composer"),
      "viewMediaInputWrapper"
    );
    // never smaller than the bar and its border, and it may be given less
    // than it would like
    expect(composer.getPropertyValue("min-height")).toBe("69px");
    expect(composer.getPropertyValue("flex")).toBe("0 1 auto");

    const bar = styleOf(screen.getByTestId("media-send-bar"), "viewMediaBar");
    expect(bar.getPropertyValue("flex")).toBe("none");
    expect(bar.getPropertyValue("min-height")).toBe("68px");

    // the preview gives way and scrolls inside itself, never over the bar
    const preview = styleOf(
      screen.getByTestId("media-send-preview"),
      "makeStyles-root"
    );
    expect(preview.getPropertyValue("min-height")).toBe("0");
    expect(preview.getPropertyValue("overflow-y")).toBe("auto");

    const stage = styleOf(
      screen.getByTestId("media-send-stage"),
      "makeStyles-stage"
    );
    expect(stage.getPropertyValue("min-height")).toBe(`${MIN_STAGE}px`);
    expect(stage.getPropertyValue("flex")).toBe("0 1 auto");
  });

  test("a document alone has the bar and no preview to make room for", () => {
    attach([pdf("guia.pdf")]);
    expect(screen.getByTestId("media-send-bar")).toBeInTheDocument();
    expect(screen.queryByTestId("media-send-preview")).not.toBeInTheDocument();
  });

  test("the ticket screen is told when files wait to be sent, and when they no longer do", () => {
    const onMediaPreviewChange = jest.fn();
    const { container, unmount } = attach([image("foto.png")], "light", {
      onMediaPreviewChange
    });
    // nothing waiting when the composer appears, then the file is picked
    expect(onMediaPreviewChange.mock.calls.map(([open]) => open)).toEqual([
      false,
      true
    ]);

    fireEvent.click(screen.getByLabelText("cancel-upload"));
    expect(onMediaPreviewChange).toHaveBeenLastCalledWith(false);

    // the composer goes away with files still waiting (another ticket opens)
    fireEvent.change(container.querySelector("#upload-button"), {
      target: { files: [image("outra.png")] }
    });
    expect(onMediaPreviewChange).toHaveBeenLastCalledWith(true);
    unmount();
    expect(onMediaPreviewChange).toHaveBeenLastCalledWith(false);
  });

  test("works without anyone listening", () => {
    expect(() => attach([image("foto.png")])).not.toThrow();
    expect(screen.getByLabelText("send-upload")).toBeInTheDocument();
  });
});
