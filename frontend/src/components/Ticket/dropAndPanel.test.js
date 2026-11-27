import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Ticket from "./index";
import api from "../../services/api";

let mockWide = true;
const mockHistory = { push: jest.fn() };
jest.mock("@material-ui/core/useMediaQuery", () => () => mockWide);
jest.mock("react-router-dom", () => ({
  useParams: () => ({ ticketId: "fixture-a" }),
  useHistory: () => mockHistory
}));
jest.mock("../../services/api", () => ({ get: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../hooks/useSettings", () => () => ({
  getSetting: async key => (key === "tagsMode" ? "ticket" : "disabled")
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext({
    user: { id: 101, profile: "admin", queues: [] }
  })
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: require("react").createContext({
    onConnect: jest.fn(),
    GetSocket: () => ({ on: jest.fn(), emit: jest.fn(), disconnect: jest.fn() })
  })
}));
jest.mock("../ContactDrawer", () => () => null);
jest.mock("../CustomerPanel", () => () => (
  <aside aria-label="customerPanel.title" />
));
jest.mock("../TicketHeader", () => ({ children }) => <div>{children}</div>);
jest.mock("../TicketInfo", () => () => null);
jest.mock("../TicketActionButtonsCustom", () => () => null);
jest.mock("../MessagesList", () => () => <div data-testid="messages" />);
jest.mock("../AttachmentsPanel", () => () => null);
jest.mock("../TagsContainer", () => ({ TagsContainer: () => null }));
jest.mock(
  "../MessageInputCustom/",
  () =>
    ({ dropRequest, onMediaPreviewChange }) => (
      <div data-testid="composer">
        {(dropRequest?.files || []).map(file => file.name).join("|")}
        <button type="button" onClick={() => onMediaPreviewChange(true)}>
          files waiting
        </button>
        <button type="button" onClick={() => onMediaPreviewChange(false)}>
          nothing waiting
        </button>
      </div>
    )
);
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../AcessoriasPanel", () => () => null);
jest.mock("../SciPanel", () => () => null);

const row = { id: 301, uuid: "fixture-a", queueId: 401, contact: { id: 7 } };
const pdf = new File(["%PDF-1.4"], "guia.pdf", { type: "application/pdf" });
const fileDrag = (files = [pdf]) => ({
  dataTransfer: { types: ["Files"], files, items: [], dropEffect: "none" }
});

const renderTicket = async () => {
  api.get.mockResolvedValue({ data: row });
  render(<Ticket />);
  await screen.findByTestId("composer");
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockWide = true;
});

test("files dropped on the conversation reach the composer", async () => {
  await renderTicket();
  const zone = screen.getByTestId("ticket-drop-zone");

  fireEvent.dragEnter(screen.getByTestId("messages"), fileDrag());
  expect(screen.getByText("messagesInput.dropFiles")).toBeInTheDocument();

  fireEvent.drop(zone, fileDrag());

  expect(screen.queryByText("messagesInput.dropFiles")).not.toBeInTheDocument();
  expect(screen.getByTestId("composer")).toHaveTextContent("guia.pdf");
});

test("dragging text does not offer to attach", async () => {
  await renderTicket();

  fireEvent.dragEnter(screen.getByTestId("messages"), {
    dataTransfer: { types: ["text/plain"] }
  });

  expect(screen.queryByText("messagesInput.dropFiles")).not.toBeInTheDocument();
});

const panel = () =>
  screen.queryByRole("complementary", { name: "customerPanel.title" });

test("the header button hides the contact panel, remembers it and brings it back", async () => {
  await renderTicket();
  expect(panel()).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole("button", { name: "customerPanel.collapse" })
  );
  expect(panel()).not.toBeInTheDocument();
  expect(localStorage.getItem("superchat.customerPanel.collapsed.101")).toBe(
    "1"
  );

  const expand = screen.getByRole("button", { name: "customerPanel.expand" });
  expect(expand).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(expand);
  expect(panel()).toBeInTheDocument();
  expect(
    localStorage.getItem("superchat.customerPanel.collapsed.101")
  ).toBeNull();
});

test("a collapsed panel stays collapsed on the next ticket screen", async () => {
  localStorage.setItem("superchat.customerPanel.collapsed.101", "1");

  await act(async () => {
    await renderTicket();
  });

  expect(panel()).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "customerPanel.expand" })
  ).toBeInTheDocument();
});

test("on narrow screens the header has no panel button and the drawer is kept", async () => {
  mockWide = false;
  await renderTicket();

  expect(
    screen.queryByRole("button", { name: /customerPanel\./ })
  ).not.toBeInTheDocument();
});

// On a low window the conversation must give room to the preview and to the
// send bar: the screen marks the area while files wait to be sent.
test("the conversation gives way while files wait to be sent", async () => {
  await renderTicket();
  const zone = screen.getByTestId("ticket-drop-zone");
  const normal = zone.className;

  fireEvent.click(screen.getByRole("button", { name: "files waiting" }));
  expect(zone.className).not.toBe(normal);
  expect(zone.className).toContain(normal);
  // the conversation is the first thing in the area, which the style relies on
  expect(zone.firstElementChild).toBe(screen.getByTestId("messages"));

  // jsdom lays nothing out: what is guarded is the rule the layout stands on.
  // The conversation takes only what is left, and gives all of it on a low
  // window, where the strip above the conversation leaves the screen too.
  const rules = Array.from(document.styleSheets).flatMap(sheet =>
    Array.from(sheet.cssRules)
  );
  const plain = rules.filter(
    rule =>
      rule.selectorText &&
      /> :first-child$/.test(rule.selectorText) &&
      zone.firstElementChild.matches(rule.selectorText)
  );
  expect(plain).toHaveLength(1);
  expect(plain[0].style.getPropertyValue("flex-basis")).toBe("0");
  expect(plain[0].style.getPropertyValue("min-height")).toBe("56px");

  const strip = screen.getByTestId("ticket-context-strip");
  const low = rules
    .filter(
      rule => rule.media && /max-height: 560px/.test(rule.media.mediaText)
    )
    .flatMap(rule => Array.from(rule.cssRules));
  const lowConversation = low.filter(rule =>
    zone.firstElementChild.matches(rule.selectorText)
  );
  expect(lowConversation).toHaveLength(1);
  expect(lowConversation[0].style.getPropertyValue("min-height")).toBe("0");
  const lowStrip = low.filter(rule => strip.matches(rule.selectorText));
  expect(lowStrip).toHaveLength(1);
  expect(lowStrip[0].style.getPropertyValue("display")).toBe("none");

  fireEvent.click(screen.getByRole("button", { name: "nothing waiting" }));
  expect(zone.className).toBe(normal);
  // with nothing waiting, no rule hides the strip any more
  expect(low.filter(rule => strip.matches(rule.selectorText))).toHaveLength(0);
});
