import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AttachmentsPanel from "./index";
import api from "../../services/api";
jest.mock("../../services/api", () => ({ get: jest.fn() }));
jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, options) => (options?.name ? key + " " + options.name : key)
  }
}));
jest.mock(
  "../AttachmentViewer",
  () => props =>
    props.open ? (
      <div data-testid="viewer">{props.selection.messageId}</div>
    ) : null
);
const item = (id, kind = "pdf") => ({
  messageId: id,
  sourceTicketId: 301,
  createdAt: "2026-10-27T12:00:00.000Z",
  fileName: id + "." + kind,
  kind,
  sizeBytes: 40,
  storage: "local",
  previewSupported: true,
  previewReason: "available",
  mimeType: kind === "image" ? "image/png" : "application/pdf",
  contentPath: "/unused",
  legacyUrl: null
});
const page = (items, more = false) => ({
  data: { items, hasMore: more, nextCursor: more ? "fixture-cursor" : null }
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const button = key =>
  screen.getByRole("button", { name: "attachments." + key, exact: true });
const panel = extra => (
  <AttachmentsPanel ticketId={301} contextKey="context-a" {...extra} />
);
beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue(page([item("fixture-a")], true));
});
test("loads only on demand, uses server pagination and searches loaded filenames locally", async () => {
  render(panel());
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(button("open"));
  await screen.findByText("fixture-a.pdf");
  expect(api.get).toHaveBeenCalledWith(
    "/tickets/301/attachments",
    expect.objectContaining({ params: { kind: "all", limit: 20 } })
  );
  fireEvent.change(screen.getByLabelText("attachments.search"), {
    target: { value: "missing" }
  });
  expect(screen.getByText("attachments.noMatches")).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("attachments.search"), {
    target: { value: "" }
  });
  api.get.mockResolvedValueOnce(page([item("fixture-b")]));
  fireEvent.click(button("loadMore"));
  await screen.findByText("fixture-b.pdf");
  expect(screen.getByText("fixture-a.pdf")).toBeInTheDocument();
  expect(api.get.mock.calls[1][1].params.cursor).toBe("fixture-cursor");
});
test("changing kind replaces the snapshot; delayed old pages cannot reappear", async () => {
  const pending = deferred();
  api.get
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce(page([item("fixture-image", "image")]));
  render(panel());
  fireEvent.click(button("open"));
  const signal = api.get.mock.calls[0][1].signal;
  fireEvent.change(screen.getByLabelText("attachments.filter"), {
    target: { value: "image" }
  });
  await screen.findByText("fixture-image.image");
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(page([item("fixture-old")])));
  expect(screen.queryByText("fixture-old.pdf")).not.toBeInTheDocument();
  expect(api.get.mock.calls[1][1].params.kind).toBe("image");
});
test("context changes close viewer and list and cancel pending pages", async () => {
  const view = render(panel());
  fireEvent.click(button("open"));
  await screen.findByText("fixture-a.pdf");
  fireEvent.click(
    screen.getByRole("button", { name: "attachments.viewNamed fixture-a.pdf" })
  );
  expect(screen.getByTestId("viewer")).toHaveTextContent("fixture-a");
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  fireEvent.click(button("loadMore"));
  const signal = api.get.mock.calls[1][1].signal;
  view.rerender(panel({ ticketId: 302, contextKey: "context-b" }));
  expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(page([item("fixture-old")])));
  expect(screen.queryByText("fixture-old.pdf")).not.toBeInTheDocument();
});
test("access errors on pagination clear previous files and selected preview", async () => {
  render(panel());
  fireEvent.click(button("open"));
  await screen.findByText("fixture-a.pdf");
  api.get.mockRejectedValueOnce({ response: { status: 403 } });
  fireEvent.click(button("loadMore"));
  await screen.findByText("attachments.access");
  expect(screen.queryByText("fixture-a.pdf")).not.toBeInTheDocument();
});
test("invalid IDs never expose an opener or make a request", () => {
  render(panel({ ticketId: undefined }));
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

test("contradictory preview metadata is rejected instead of displayed", async () => {
  api.get.mockResolvedValueOnce(
    page([{ ...item("fixture-invalid", "image"), mimeType: "application/pdf" }])
  );
  render(panel());
  fireEvent.click(button("open"));
  await screen.findByText("attachments.failed");
  expect(screen.queryByText("fixture-invalid.image")).not.toBeInTheDocument();
});

test("refresh explicitly resets the pagination snapshot", async () => {
  render(panel());
  fireEvent.click(button("open"));
  await screen.findByText("fixture-a.pdf");
  api.get.mockResolvedValueOnce(page([item("fixture-refreshed")]));
  fireEvent.click(button("refresh"));
  expect(screen.queryByText("fixture-a.pdf")).not.toBeInTheDocument();
  await screen.findByText("fixture-refreshed.pdf");
  expect(api.get.mock.calls[1][1].params).toEqual({ kind: "all", limit: 20 });
});
