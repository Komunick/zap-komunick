import React from "react";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import Favicon from "react-favicon";
import useSound from "use-sound";
import useTickets from "../../hooks/useTickets";
import { createKomunickTheme } from "../../theme/komunick";
import { AuthContext } from "../../context/Auth/AuthContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import NotificationsPopOver from ".";

const mockPlay = jest.fn();
const mockRefetchTickets = jest.fn();
const mockGetSetting = jest.fn();
const mockSocket = { on: jest.fn(), emit: jest.fn(), disconnect: jest.fn() };
const mockSocketManager = { GetSocket: jest.fn(), onConnect: jest.fn() };

jest.mock("react-favicon", () => jest.fn());
jest.mock("use-sound", () => jest.fn());
jest.mock("../../hooks/useTickets", () => jest.fn());
jest.mock("../../hooks/useSettings", () => () => ({
  getSetting: mockGetSetting
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: jest.requireActual("react").createContext({})
}));
jest.mock("../../context/Socket/SocketContext", () => ({
  SocketContext: jest.requireActual("react").createContext(null)
}));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../TicketListItem", () => () => null);

const initialTitle = document.title;
const notificationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "Notification"
);
const cases = [
  { label: "uses the product fallback in light", mode: "light", unread: 0 },
  { label: "uses the product fallback in dark", mode: "dark", unread: 0 },
  {
    label: "preserves a configured PNG in light",
    mode: "light",
    icon: "/backend/public/fixture-company-icon.png",
    unread: 0
  },
  {
    label: "preserves a configured SVG in dark",
    mode: "dark",
    icon: "/backend/public/fixture-company-icon.svg",
    unread: 0
  },
  {
    label: "keeps the new product fallback with unread tickets",
    mode: "light",
    unread: 3
  },
  {
    label: "keeps the configured icon and unread count in dark",
    mode: "dark",
    icon: "/backend/public/fixture-company-icon.png",
    unread: 3
  }
];

beforeEach(() => {
  jest.clearAllMocks();
  Favicon.mockImplementation(() => null);
  useSound.mockReturnValue([mockPlay]);
  mockGetSetting.mockResolvedValue("disabled");
  mockSocketManager.GetSocket.mockReturnValue(mockSocket);
  localStorage.clear();
  localStorage.setItem("companyId", "10");
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: Object.assign(jest.fn(), {
      requestPermission: jest.fn().mockResolvedValue("denied")
    })
  });
});

afterEach(() => {
  document.title = initialTitle;
});

afterAll(() => {
  if (notificationDescriptor) {
    Object.defineProperty(window, "Notification", notificationDescriptor);
  } else {
    delete window.Notification;
  }
});

test.each(cases)("$label", async ({ mode, icon, unread }) => {
  const tickets = Array.from({ length: unread }, (_, index) => ({
    id: 101 + index,
    uuid: `fixture-ticket-${index}`,
    companyId: 10,
    userId: 7,
    queueId: 5,
    unreadMessages: 1,
    status: "open",
    contact: { id: 201 + index, name: `Contato fictício ${index}` }
  }));
  useTickets.mockReturnValue({ tickets, refetch: mockRefetchTickets });
  render(
    <ThemeProvider
      theme={createKomunickTheme({
        mode,
        appName: "SuperChat",
        appLogoFavicon: icon
      })}
    >
      <MemoryRouter initialEntries={["/tickets"]}>
        <AuthContext.Provider
          value={{ user: { id: 7, profile: "admin", queues: [{ id: 5 }] } }}
        >
          <SocketContext.Provider value={mockSocketManager}>
            <NotificationsPopOver volume={0} />
          </SocketContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>
  );
  const lastFaviconProps = () =>
    Favicon.mock.calls[Favicon.mock.calls.length - 1][0];
  await waitFor(() => expect(lastFaviconProps().alertCount).toBe(unread));
  expect(lastFaviconProps().url).toBe(icon || "/vector/superchat-icon.svg");
  expect(useTickets).toHaveBeenCalledWith({
    notClosed: "true",
    withUnreadMessages: "true"
  });
  expect(document.title).toBe(unread ? "➌ - SuperChat" : "SuperChat");
});
