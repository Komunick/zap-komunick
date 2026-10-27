import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import TicketAssistant, { ASSISTANT_TIMEOUT_MS } from "./index";
import api from "../../services/api";

jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
const enabled = { enabled: true, mode: "mock", simulated: true };
const result = kind => ({
  ticketId: 301,
  contactId: 201,
  kind,
  mode: "mock",
  simulated: true,
  requiresReview: true,
  text: "Fictitious text for review",
  references: [
    { messageId: "fixture-message-A", excerpt: "Fictitious message A" }
  ],
  context: {
    partial: false,
    messageCount: 1,
    characterCount: 20,
    maxMessages: 30,
    maxCharacters: 12000
  },
  warnings: ["SIMULATED", "REVIEW_REQUIRED"]
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const button = key => screen.getByRole("button", { name: `assistant.${key}` });
async function openAssistant() {
  await waitFor(() => expect(button("open")).toBeEnabled());
  fireEvent.click(button("open"));
  await waitFor(() => expect(button("summary")).toBeEnabled());
}
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  api.get.mockResolvedValue({ data: enabled });
});
afterEach(() => jest.restoreAllMocks());

test("disabled company hides the action and never generates", async () => {
  api.get.mockResolvedValue({
    data: { enabled: false, mode: "disabled", simulated: true }
  });
  render(<TicketAssistant ticketId={301} onUseDraft={jest.fn()} />);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "assistant.open" })
    ).not.toBeInTheDocument()
  );
  expect(api.post).not.toHaveBeenCalled();
});

test("summary is requested on demand, displays simulation and references, and never inserts", async () => {
  const accept = jest.fn();
  api.post.mockResolvedValue({ data: result("summary") });
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(button("summary"));
  await screen.findByText("Fictitious text for review");
  expect(api.post).toHaveBeenCalledWith(
    "/tickets/301/assistant",
    { kind: "summary" },
    expect.objectContaining({ signal: expect.anything() })
  );
  expect(screen.getByText("assistant.simulation")).toBeInTheDocument();
  expect(screen.getByText("fixture-message-A")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "assistant.useDraft" })
  ).not.toBeInTheDocument();
  expect(accept).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

test("reply remains editable in memory until explicit acceptance and fresh authorization", async () => {
  const accept = jest.fn();
  api.post.mockResolvedValue({ data: result("reply") });
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  const draft = await screen.findByLabelText("assistant.draft");
  fireEvent.change(draft, { target: { value: "Human revised fixture" } });
  expect(accept).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
  const before = api.get.mock.calls.length;
  fireEvent.click(button("useDraft"));
  fireEvent.click(button("useDraft"));
  await waitFor(() =>
    expect(accept).toHaveBeenCalledWith("Human revised fixture", 301)
  );
  expect(accept).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledTimes(before + 1);
  expect(api.post).toHaveBeenCalledTimes(1);
});

test("cancel aborts and ignores a provider response that still resolves", async () => {
  const pending = deferred();
  const accept = jest.fn();
  api.post.mockReturnValue(pending.promise);
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  const signal = api.post.mock.calls[0][2].signal;
  fireEvent.click(button("cancel"));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve({ data: result("reply") }));
  await openAssistant();
  expect(screen.queryByLabelText("assistant.draft")).not.toBeInTheDocument();
  expect(accept).not.toHaveBeenCalled();
});

test("ticket change aborts and does not carry old results into the next ticket", async () => {
  const pending = deferred();
  const accept = jest.fn();
  api.post.mockReturnValue(pending.promise);
  const view = render(
    <TicketAssistant key="301" ticketId={301} onUseDraft={accept} />
  );
  await openAssistant();
  fireEvent.click(button("reply"));
  view.rerender(
    <TicketAssistant key="302" ticketId={302} onUseDraft={accept} />
  );
  await act(async () => pending.resolve({ data: result("reply") }));
  await openAssistant();
  expect(screen.queryByLabelText("assistant.draft")).not.toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith(
    "/tickets/302/assistant/status",
    expect.anything()
  );
  expect(accept).not.toHaveBeenCalled();
});

test("entering a blocked composer mode cancels in-flight work and prevents insertion", async () => {
  const pending = deferred();
  const accept = jest.fn();
  api.post.mockReturnValue(pending.promise);
  const view = render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  view.rerender(
    <TicketAssistant ticketId={301} onUseDraft={accept} disabled />
  );
  await act(async () => pending.resolve({ data: result("reply") }));
  await waitFor(() => expect(button("open")).toBeDisabled());
  expect(accept).not.toHaveBeenCalled();
});

test("timeout and late success leave the human draft untouched", async () => {
  const pending = deferred();
  const accept = jest.fn();
  api.post.mockReturnValue(pending.promise);
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  const timer = jest.spyOn(global, "setTimeout");
  fireEvent.click(button("reply"));
  act(() =>
    timer.mock.calls.find(call => call[1] === ASSISTANT_TIMEOUT_MS)[0]()
  );
  expect(screen.getByText("assistant.timeout")).toBeInTheDocument();
  await act(async () => pending.resolve({ data: result("reply") }));
  expect(screen.queryByLabelText("assistant.draft")).not.toBeInTheDocument();
  expect(accept).not.toHaveBeenCalled();
});

test.each([false, undefined])(
  "rejects a response without the required simulation marker (%s)",
  async simulated => {
    api.post.mockResolvedValue({ data: { ...result("reply"), simulated } });
    render(<TicketAssistant ticketId={301} onUseDraft={jest.fn()} />);
    await openAssistant();
    fireEvent.click(button("reply"));
    await screen.findByText("assistant.invalidOutput");
    expect(screen.queryByLabelText("assistant.draft")).not.toBeInTheDocument();
  }
);

test("foreign-ticket output is refused and partial context is visibly qualified", async () => {
  api.post
    .mockResolvedValueOnce({ data: { ...result("reply"), ticketId: 999 } })
    .mockResolvedValueOnce({
      data: {
        ...result("summary"),
        context: { ...result("summary").context, partial: true }
      }
    });
  render(<TicketAssistant ticketId={301} onUseDraft={jest.fn()} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  await screen.findByText("assistant.invalidOutput");
  fireEvent.click(button("summary"));
  await screen.findByText("assistant.partial");
});

test("lost permission at acceptance preserves the reviewed text and never inserts", async () => {
  const accept = jest.fn();
  api.post.mockResolvedValue({ data: result("reply") });
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  await screen.findByLabelText("assistant.draft");
  api.get.mockRejectedValue({
    response: { data: { error: "ERR_NO_PERMISSION" } }
  });
  fireEvent.click(button("useDraft"));
  await screen.findByText("assistant.noPermission");
  expect(screen.getByLabelText("assistant.draft")).toHaveValue(
    "Fictitious text for review"
  );
  expect(accept).not.toHaveBeenCalled();
});

test("safe errors never echo provider details", async () => {
  api.post.mockRejectedValue({
    response: { data: { error: "private-fixture-payload" } }
  });
  render(<TicketAssistant ticketId={301} onUseDraft={jest.fn()} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  await screen.findByText("assistant.requestError");
  expect(screen.queryByText("private-fixture-payload")).not.toBeInTheDocument();
});

test.each([
  { warnings: {} },
  { warnings: [] },
  { references: [null] },
  { context: { partial: "true" } }
])(
  "refuses invalid result metadata without breaking the review dialog (%j)",
  async invalid => {
    api.post.mockResolvedValue({ data: { ...result("reply"), ...invalid } });
    render(<TicketAssistant ticketId={301} onUseDraft={jest.fn()} />);
    await openAssistant();
    fireEvent.click(button("reply"));
    await screen.findByText("assistant.invalidOutput");
    expect(screen.queryByLabelText("assistant.draft")).not.toBeInTheDocument();
  }
);

test("freezes the reviewed text while acceptance authorization is pending", async () => {
  const accept = jest.fn();
  const pending = deferred();
  api.post.mockResolvedValue({ data: result("reply") });
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  const draft = await screen.findByLabelText("assistant.draft");
  fireEvent.change(draft, { target: { value: "Human reviewed fixture" } });
  api.get.mockReturnValueOnce(pending.promise);
  fireEvent.click(button("useDraft"));
  expect(draft).toBeDisabled();
  userEvent.type(draft, "Late edit");
  expect(draft).toHaveValue("Human reviewed fixture");
  expect(accept).not.toHaveBeenCalled();
  await act(async () => pending.resolve({ data: enabled }));
  expect(accept).toHaveBeenCalledWith("Human reviewed fixture", 301);
});

test("canceling a pending acceptance never inserts its late authorization response", async () => {
  const accept = jest.fn();
  const pending = deferred();
  api.post.mockResolvedValue({ data: result("reply") });
  render(<TicketAssistant ticketId={301} onUseDraft={accept} />);
  await openAssistant();
  fireEvent.click(button("reply"));
  await screen.findByLabelText("assistant.draft");
  api.get.mockReturnValueOnce(pending.promise);
  fireEvent.click(button("useDraft"));
  fireEvent.click(button("cancel"));
  await act(async () => pending.resolve({ data: enabled }));
  expect(accept).not.toHaveBeenCalled();
});
