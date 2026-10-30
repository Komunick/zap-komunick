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

jest.mock("../../services/api", () => ({ post: jest.fn() }));
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

const mount = (
  handleSendMessage = jest.fn().mockResolvedValue(true),
  extra = {}
) =>
  render(
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <AuthContext.Provider
        value={{ user: { id: 7, name: "Pessoa fictícia" } }}
      >
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
