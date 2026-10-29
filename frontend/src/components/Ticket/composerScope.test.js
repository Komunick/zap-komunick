import React from "react";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Ticket from "./index";
import api from "../../services/api";

let mockRoute = "fixture-a";
const mockHistory = { push: jest.fn() };
const mockGetSetting = async key =>
  key === "tagsMode" ? "ticket" : "disabled";
jest.mock("react-router-dom", () => ({
  useParams: () => ({ ticketId: mockRoute }),
  useHistory: () => mockHistory
}));
jest.mock("../../services/api", () => ({ get: jest.fn() }));
jest.mock("../../hooks/useSettings", () => () => ({
  getSetting: mockGetSetting
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({
    user: { profile: "admin", queues: [] }
  })
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({
    onConnect: jest.fn(),
    GetSocket: () => ({ on: jest.fn(), emit: jest.fn(), disconnect: jest.fn() })
  })
}));
jest.mock("../ContactDrawer", () => () => null);
jest.mock("../CustomerPanel", () => () => null);
jest.mock("../TicketHeader", () => ({ children }) => <div>{children}</div>);
jest.mock("../TicketInfo", () => () => null);
jest.mock("../TicketActionButtonsCustom", () => () => null);
jest.mock("../MessagesList", () => ({ attachmentContextReady }) => (
  <div
    data-testid="attachment-context"
    data-ready={String(attachmentContextReady)}
  />
));
jest.mock("../AttachmentsPanel", () => ({ ticketId }) => (
  <div data-testid="attachments-action" data-ticket-id={ticketId} />
));
jest.mock("../TagsContainer", () => ({ TagsContainer: () => null }));
jest.mock("../MessageInputCustom/", () => ({ ticket }) => (
  <div data-testid="composer" data-ticket-id={ticket.id}>
    {ticket.uuid}
  </div>
));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../AcessoriasPanel", () => ({ ticketId }) => (
  <div data-testid="acessorias-action" data-ticket-id={ticketId} />
));
jest.mock("../SciPanel", () => ({ ticketId }) => (
  <div data-testid="sci-action" data-ticket-id={ticketId} />
));

const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};
const row = (id, uuid) => ({ id, uuid, queueId: 401, contact: {} });
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers("legacy");
  mockRoute = "fixture-a";
});
afterEach(() => jest.useRealTimers());

test("hides composer while initial ticket is unresolved and mounts only the matching loaded ticket", async () => {
  const pending = deferred();
  api.get.mockReturnValue(pending.promise);
  render(<Ticket />);
  expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  expect(screen.queryByTestId("acessorias-action")).not.toBeInTheDocument();
  expect(screen.queryByTestId("sci-action")).not.toBeInTheDocument();
  expect(screen.queryByTestId("attachments-action")).not.toBeInTheDocument();
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "false"
  );
  await act(async () => jest.advanceTimersByTime(501));
  expect(api.get).toHaveBeenCalledWith(
    "/tickets/u/fixture-a",
    expect.objectContaining({ signal: expect.anything() })
  );
  expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  await act(async () => pending.resolve({ data: row(301, "fixture-a") }));
  expect(screen.getByTestId("attachments-action")).toBeInTheDocument();
  expect(screen.getByTestId("sci-action")).toHaveAttribute("data-ticket-id", screen.getByTestId("composer").getAttribute("data-ticket-id"));
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "true"
  );
  expect(screen.getByTestId("composer")).toHaveAttribute(
    "data-ticket-id",
    "301"
  );
});

test("hides the old ticket composer immediately while the next route is pending", async () => {
  api.get.mockResolvedValueOnce({ data: row(301, "fixture-a") });
  const view = render(<Ticket />);
  await act(async () => jest.advanceTimersByTime(501));
  expect(screen.getByTestId("attachments-action")).toBeInTheDocument();
  expect(screen.getByTestId("sci-action")).toHaveAttribute("data-ticket-id", screen.getByTestId("composer").getAttribute("data-ticket-id"));
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "true"
  );
  expect(screen.getByTestId("composer")).toHaveAttribute(
    "data-ticket-id",
    "301"
  );
  const pending = deferred();
  api.get.mockReturnValueOnce(pending.promise);
  mockRoute = "fixture-b";
  view.rerender(<Ticket />);
  expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  expect(screen.queryByTestId("sci-action")).not.toBeInTheDocument();
  await act(async () => jest.advanceTimersByTime(501));
  expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  await act(async () => pending.resolve({ data: row(302, "fixture-b") }));
  expect(screen.getByTestId("attachments-action")).toBeInTheDocument();
  expect(screen.getByTestId("sci-action")).toHaveAttribute("data-ticket-id", screen.getByTestId("composer").getAttribute("data-ticket-id"));
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "true"
  );
  expect(screen.getByTestId("composer")).toHaveAttribute(
    "data-ticket-id",
    "302"
  );
});

test("an old ticket response cannot replace the next loaded conversation", async () => {
  const a = deferred();
  const b = deferred();
  api.get.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const view = render(<Ticket />);
  await act(async () => jest.advanceTimersByTime(501));
  mockRoute = "fixture-b";
  view.rerender(<Ticket />);
  await act(async () => jest.advanceTimersByTime(501));
  await act(async () => b.resolve({ data: row(302, "fixture-b") }));
  expect(screen.getByTestId("attachments-action")).toBeInTheDocument();
  expect(screen.getByTestId("sci-action")).toHaveAttribute("data-ticket-id", screen.getByTestId("composer").getAttribute("data-ticket-id"));
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "true"
  );
  expect(screen.getByTestId("composer")).toHaveAttribute(
    "data-ticket-id",
    "302"
  );
  await act(async () => a.resolve({ data: row(301, "fixture-a") }));
  expect(screen.getByTestId("attachments-action")).toBeInTheDocument();
  expect(screen.getByTestId("sci-action")).toHaveAttribute("data-ticket-id", screen.getByTestId("composer").getAttribute("data-ticket-id"));
  expect(screen.getByTestId("attachment-context")).toHaveAttribute(
    "data-ready",
    "true"
  );
  expect(screen.getByTestId("composer")).toHaveAttribute(
    "data-ticket-id",
    "302"
  );
});
