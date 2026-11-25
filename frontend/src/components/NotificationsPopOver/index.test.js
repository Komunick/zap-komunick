import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
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
const mockCloseDesktopNotification = jest.fn();
const mockSocketCallbacks = new Map();
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
jest.mock("../TicketListItem", () => ({ ticket }) => (
  <span>{ticket.contact.name}</span>
));

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
  mockSocketCallbacks.clear();
  mockSocket.on.mockImplementation((event, callback) =>
    mockSocketCallbacks.set(event, callback)
  );
  localStorage.clear();
  localStorage.setItem("companyId", "10");
  Object.defineProperty(window, "Notification", {
    configurable: true,
    writable: true,
    value: Object.assign(
      jest
        .fn()
        .mockImplementation(() => ({ close: mockCloseDesktopNotification })),
      { requestPermission: jest.fn().mockResolvedValue("denied") }
    )
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
          value={{
            user: {
              id: 7,
              companyId: 10,
              profile: "admin",
              queues: [{ id: 5 }]
            }
          }}
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

const pendingTicket = {
  id: 111,
  uuid: "fixture-ticket-sector",
  companyId: 10,
  userId: null,
  queueId: 5,
  unreadMessages: 1,
  status: "pending",
  contact: { id: 201, name: "Contato do Fiscal" }
};

const sectorView = user => (
  <ThemeProvider
    theme={createKomunickTheme({ mode: "light", appName: "SuperChat" })}
  >
    <MemoryRouter initialEntries={["/tickets"]}>
      <AuthContext.Provider value={{ user }}>
        <SocketContext.Provider value={mockSocketManager}>
          <NotificationsPopOver volume={0} />
        </SocketContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  </ThemeProvider>
);

const ticketFromAnotherSector = {
  ...pendingTicket,
  id: 112,
  queueId: 6,
  userId: 7,
  contact: { id: 202, name: "Contato do Pessoal" }
};

test.each(["user", "admin"])(
  "%s only sees unread tickets within their current sectors",
  async profile => {
    useTickets.mockReturnValue({
      tickets: [
        pendingTicket,
        ticketFromAnotherSector,
        {
          ...pendingTicket,
          id: 113,
          queueId: null,
          contact: { name: "Sem setor" }
        },
        {
          ...pendingTicket,
          id: 114,
          companyId: 20,
          contact: { name: "Outra empresa" }
        },
        {
          ...pendingTicket,
          id: 115,
          userId: 8,
          contact: { name: "Outro atendente" }
        }
      ],
      refetch: mockRefetchTickets
    });
    const user = { id: 7, companyId: 10, profile, queues: [{ id: 5 }] };
    const { rerender } = render(sectorView(user));
    fireEvent.click(
      screen.getByRole("button", { name: "Mostrar Notificações" })
    );

    expect(await screen.findByText("Contato do Fiscal")).not.toBeNull();
    expect(screen.queryByText("Contato do Pessoal")).toBeNull();
    expect(screen.queryByText("Sem setor")).toBeNull();
    expect(screen.queryByText("Outra empresa")).toBeNull();
    expect(screen.queryByText("Outro atendente")).toBeNull();
    expect(document.title).toBe("➊ - SuperChat");

    rerender(sectorView({ ...user, queues: [] }));
    expect(screen.queryByText("Contato do Fiscal")).toBeNull();
    expect(document.title).toBe("SuperChat");
  }
);

test.each([
  [
    "a transfer",
    "ticket",
    { action: "removeFromList", ticketId: pendingTicket.id }
  ],
  [
    "sector deletion",
    "queue",
    { action: "delete", queueId: pendingTicket.queueId }
  ]
])(
  "filters desktop notifications and retracts them after %s",
  async (_, event, data) => {
    useTickets.mockReturnValue({ tickets: [], refetch: mockRefetchTickets });
    render(
      sectorView({
        id: 7,
        companyId: 10,
        profile: "admin",
        queues: [{ id: 5 }]
      })
    );
    await waitFor(() =>
      expect(mockSocketCallbacks.has("company-10-appMessage")).toBe(true)
    );
    act(() => mockSocketManager.onConnect.mock.calls[0][0]());
    expect(mockSocket.emit).toHaveBeenCalledWith("joinTicketNotifications");
    const receiveMessage = ticket =>
      act(() => {
        mockSocketCallbacks.get("company-10-appMessage")({
          action: "create",
          ticket,
          contact: ticket.contact,
          message: { read: false, body: "Mensagem fictícia" }
        });
      });

    receiveMessage(ticketFromAnotherSector);
    expect(window.Notification).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();

    receiveMessage(pendingTicket);
    expect(window.Notification).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("➊ - SuperChat");

    act(() => {
      mockSocketCallbacks.get(`company-10-${event}`)(data);
    });
    expect(mockCloseDesktopNotification).toHaveBeenCalledTimes(1);
    expect(document.title).toBe("SuperChat");
  }
);

// Zap Komunick (RF-033): the server only sends a conversation waiting for a
// sector to the attendants of the general queue; the bell must not drop it
// for having no sector.
test("notifies a conversation that is waiting for the customer to pick a sector", async () => {
  useTickets.mockReturnValue({
    tickets: [
      {
        ...pendingTicket,
        id: 121,
        queueId: null,
        generalTriageStartedAt: "2026-11-25T14:11:00.000Z",
        contact: { id: 301, name: "Cliente sem setor" }
      },
      // without the wait it is a ticket of the administrators: still dropped
      {
        ...pendingTicket,
        id: 122,
        queueId: null,
        generalTriageStartedAt: null,
        contact: { id: 302, name: "Iniciada pelo celular" }
      },
      // someone took it: it is no longer waiting
      {
        ...pendingTicket,
        id: 123,
        queueId: null,
        userId: 8,
        generalTriageStartedAt: "2026-11-25T14:11:00.000Z",
        contact: { id: 303, name: "Assumida por outro" }
      }
    ],
    refetch: mockRefetchTickets
  });
  render(
    sectorView({ id: 7, companyId: 10, profile: "user", queues: [{ id: 5 }] })
  );
  fireEvent.click(screen.getByRole("button", { name: "Mostrar Notificações" }));

  expect(await screen.findByText("Cliente sem setor")).not.toBeNull();
  expect(screen.queryByText("Iniciada pelo celular")).toBeNull();
  expect(screen.queryByText("Assumida por outro")).toBeNull();
  expect(document.title).toBe("➊ - SuperChat");
});
