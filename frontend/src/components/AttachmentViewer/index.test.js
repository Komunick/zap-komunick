import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import AttachmentViewer from "./index";
import api from "../../services/api";
import {
  ATTACHMENT_TIMEOUT_MS,
  MAX_ATTACHMENT_BYTES
} from "../../helpers/attachments";
jest.mock("../../services/api", () => ({ get: jest.fn(), head: jest.fn() }));
const mockListeners = new Map();
const originalResizeObserver = window.ResizeObserver;
let mockImageObservers = [];
const loadImage = (image, width = 1200, height = 800) => {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height }
  });
  fireEvent.load(image);
};
const resizeImageViewport = (width, height) => {
  act(() =>
    mockImageObservers[mockImageObservers.length - 1].callback([
      { contentRect: { width, height } }
    ])
  );
};
const mockSocket = {
  on: jest.fn((event, handler) => mockListeners.set(event, handler)),
  off: jest.fn(event => mockListeners.delete(event)),
  disconnect: jest.fn()
};
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({ GetSocket: () => mockSocket })
}));
const emitMessage = data => mockListeners.get("company-10-appMessage")?.(data);
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../PdfAttachmentView", () => ({ blob }) => (
  <div data-testid="pdf">{blob.size}</div>
));
const item = (id = "fixture-image", extra = {}) => ({
  messageId: id,
  sourceTicketId: 301,
  fileName: id + ".png",
  createdAt: "2026-10-27T12:00:00.000Z",
  kind: "image",
  sizeBytes: 4,
  storage: "local",
  previewSupported: true,
  previewReason: "available",
  mimeType: "image/png",
  contentPath: "/unused",
  legacyUrl: "https://invalid.example/fixture.png",
  ...extra
});
const a = item();
const b = item("fixture-second");
const path = row => "/tickets/301/attachments/301/" + row.messageId;
const blob = new Blob(["test"], { type: "image/png" });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const props = extra => ({
  open: true,
  ticketId: 301,
  contextKey: "context-a",
  selection: { ...a, contextKey: "context-a" },
  items: [a, b],
  onSelect: jest.fn(),
  onClose: jest.fn(),
  ...extra
});
const button = key =>
  screen.getByRole("button", { name: "attachments." + key, exact: true });
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  mockListeners.clear();
  mockImageObservers = [];
  window.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      mockImageObservers.push(this);
    }
  };
  mockSocket.on.mockImplementation((event, handler) =>
    mockListeners.set(event, handler)
  );
  mockSocket.off.mockImplementation(event => mockListeners.delete(event));
  localStorage.setItem("companyId", "10");
  URL.createObjectURL = jest.fn(() => "blob:fixture-preview");
  URL.revokeObjectURL = jest.fn();
  jest.spyOn(window, "open").mockImplementation(() => null);
  api.head.mockResolvedValue({ headers: { "content-length": "4" } });
  api.get.mockImplementation(async url => ({
    data: url.endsWith("/content") ? blob : url.endsWith(b.messageId) ? b : a
  }));
});
afterEach(() => {
  window.ResizeObserver = originalResizeObserver;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
test("reauthorizes metadata and bounded authenticated bytes before displaying, then revokes on close", async () => {
  const view = render(<AttachmentViewer {...props()} />);
  const image = await screen.findByRole("img", { name: a.fileName });
  expect(image).toHaveAttribute("src", "blob:fixture-preview");
  expect(api.get).toHaveBeenNthCalledWith(
    1,
    path(a),
    expect.objectContaining({
      signal: expect.anything(),
      timeout: ATTACHMENT_TIMEOUT_MS
    })
  );
  expect(api.head).toHaveBeenCalledWith(
    path(a) + "/content",
    expect.objectContaining({ signal: expect.anything() })
  );
  expect(api.get).toHaveBeenNthCalledWith(
    2,
    path(a) + "/content",
    expect.objectContaining({ responseType: "blob" })
  );
  loadImage(image);
  resizeImageViewport(600, 400);
  fireEvent.click(button("zoomIn"));
  fireEvent.click(button("rotateRight"));
  expect(image.style.transform).toBe(
    "translate(-50%, -50%) rotate(90deg) scale(1.25)"
  );
  view.rerender(<AttachmentViewer {...props({ open: false })} />);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-preview");
  expect(window.open).not.toHaveBeenCalled();
});
test.each([401, 403, 404])(
  "denial %s never requests bytes or falls back to a public original",
  async status => {
    api.get.mockRejectedValue({ response: { status } });
    render(<AttachmentViewer {...props()} />);
    await screen.findByText("attachments.access");
    expect(api.head).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    expect(
      screen.queryByText("attachments.openOriginal")
    ).not.toBeInTheDocument();
  }
);
test("canceling metadata prevents a late response from starting a byte request", async () => {
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  const view = render(<AttachmentViewer {...props()} />);
  const signal = api.get.mock.calls[0][1].signal;
  view.rerender(<AttachmentViewer {...props({ open: false })} />);
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: a }));
  expect(api.head).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test("late bytes cannot appear after ticket/context invalidation", async () => {
  const pending = deferred();
  api.get.mockImplementation(async url =>
    url.endsWith("/content") ? pending.promise : { data: a }
  );
  const view = render(<AttachmentViewer {...props()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  view.rerender(
    <AttachmentViewer {...props({ ticketId: 302, contextKey: "context-b" })} />
  );
  await act(async () => pending.resolve({ data: blob }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test("navigation removes the old preview and releases its URL before the next file", async () => {
  const p = props();
  const view = render(<AttachmentViewer {...p} />);
  await screen.findByRole("img", { name: a.fileName });
  fireEvent.click(button("next"));
  expect(p.onSelect).toHaveBeenCalledWith(b);
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  view.rerender(
    <AttachmentViewer {...p} selection={{ ...b, contextKey: "context-a" }} />
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-preview");
  view.unmount();
});
test("oversized HEAD is rejected before content GET", async () => {
  api.head.mockResolvedValue({
    headers: { "content-length": String(MAX_ATTACHMENT_BYTES + 1) }
  });
  render(<AttachmentViewer {...props()} />);
  await screen.findByText("attachments.tooLarge");
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(window.open).not.toHaveBeenCalled();
});
test("oversized streamed content is aborted without creating an object URL", async () => {
  api.get.mockImplementation(async (url, config) => {
    if (!url.endsWith("/content")) return { data: a };
    config.onDownloadProgress({ loaded: MAX_ATTACHMENT_BYTES + 1 });
    return new Promise(() => {});
  });
  render(<AttachmentViewer {...props()} />);
  await screen.findByText("attachments.tooLarge");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
test("timeout aborts a pending request without original fallback", async () => {
  jest.useFakeTimers();
  api.get.mockReturnValue(new Promise(() => {}));
  const view = render(<AttachmentViewer {...props()} />);
  await act(async () => jest.advanceTimersByTime(ATTACHMENT_TIMEOUT_MS + 1));
  expect(screen.getByText("attachments.timeout")).toBeInTheDocument();
  expect(api.get.mock.calls[0][1].signal.aborted).toBe(true);
  expect(window.open).not.toHaveBeenCalled();
  view.unmount();
});
test("external/original action is explicit and reauthorizes; a later denial clears the action", async () => {
  const external = item("fixture-external", {
    storage: "external",
    previewSupported: false,
    previewReason: "external",
    contentPath: null
  });
  api.get
    .mockResolvedValueOnce({ data: external })
    .mockRejectedValueOnce({ response: { status: 403 } });
  render(
    <AttachmentViewer
      {...props({
        selection: { ...external, contextKey: "context-a" },
        items: [external]
      })}
    />
  );
  await screen.findByText("attachments.reason.external");
  expect(window.open).not.toHaveBeenCalled();
  expect(api.head).not.toHaveBeenCalled();
  fireEvent.click(button("openOriginal"));
  await screen.findByText("attachments.access");
  expect(window.open).not.toHaveBeenCalled();
  expect(
    screen.queryByText("attachments.openOriginal")
  ).not.toBeInTheDocument();
});
test("only an explicit fresh authorized action opens the original", async () => {
  const external = item("fixture-external", {
    storage: "external",
    previewSupported: false,
    previewReason: "external",
    contentPath: null
  });
  api.get.mockResolvedValue({ data: external });
  render(
    <AttachmentViewer
      {...props({
        selection: { ...external, contextKey: "context-a" },
        items: [external]
      })}
    />
  );
  await screen.findByText("attachments.reason.external");
  fireEvent.click(button("openOriginal"));
  await waitFor(() =>
    expect(window.open).toHaveBeenCalledWith(
      external.legacyUrl,
      "_blank",
      "noopener,noreferrer"
    )
  );
  expect(api.get).toHaveBeenCalledTimes(2);
});
test("download uses only the authorized Blob and filename", async () => {
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function () {
      expect(this.href).toBe("blob:fixture-preview");
      expect(this.download).toBe(a.fileName);
    });
  render(<AttachmentViewer {...props()} />);
  await screen.findByRole("img");
  fireEvent.click(button("download"));
  expect(click).toHaveBeenCalledTimes(1);
  expect(window.open).not.toHaveBeenCalled();
});
test("video has native controls, no autoplay, and reports codec errors", async () => {
  const video = item("fixture-video", { kind: "video", mimeType: "video/mp4" });
  api.get.mockImplementation(async url => ({
    data: url.endsWith("/content")
      ? new Blob(["test"], { type: "video/mp4" })
      : video
  }));
  render(
    <AttachmentViewer
      {...props({
        selection: { ...video, contextKey: "context-a" },
        items: [video]
      })}
    />
  );
  const element = await screen.findByLabelText(video.fileName, {
    selector: "video"
  });
  expect(element).toHaveAttribute("controls");
  expect(element).toHaveAttribute("playsinline");
  expect(element).not.toHaveAttribute("autoplay");
  fireEvent.error(element);
  expect(screen.getByText("attachments.codec")).toBeInTheDocument();
});

test("only a matching source/message update invalidates an already loaded preview and revokes its URL", async () => {
  const p = props();
  render(<AttachmentViewer {...p} />);
  await screen.findByRole("img", { name: a.fileName });
  act(() =>
    emitMessage({
      action: "update",
      message: { id: a.messageId, ticketId: 302, isDeleted: true }
    })
  );
  act(() =>
    emitMessage({
      action: "update",
      message: { id: b.messageId, ticketId: 301, isDeleted: true }
    })
  );
  expect(p.onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("img", { name: a.fileName })).toBeInTheDocument();
  act(() =>
    emitMessage({
      action: "update",
      message: { id: a.messageId, ticketId: 301, isDeleted: true }
    })
  );
  expect(p.onClose).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-preview")
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("selected message invalidation aborts pending bytes and ignores their late response", async () => {
  const pending = deferred();
  api.get.mockImplementation(async url =>
    url.endsWith("/content") ? pending.promise : { data: a }
  );
  const p = props();
  render(<AttachmentViewer {...p} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  const signal = api.get.mock.calls[1][1].signal;
  act(() =>
    emitMessage({
      action: "delete",
      message: { id: a.messageId, ticketId: 301 }
    })
  );
  expect(p.onClose).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: blob }));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("loaded image dimensions and viewport resize reserve the full positive rotated stage", async () => {
  const view = render(<AttachmentViewer {...props()} />);
  const image = await screen.findByRole("img", { name: a.fileName });
  const stage = screen.getByTestId("attachment-image-stage");
  loadImage(image);
  resizeImageViewport(600, 400);
  expect(stage).toHaveStyle({ width: "600px", height: "400px" });
  expect(image).toHaveStyle({ width: "600px", height: "400px" });
  fireEvent.click(button("rotateRight"));
  expect(stage).toHaveStyle({ width: "267px", height: "400px" });
  resizeImageViewport(300, 200);
  expect(stage).toHaveStyle({ width: "134px", height: "200px" });
  fireEvent.click(button("zoomIn"));
  expect(stage).toHaveStyle({ width: "167px", height: "250px" });
  const observer = mockImageObservers[0];
  view.unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-preview");
});
test("without ResizeObserver, resize fallback works and invalid natural sizes remain safe", async () => {
  window.ResizeObserver = undefined;
  let width = 632;
  let height = 432;
  jest
    .spyOn(HTMLElement.prototype, "clientWidth", "get")
    .mockImplementation(() => width);
  jest
    .spyOn(HTMLElement.prototype, "clientHeight", "get")
    .mockImplementation(() => height);
  const removed = jest.spyOn(window, "removeEventListener");
  const view = render(<AttachmentViewer {...props()} />);
  const image = await screen.findByRole("img", { name: a.fileName });
  const stage = screen.getByTestId("attachment-image-stage");
  loadImage(image, 0, 0);
  expect(stage.style.width).toBe("");
  loadImage(image);
  expect(stage).toHaveStyle({ width: "600px", height: "400px" });
  width = 332;
  height = 232;
  fireEvent(window, new Event("resize"));
  expect(stage).toHaveStyle({ width: "300px", height: "200px" });
  view.unmount();
  expect(removed).toHaveBeenCalledWith("resize", expect.any(Function));
});

test("closing the video viewer pauses, removes src and releases the decoder before close", async () => {
  const video = item("fixture-video", { kind: "video", mimeType: "video/mp4" });
  api.get.mockImplementation(async url => ({
    data: url.endsWith("/content")
      ? new Blob(["test"], { type: "video/mp4" })
      : video
  }));
  const p = props({
    selection: { ...video, contextKey: "context-a" },
    items: [video]
  });
  render(<AttachmentViewer {...p} />);
  const element = await screen.findByLabelText(video.fileName, {
    selector: "video"
  });
  fireEvent.click(button("closeViewer"));
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  expect(element).not.toHaveAttribute("src");
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
  expect(p.onClose).toHaveBeenCalledTimes(1);
});
test("selection changes pause and release the captured video before its Blob URL is revoked", async () => {
  const first = item("fixture-video-a", {
    kind: "video",
    mimeType: "video/mp4"
  });
  const second = item("fixture-video-b", {
    kind: "video",
    mimeType: "video/mp4"
  });
  api.get.mockImplementation(async url => ({
    data: url.endsWith("/content")
      ? new Blob(["test"], { type: "video/mp4" })
      : url.endsWith(first.messageId)
        ? first
        : second
  }));
  const p = props({
    selection: { ...first, contextKey: "context-a" },
    items: [first, second]
  });
  const view = render(<AttachmentViewer {...p} />);
  const original = await screen.findByLabelText(first.fileName, {
    selector: "video"
  });
  view.rerender(
    <AttachmentViewer
      {...p}
      selection={{ ...second, contextKey: "context-a" }}
    />
  );
  await screen.findByLabelText(second.fileName, { selector: "video" });
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  expect(HTMLMediaElement.prototype.pause.mock.instances[0]).toBe(original);
  expect(original).not.toHaveAttribute("src");
  expect(
    HTMLMediaElement.prototype.pause.mock.invocationCallOrder[0]
  ).toBeLessThan(URL.revokeObjectURL.mock.invocationCallOrder[0]);
  expect(
    HTMLMediaElement.prototype.load.mock.invocationCallOrder[0]
  ).toBeLessThan(URL.revokeObjectURL.mock.invocationCallOrder[0]);
  view.unmount();
  expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);
});
