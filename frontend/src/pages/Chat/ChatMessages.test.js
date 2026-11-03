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
import ChatMessages from "./ChatMessages";
import { AuthContext } from "../../context/Auth/AuthContext";
import { createKomunickTheme } from "../../theme/komunick";
import api from "../../services/api";
import MicRecorder from "mic-recorder-to-mp3";

jest.mock("../../services/api", () => ({ post: jest.fn(), head: jest.fn() }));
jest.mock("../../services/config", () => ({
  getBackendURL: () => "https://backend.example.invalid/backend"
}));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../errors/toastError", () => jest.fn());
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

const messagesTree = (
  handleSendMessage = jest.fn().mockResolvedValue(true),
  extra = {}
) => (
  <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
    <AuthContext.Provider value={{ user: { id: 7, name: "Pessoa fictícia" } }}>
      <ChatMessages
        chat={{ id: 101, users: [{ userId: 7, unreads: 0 }] }}
        messages={[]}
        handleSendMessage={handleSendMessage}
        handleLoadMore={jest.fn()}
        scrollToBottomRef={{ current: null }}
        pageInfo={{ hasMore: false }}
        {...extra}
      />
    </AuthContext.Provider>
  </ThemeProvider>
);
const mount = (...args) => render(messagesTree(...args));

const enter = (input, extra = {}) => {
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", ...extra });
  fireEvent.keyUp(input, { key: "Enter", code: "Enter", ...extra });
};

beforeEach(() => {
  jest.clearAllMocks();
  MicRecorder.mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(),
    stop: jest.fn(() => ({
      getMp3: jest
        .fn()
        .mockResolvedValue([
          [],
          new Blob([new Uint8Array(12000)], { type: "audio/mp3" })
        ])
    }))
  }));
  Element.prototype.scrollIntoView = jest.fn();
  HTMLMediaElement.prototype.pause = jest.fn();
  HTMLMediaElement.prototype.load = jest.fn();
  api.head.mockImplementation(url =>
    Promise.resolve({
      headers: {
        "content-type": url.includes("/messages/1/")
          ? "image/png"
          : url.includes("/messages/2/")
            ? "video/mp4"
            : "audio/mpeg",
        "content-disposition": url.includes("download=1")
          ? "attachment"
          : "inline"
      }
    })
  );
});

test("Shift+Enter preserves the draft and does not send", () => {
  const send = jest.fn();
  mount(send);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Primeira linha fictícia" } });
  enter(input, { shiftKey: true });
  expect(send).not.toHaveBeenCalled();
  expect(input).toHaveValue("Primeira linha fictícia");
});

test("a failed send keeps the exact draft for a human retry", async () => {
  const send = jest.fn().mockResolvedValue(false);
  mount(send);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, {
    target: { value: "Rascunho fictício\ncom duas linhas" }
  });
  enter(input);
  expect(send).toHaveBeenCalledWith("Rascunho fictício\ncom duas linhas");
  await waitFor(() =>
    expect(input).toHaveValue("Rascunho fictício\ncom duas linhas")
  );
});

test("pending send blocks another submit and clears only after success", async () => {
  let finish;
  const send = jest.fn(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  mount(send);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "Mensagem fictícia única" } });
  enter(input);
  expect(input).toBeDisabled();
  enter(input);
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => finish(true));
  expect(input).toHaveValue("");
  expect(input).not.toBeDisabled();
});

test("IME confirmation does not submit a message", () => {
  const send = jest.fn();
  mount(send);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, {
    target: { value: "Texto fictício em composição" }
  });
  enter(input, { isComposing: true, keyCode: 229 });
  expect(send).not.toHaveBeenCalled();
  expect(input).toHaveValue("Texto fictício em composição");
});

test("a failed attachment upload preserves the selection for retry", async () => {
  api.post.mockRejectedValue(new Error("fixture-upload-error"));
  mount();
  const attachment = new File(["dados fictícios"], "exemplo-ficticio.txt", {
    type: "text/plain"
  });
  fireEvent.change(
    screen.getByLabelText("chatPage.attachFiles", { selector: "input" }),
    {
      target: { files: [attachment] }
    }
  );
  fireEvent.click(
    screen.getByRole("button", { name: /send-upload|chatPage.sendFiles/ })
  );
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(await screen.findByText("exemplo-ficticio.txt")).toBeInTheDocument();
});

test("history failure has an inline retry without disabling the composer", () => {
  const retry = jest.fn();
  mount(jest.fn(), { historyError: true, handleRetryMessages: retry });
  expect(screen.getByRole("textbox")).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "chatPage.retry" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test("one audio conversion and upload owns the composer until confirmation", async () => {
  let finishConversion, finishPost;
  api.post.mockImplementation(
    () =>
      new Promise(resolve => {
        finishPost = resolve;
      })
  );
  mount();
  const recorder = MicRecorder.mock.results[0].value;
  recorder.stop.mockReturnValue({
    getMp3: () =>
      new Promise(resolve => {
        finishConversion = resolve;
      })
  });
  fireEvent.click(screen.getByRole("button", { name: "chatPage.recordAudio" }));
  const send = await screen.findByRole("button", {
    name: "chatPage.sendRecording"
  });
  fireEvent.click(send);
  fireEvent.click(send);
  expect(recorder.stop).toHaveBeenCalledTimes(1);
  expect(api.post).not.toHaveBeenCalled();
  await act(async () =>
    finishConversion([
      [],
      new Blob([new Uint8Array(12000)], { type: "audio/mp3" })
    ])
  );
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(send).toBeDisabled();
  await act(async () => finishPost({ data: {} }));
  expect(screen.getByRole("textbox")).not.toBeDisabled();
});

test("leaving during audio conversion never starts an orphan upload", async () => {
  let finish;
  const { unmount } = mount();
  const recorder = MicRecorder.mock.results[0].value;
  recorder.stop.mockReturnValue({
    getMp3: () =>
      new Promise(resolve => {
        finish = resolve;
      })
  });
  fireEvent.click(screen.getByRole("button", { name: "chatPage.recordAudio" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "chatPage.sendRecording" })
  );
  unmount();
  await act(async () =>
    finish([[], new Blob([new Uint8Array(12000)], { type: "audio/mp3" })])
  );
  expect(api.post).not.toHaveBeenCalled();
});

test("leaving while microphone permission is pending stops that recorder on completion", async () => {
  let finish;
  const { unmount } = mount();
  const recorder = MicRecorder.mock.results[0].value;
  recorder.start.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByRole("button", { name: "chatPage.recordAudio" }));
  unmount();
  await act(async () => finish());
  expect(recorder.stop).toHaveBeenCalledTimes(1);
  expect(api.post).not.toHaveBeenCalled();
});

test("leaving an active recording releases only its owned recorder", async () => {
  const { unmount } = mount();
  const recorder = MicRecorder.mock.results[0].value;
  fireEvent.click(screen.getByRole("button", { name: "chatPage.recordAudio" }));
  await screen.findByRole("button", { name: "chatPage.sendRecording" });
  unmount();
  expect(recorder.stop).toHaveBeenCalledTimes(1);
  expect(api.post).not.toHaveBeenCalled();
});

test("a failed audio upload becomes the same selected file for manual retry", async () => {
  api.post
    .mockRejectedValueOnce(new Error("fixture-audio-upload"))
    .mockResolvedValueOnce({ data: {} });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "chatPage.recordAudio" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "chatPage.sendRecording" })
  );
  await screen.findByText(/audio-\d+\.mp3/);
  const firstFile = api.post.mock.calls[0][1].get("medias");
  expect(firstFile.size).toBe(12000);
  fireEvent.click(screen.getByRole("button", { name: "chatPage.sendFiles" }));
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[1][1].get("medias")).toBe(firstFile);
});

const attachment = (id, mediaType) => ({
  id,
  chatId: 101,
  mediaPath:
    "https://backend.example.invalid/public/legacy-fixture." + mediaType,
  mediaName: "fictional-attachment." + mediaType,
  mediaType,
  message: "fictional-attachment." + mediaType,
  senderId: 7,
  sender: { id: 7, name: "Pessoa fictícia" },
  createdAt: "2026-10-30T12:00:00Z"
});

/* eslint-disable testing-library/no-node-access -- Native audio/video/source nodes have no implicit accessible roles; retain the real nodes to verify disposal after React detaches them. */
const nativeMediaNodes = () => ({
  video: document.querySelector("video"),
  audio: document.querySelector("audio"),
  source: document.querySelector("audio source")
});
/* eslint-enable testing-library/no-node-access */

test("native previews use private identity URLs and session credentials instead of legacy public paths", async () => {
  mount(jest.fn(), {
    messages: [
      attachment(1, "image"),
      attachment(2, "video"),
      attachment(3, "audio")
    ]
  });
  const image = await screen.findByAltText("chatPage.messageImage");
  await waitFor(() => expect(nativeMediaNodes().audio).not.toBeNull());
  const { video, audio, source: audioSource } = nativeMediaNodes();
  for (const [node, id] of [
    [image, 1],
    [video, 2],
    [audio, 3]
  ]) {
    const source = node.tagName === "AUDIO" ? audioSource : node;
    expect(source).toHaveAttribute(
      "src",
      `https://backend.example.invalid/backend/chats/101/messages/${id}/media`
    );
    expect(node).toHaveAttribute("crossorigin", "use-credentials");
  }
});

test("leaving a conversation releases the actual audio and video nodes before their refs disappear", async () => {
  const pause = jest
    .spyOn(HTMLMediaElement.prototype, "pause")
    .mockImplementation(() => {});
  const load = jest
    .spyOn(HTMLMediaElement.prototype, "load")
    .mockImplementation(() => {});
  const { unmount } = mount(jest.fn(), {
    messages: [
      attachment(1, "image"),
      attachment(2, "video"),
      attachment(3, "audio")
    ]
  });
  const image = await screen.findByAltText("chatPage.messageImage");
  await waitFor(() => expect(nativeMediaNodes().audio).not.toBeNull());
  const { video, source } = nativeMediaNodes();
  try {
    unmount();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(2);
    expect(video).not.toHaveAttribute("src");
    expect(source).not.toHaveAttribute("src");
    expect(image).not.toHaveAttribute("src");
  } finally {
    pause.mockRestore();
    load.mockRestore();
  }
});

test("a denied download preflight closes its pending destination and never opens a public fallback", async () => {
  api.head.mockRejectedValue({ response: { status: 404 } });
  const destination = {
    close: jest.fn(),
    location: { replace: jest.fn() },
    opener: {}
  };
  const open = jest.spyOn(window, "open").mockReturnValue(destination);
  mount(jest.fn(), { messages: [attachment(4, "application")] });
  const button =
    screen.queryByRole("button", { name: "chatPage.download" }) ||
    screen.getByRole("link", { name: "chatPage.download" });
  // Keep the old anchor from navigating JSDOM; the assertion concerns its lack
  // of an authenticated preflight, not the test environment's navigation.
  button.addEventListener("click", event => event.preventDefault());
  try {
    fireEvent.click(button);
    await waitFor(() =>
      expect(api.head).toHaveBeenCalledWith(
        "/chats/101/messages/4/media?download=1",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "attachments.access"
    );
    expect(destination.close).toHaveBeenCalledTimes(1);
    expect(destination.location.replace).not.toHaveBeenCalled();
    expect(
      open.mock.calls.every(args => !String(args[0]).includes("/public/"))
    ).toBe(true);
  } finally {
    open.mockRestore();
  }
});

test("a native preview error has an access message and no public fallback", async () => {
  mount(jest.fn(), {
    messages: [attachment(2, "video")]
  });
  await waitFor(() => expect(nativeMediaNodes().video).not.toBeNull());
  fireEvent.error(nativeMediaNodes().video);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "attachments.access"
  );
  expect(
    screen
      .queryAllByRole("link")
      .some(link => link.getAttribute("href")?.includes("/public/"))
  ).toBe(false);
});

test("an authorized HEAD starts a native private download without claiming the subsequent GET is preauthorized", async () => {
  api.head.mockResolvedValue({ status: 200 });
  const destination = {
    close: jest.fn(),
    location: { replace: jest.fn() },
    opener: {}
  };
  const open = jest.spyOn(window, "open").mockReturnValue(destination);
  mount(jest.fn(), { messages: [attachment(4, "application")] });
  try {
    fireEvent.click(screen.getByRole("button", { name: "chatPage.download" }));
    await waitFor(() =>
      expect(destination.location.replace).toHaveBeenCalledWith(
        "https://backend.example.invalid/backend/chats/101/messages/4/media?download=1"
      )
    );
    expect(destination.opener).toBeNull();
    expect(destination.close).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally {
    open.mockRestore();
  }
});

test("leaving during a download preflight cancels it and discards its late authorization", async () => {
  let finish;
  api.head.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const destination = {
    close: jest.fn(),
    location: { replace: jest.fn() },
    opener: {}
  };
  const open = jest.spyOn(window, "open").mockReturnValue(destination);
  const view = mount(jest.fn(), { messages: [attachment(4, "application")] });
  try {
    fireEvent.click(screen.getByRole("button", { name: "chatPage.download" }));
    const signal = api.head.mock.calls[0][1].signal;
    view.unmount();
    await act(async () => finish({ status: 200 }));
    expect(signal.aborted).toBe(true);
    expect(destination.close).toHaveBeenCalledTimes(1);
    expect(destination.location.replace).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
  }
});

test("a blocked native destination gives an actionable error without starting the download", async () => {
  api.head.mockClear();
  const open = jest.spyOn(window, "open").mockReturnValue(null);
  mount(jest.fn(), { messages: [attachment(4, "application")] });
  try {
    fireEvent.click(screen.getByRole("button", { name: "chatPage.download" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "chatPage.downloadBlocked"
    );
    expect(api.head).not.toHaveBeenCalled();
  } finally {
    open.mockRestore();
  }
});

test.each([
  {
    mime: "application/octet-stream",
    disposition: "attachment",
    label: "active or unknown bytes"
  },
  {
    mime: "image/svg+xml",
    disposition: "inline",
    label: "active declared image MIME"
  },
  {
    mime: "image/png",
    disposition: "attachment",
    label: "server forbids inline"
  },
  {
    mime: "image/png",
    disposition: undefined,
    label: "inline policy unavailable"
  }
])(
  "preview HEAD must approve both MIME and inline policy before any native source: $label",
  async ({ mime, disposition }) => {
    api.head.mockResolvedValue({
      headers: { "content-type": mime, "content-disposition": disposition }
    });
    mount(jest.fn(), {
      messages: [
        { ...attachment(1, "image"), mediaName: "misleading-safe-name.png" }
      ]
    });
    await waitFor(() =>
      expect(api.head).toHaveBeenCalledWith(
        "/chats/101/messages/1/media",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
    expect(
      await screen.findByRole("button", { name: "chatPage.download" })
    ).toBeEnabled();
    expect(
      screen.queryByAltText("chatPage.messageImage")
    ).not.toBeInTheDocument();
    expect(nativeMediaNodes().video).toBeNull();
    expect(nativeMediaNodes().audio).toBeNull();
  }
);

test("preview HEAD cancellation discards a late MIME decision after leaving the chat", async () => {
  let finish;
  api.head.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const view = mount(jest.fn(), { messages: [attachment(1, "image")] });
  await waitFor(() =>
    expect(api.head).toHaveBeenCalledWith(
      "/chats/101/messages/1/media",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  );
  const signal = api.head.mock.calls[0][1].signal;
  view.unmount();
  await act(async () =>
    finish({
      headers: { "content-type": "image/png", "content-disposition": "inline" }
    })
  );
  expect(signal.aborted).toBe(true);
  expect(
    screen.queryByAltText("chatPage.messageImage")
  ).not.toBeInTheDocument();
});

test("preview HEAD decides the native kind and audio type rather than the legacy prefix", async () => {
  api.head.mockResolvedValue({
    headers: { "content-type": "audio/mpeg", "content-disposition": "inline" }
  });
  mount(jest.fn(), { messages: [attachment(3, "image")] });
  await waitFor(() =>
    expect(api.head).toHaveBeenCalledWith(
      "/chats/101/messages/3/media",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  );
  await waitFor(() => expect(nativeMediaNodes().audio).not.toBeNull());
  expect(nativeMediaNodes().source).toHaveAttribute("type", "audio/mpeg");
  expect(
    screen.queryByAltText("chatPage.messageImage")
  ).not.toBeInTheDocument();
});

test("a denied preview HEAD reports access failure without assigning a native source", async () => {
  api.head.mockRejectedValue({ response: { status: 404 } });
  mount(jest.fn(), { messages: [attachment(1, "image")] });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "attachments.access"
  );
  expect(
    screen.queryByAltText("chatPage.messageImage")
  ).not.toBeInTheDocument();
  expect(nativeMediaNodes().video).toBeNull();
});

test("preview HEAD survives unrelated incoming text while the same attachment remains", async () => {
  let finish;
  const pending = new Promise(resolve => {
    finish = resolve;
  });
  api.head.mockReturnValue(pending);
  const image = attachment(1, "image");
  const send = jest.fn();
  const view = mount(send, { messages: [image] });
  await waitFor(() => expect(api.head).toHaveBeenCalledTimes(1));
  const signal = api.head.mock.calls[0][1].signal;
  view.rerender(
    messagesTree(send, {
      messages: [
        image,
        {
          id: 8,
          chatId: 101,
          senderId: 7,
          message: "Texto novo sem alterar o anexo",
          sender: { id: 7, name: "Pessoa fictícia" },
          createdAt: "2026-10-30T12:01:00Z"
        }
      ]
    })
  );
  expect(signal.aborted).toBe(false);
  expect(api.head).toHaveBeenCalledTimes(1);
  await act(async () =>
    finish({
      headers: {
        "content-type": "image/png",
        "content-disposition": "inline"
      }
    })
  );
  expect(await screen.findByAltText("chatPage.messageImage")).toHaveAttribute(
    "src",
    "https://backend.example.invalid/backend/chats/101/messages/1/media"
  );
  expect(
    screen.getByText("Texto novo sem alterar o anexo")
  ).toBeInTheDocument();
});
