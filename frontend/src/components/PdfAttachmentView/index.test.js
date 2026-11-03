import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import PdfAttachmentView from "./index";

jest.mock("pdfjs-dist", () => ({
  getDocument: jest.fn(),
  GlobalWorkerOptions: {}
}));
jest.mock("pdfjs-dist/build/pdf.worker.entry", () => "fixture-local-worker");
jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, values) =>
      key === "attachments.pdf.pageCount"
        ? `Página ${values.page} de ${values.count}`
        : key
  }
}));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const bytes = () => new Uint8Array([37, 80, 68, 70, 45, 102, 105, 120]).buffer;
const fixtureBlob = pending => {
  const blob = new Blob(["fictitious PDF"], { type: "application/pdf" });
  Object.defineProperty(blob, "arrayBuffer", {
    value: jest.fn(() => pending || Promise.resolve(bytes()))
  });
  return blob;
};
function fixturePdf({ width = 600, height = 800 } = {}) {
  const renders = [];
  const pages = [1, 2].map(() => ({
    getViewport: jest.fn(({ scale }) => ({
      width: width * scale,
      height: height * scale
    })),
    cleanup: jest.fn(),
    render: jest.fn(() => {
      const task = { promise: Promise.resolve(), cancel: jest.fn() };
      renders.push(task);
      return task;
    })
  }));
  const pdf = {
    numPages: 2,
    getPage: jest.fn(number => Promise.resolve(pages[number - 1])),
    destroy: jest.fn(() => Promise.resolve())
  };
  const task = {
    promise: Promise.resolve(pdf),
    destroy: jest.fn(() => Promise.resolve())
  };
  return { pdf, pages, task, renders };
}
const button = name =>
  screen.getByRole("button", { name: `attachments.pdf.${name}`, exact: true });
const pageInput = () =>
  screen.getByRole("textbox", { name: "attachments.pdf.page" });
const visiblePage = number =>
  screen.findByRole("img", { name: `Fixture.pdf Página ${number} de 2` });
let pdfFixture;
let measuredWidth;
let observer;
let originalResizeObserver;
let originalDpr;

beforeEach(() => {
  jest.clearAllMocks();
  measuredWidth = 640;
  originalResizeObserver = global.ResizeObserver;
  originalDpr = window.devicePixelRatio;
  global.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      observer = this;
    }
  };
  jest
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockImplementation(() => ({
      width: measuredWidth,
      height: 800,
      top: 0,
      left: 0,
      right: measuredWidth,
      bottom: 800
    }));
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({});
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 1
  });
  pdfFixture = fixturePdf();
  getDocument.mockReturnValue(pdfFixture.task);
});
afterEach(() => {
  jest.restoreAllMocks();
  global.ResizeObserver = originalResizeObserver;
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: originalDpr
  });
});

test("uses local worker and byte data with eval, XFA, worker fetching and annotations disabled", async () => {
  const { container } = render(
    <PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />
  );
  await visiblePage(1);
  expect(GlobalWorkerOptions.workerSrc).toBe("fixture-local-worker");
  const options = getDocument.mock.calls[0][0];
  expect(options).toMatchObject({
    isEvalSupported: false,
    enableXfa: false,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    verbosity: 0,
    maxImageSize: 32000000,
    stopAtErrors: true
  });
  expect(options.data).toBeInstanceOf(Uint8Array);
  expect(Array.from(options.data)).toEqual(Array.from(new Uint8Array(bytes())));
  expect(options).not.toHaveProperty("url");
  expect(pdfFixture.pages[0].render).toHaveBeenCalledWith(
    expect.objectContaining({ annotationMode: 0 })
  );
  expect(
    // These forbidden elements need no accessible role or visible content.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    container.querySelector("iframe, object, embed, a, script")
  ).toBeNull();
});

test("navigates two pages and rejects invalid page input without requesting an invalid page", async () => {
  render(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  await visiblePage(1);
  expect(button("previous")).toBeDisabled();
  for (const invalid of [
    "0",
    "3",
    "-1",
    "2.5",
    "1e2",
    "",
    "abc",
    "99999999999999999999"
  ]) {
    fireEvent.change(pageInput(), { target: { value: invalid } });
    fireEvent.blur(pageInput());
    expect(pageInput()).toHaveValue("1");
  }
  expect(pdfFixture.pdf.getPage).toHaveBeenCalledTimes(1);
  fireEvent.change(pageInput(), { target: { value: "2" } });
  fireEvent.keyDown(pageInput(), { key: "Enter" });
  await visiblePage(2);
  expect(button("next")).toBeDisabled();
  expect(pdfFixture.pdf.getPage.mock.calls.map(call => call[0])).toEqual([
    1, 2
  ]);
  fireEvent.click(button("previous"));
  await visiblePage(1);
  fireEvent.click(button("next"));
  await visiblePage(2);
});

test("fits changing container width and bounds zoom at three", async () => {
  render(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  let canvas = await visiblePage(1);
  expect(parseFloat(canvas.style.width)).toBe(608);
  measuredWidth = 336;
  act(() => observer.callback());
  await waitFor(() => expect(parseFloat(canvas.style.width)).toBe(304));
  for (let iteration = 0; iteration < 12; iteration += 1) {
    fireEvent.click(button("zoomIn"));
    canvas = await visiblePage(1);
  }
  await waitFor(() => expect(button("zoomIn")).toBeDisabled());
  expect(screen.getByText("300%")).toBeInTheDocument();
  expect(parseFloat(canvas.style.width)).toBe(1800);
  fireEvent.click(button("fit"));
  await waitFor(() => expect(parseFloat(canvas.style.width)).toBe(304));
});

test("limits pathological page dimensions and high DPR to eight million backing pixels", async () => {
  pdfFixture = fixturePdf({ width: 20000, height: 10000 });
  getDocument.mockReturnValue(pdfFixture.task);
  Object.defineProperty(window, "devicePixelRatio", {
    configurable: true,
    value: 20
  });
  render(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  const canvas = await visiblePage(1);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(8000000);
  expect(canvas.width).toBeLessThanOrEqual(8192);
  expect(canvas.height).toBeLessThanOrEqual(8192);
  const args = pdfFixture.pages[0].render.mock.calls[0][0];
  expect(args.transform[0]).toBeLessThanOrEqual(2);
  fireEvent.click(button("zoomIn"));
  await visiblePage(1);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(8000000);
});

test("reports corrupted and password-protected PDFs without displaying parser details", async () => {
  const secretError = new Error("PRIVATE_PDF_CONTENT_FIXTURE");
  getDocument.mockReturnValueOnce({
    promise: Promise.reject(secretError),
    destroy: jest.fn()
  });
  const { rerender } = render(
    <PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "attachments.pdf.failed"
  );
  expect(screen.queryByText(secretError.message)).not.toBeInTheDocument();
  const pending = deferred();
  const task = {
    promise: pending.promise,
    destroy: jest.fn(() => Promise.resolve())
  };
  getDocument.mockReturnValueOnce(task);
  rerender(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  await waitFor(() => expect(typeof task.onPassword).toBe("function"));
  await act(async () => {
    task.onPassword(jest.fn(), 1);
    pending.reject(secretError);
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "attachments.pdf.password"
  );
  expect(task.destroy).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(secretError.message)).not.toBeInTheDocument();
});

test("cancels an in-flight page before navigating and destroys the document on unmount", async () => {
  const pending = deferred();
  const activeRender = { promise: pending.promise, cancel: jest.fn() };
  pdfFixture.pages[0].render.mockReturnValueOnce(activeRender);
  const { unmount } = render(
    <PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />
  );
  await waitFor(() => expect(pdfFixture.pages[0].render).toHaveBeenCalled());
  fireEvent.click(button("next"));
  await visiblePage(2);
  expect(activeRender.cancel).toHaveBeenCalledTimes(1);
  expect(pdfFixture.pages[0].cleanup).toHaveBeenCalled();
  await act(async () => pending.resolve());
  expect(
    screen.getByRole("img", { name: "Fixture.pdf Página 2 de 2" })
  ).toBeVisible();
  unmount();
  expect(pdfFixture.renders[0].cancel).toHaveBeenCalledTimes(1);
  expect(pdfFixture.pdf.destroy).toHaveBeenCalledTimes(1);
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

test("ignores a late Blob read after changing the selected attachment", async () => {
  const pending = deferred();
  const { rerender } = render(
    <PdfAttachmentView blob={fixtureBlob(pending.promise)} fileName="Old.pdf" />
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "attachments.pdf.loading"
  );
  expect(getDocument).not.toHaveBeenCalled();
  rerender(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  await visiblePage(1);
  await act(async () => pending.resolve(bytes()));
  expect(getDocument).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("img", { name: /Old.pdf/ })
  ).not.toBeInTheDocument();
});

test("destroys a late PDF proxy from a replaced loading task without rendering it", async () => {
  const pending = deferred();
  const oldPdf = fixturePdf();
  oldPdf.task.promise = pending.promise;
  getDocument
    .mockReturnValueOnce(oldPdf.task)
    .mockReturnValueOnce(pdfFixture.task);
  const { rerender } = render(
    <PdfAttachmentView blob={fixtureBlob()} fileName="Old.pdf" />
  );
  await waitFor(() => expect(getDocument).toHaveBeenCalledTimes(1));
  rerender(<PdfAttachmentView blob={fixtureBlob()} fileName="Fixture.pdf" />);
  await visiblePage(1);
  expect(oldPdf.task.destroy).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(oldPdf.pdf));
  expect(oldPdf.pdf.destroy).toHaveBeenCalledTimes(1);
  expect(oldPdf.pdf.getPage).not.toHaveBeenCalled();
});

test("clears the prior canvas immediately on Blob replacement and renders file names as plain labels", async () => {
  const first = fixtureBlob();
  const { container, rerender } = render(
    <PdfAttachmentView blob={first} fileName="Fixture.pdf" />
  );
  const canvas = await visiblePage(1);
  const pending = deferred();
  rerender(
    <PdfAttachmentView
      blob={fixtureBlob(pending.promise)}
      fileName="<script>fixture</script>.pdf"
    />
  );
  expect(canvas).not.toBeVisible();
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
  expect(pdfFixture.pdf.destroy).toHaveBeenCalledTimes(1);
  // A filename must never create a script node, including an inaccessible one.
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  expect(container.querySelector("script")).toBeNull();
  expect(button("next")).toBeDisabled();
});

test("refuses an empty or oversized Blob before handing bytes to the parser", async () => {
  const empty = { size: 0, arrayBuffer: jest.fn() };
  const oversized = { size: 25 * 1024 * 1024 + 1, arrayBuffer: jest.fn() };
  const { rerender } = render(
    <PdfAttachmentView blob={empty} fileName="Fixture.pdf" />
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "attachments.pdf.failed"
  );
  rerender(<PdfAttachmentView blob={oversized} fileName="Fixture.pdf" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "attachments.pdf.failed"
  );
  expect(empty.arrayBuffer).not.toHaveBeenCalled();
  expect(oversized.arrayBuffer).not.toHaveBeenCalled();
  expect(getDocument).not.toHaveBeenCalled();
});
