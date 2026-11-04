import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import { createKomunickTheme } from "../theme/komunick";
import { AuthContext } from "../context/Auth/AuthContext";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { SocketContext } from "../context/Socket/SocketContext";
import MainListItems from "./MainListItems";
import NavTabs from "./NavTabs";
import { buildNavItems } from "./navItems";
import SettingsCustom from "../pages/SettingsCustom";

const mockLabels = {
  "mainDrawer.listItems.tickets": "Atendimentos",
  "mainDrawer.listItems.messagesAPI": "API",
  "mainDrawer.listItems.financeiro": "Financeiro",
  "mainDrawer.listItems.settings": "Configurações",
  "mainDrawer.listItems.helps": "Ajuda",
  "layoutMode.more": "Mais",
  "settings.Options.title": "Opções",
  "settings.Whitelabel.title": "Personalização",
  "settings.docker.title": "Containers Docker"
};
const mockSocket = { on: jest.fn(), disconnect: jest.fn() };
const mockSocketManager = { GetSocket: jest.fn(() => mockSocket) };
const mockGetCurrentUserInfo = jest.fn();
const mockFindCompany = jest.fn();
const mockGetSettings = jest.fn();

jest.mock("../translate/i18n", () => ({
  i18n: { t: key => mockLabels[key] || key }
}));
jest.mock("../context/Auth/AuthContext", () => ({
  AuthContext: jest.requireActual("react").createContext({})
}));
jest.mock("../context/WhatsApp/WhatsAppsContext", () => ({
  WhatsAppsContext: jest.requireActual("react").createContext({})
}));
jest.mock("../context/Socket/SocketContext", () => ({
  SocketContext: jest.requireActual("react").createContext(null)
}));
jest.mock("../hooks/useAuth.js", () => () => ({
  getCurrentUserInfo: mockGetCurrentUserInfo
}));
jest.mock("../hooks/useCompanies", () => () => ({
  find: mockFindCompany,
  updateSchedules: jest.fn()
}));
jest.mock("../hooks/useSettings", () => () => ({
  getAll: mockGetSettings
}));
jest.mock("../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { records: [] } }) }
}));
jest.mock("../services/config", () => ({
  __esModule: true,
  default: { TZAUTOINSTALLER: "1" }
}));
jest.mock("@material-ui/core", () => ({
  ...jest.requireActual("@material-ui/core"),
  useMediaQuery: jest.fn()
}));
jest.mock("../components/DarkMode", () => () => null);
jest.mock("../components/SchedulesForm", () => () => null);
jest.mock("../components/CompaniesManager", () => () => null);
jest.mock("../components/PlansManager", () => () => null);
jest.mock("../components/HelpsManager", () => () => null);
jest.mock("../components/ContainersManager", () => jest.fn(() => null));
jest.mock("../components/Settings/Options", () => () => null);
jest.mock("../components/Settings/Whitelabel", () => () => null);
jest.mock("../components/Settings/PaymentGateway", () => () => null);
jest.mock("../components/Settings/I18nSettings", () => () => null);
jest.mock("../components/OpenHoursEditor", () => () => null);

const actors = [
  { profile: "admin", super: false },
  { profile: "admin", super: true },
  { profile: "user", super: false }
];
const wrap = (children, user) => (
  <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
    <MemoryRouter>
      <AuthContext.Provider value={{ user, handleLogout: jest.fn() }}>
        <WhatsAppsContext.Provider value={{ whatsApps: [] }}>
          <SocketContext.Provider value={mockSocketManager}>
            {children}
          </SocketContext.Provider>
        </WhatsAppsContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>
  </ThemeProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  mockSocketManager.GetSocket.mockReturnValue(mockSocket);
  jest.requireMock("../services/api").default.get.mockResolvedValue({
    data: { records: [] }
  });
  localStorage.clear();
  localStorage.setItem("companyId", "10");
  mockFindCompany.mockResolvedValue({ id: 10, schedules: {} });
  mockGetSettings.mockResolvedValue([]);
  useMediaQuery.mockReturnValue(false);
});

describe.each(actors)("shared drawer for %p", actor => {
  test.each([false, true])(
    "removes Financeiro with collapsed=%s and keeps ordinary links",
    collapsed => {
      const user = { ...actor, id: 7 };
      render(
        wrap(
          <MainListItems
            drawerOpen={!collapsed}
            collapsed={collapsed}
            drawerClose={jest.fn()}
          />,
          user
        )
      );
      expect(
        screen.queryByRole("button", { name: "Financeiro" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Atendimentos" })
      ).toHaveAttribute("href", "/tickets");
      expect(screen.getByRole("button", { name: "Ajuda" })).toHaveAttribute(
        "href",
        "/helps"
      );
      if (actor.profile === "admin") {
        expect(screen.getByRole("button", { name: "API" })).toHaveAttribute(
          "href",
          "/messages-api"
        );
        expect(
          screen.getByRole("button", { name: "Configurações" })
        ).toHaveAttribute("href", "/settings");
      } else {
        expect(
          screen.queryByRole("button", { name: "API" })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Configurações" })
        ).not.toBeInTheDocument();
      }
    }
  );
});

describe.each([false, true])(
  "Foco and command pages with isAdmin=%s",
  isAdmin => {
    it("keeps Financeiro and deployment out of the shared page catalog", () => {
      const { main, more } = buildNavItems(isAdmin);
      const destinations = [...main, ...more].map(item => item.to);
      expect(destinations).not.toEqual(expect.arrayContaining(["/financeiro"]));
      expect(destinations.some(to => /^\/(deploy|docker)(\/|$)/.test(to))).toBe(
        false
      );
      expect(destinations).toContain("/tickets");
      expect(destinations).toContain("/helps");
      expect(destinations.includes("/messages-api")).toBe(isAdmin);
      expect(destinations.includes("/settings")).toBe(isAdmin);
    });

    it("does not offer removed pages in Foco or its More menu", () => {
      render(
        wrap(<NavTabs isAdmin={isAdmin} />, {
          profile: isAdmin ? "admin" : "user"
        })
      );
      expect(
        screen.getByRole("link", { name: "Atendimentos" })
      ).toHaveAttribute("href", "/tickets");
      fireEvent.click(screen.getByRole("button", { name: "Mais" }));
      expect(screen.getByRole("menuitem", { name: "Ajuda" })).toHaveAttribute(
        "href",
        "/helps"
      );
      expect(
        screen.queryByRole("link", { name: "Financeiro" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /Deploy|Containers Docker/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitem", {
          name: /Financeiro|Deploy|Containers Docker/i
        })
      ).not.toBeInTheDocument();
      if (isAdmin) {
        expect(screen.getByRole("menuitem", { name: "API" })).toHaveAttribute(
          "href",
          "/messages-api"
        );
      } else {
        expect(
          screen.queryByRole("menuitem", { name: "API" })
        ).not.toBeInTheDocument();
      }
    });
  }
);

describe.each(actors)("settings navigation for %p", actor => {
  test.each([false, true])(
    "removes deployment controls with mobile=%s even when installer is enabled",
    async mobile => {
      useMediaQuery.mockReturnValue(mobile);
      mockGetCurrentUserInfo.mockResolvedValue({ ...actor, id: 7 });
      expect(
        jest.requireMock("../services/config").default.TZAUTOINSTALLER
      ).toBe("1");
      await act(async () => {
        render(wrap(<SettingsCustom />, { ...actor, id: 7 }));
      });
      await waitFor(() => expect(mockGetCurrentUserInfo).toHaveBeenCalled());
      if (mobile) {
        fireEvent.mouseDown(screen.getByRole("button", { name: "Opções" }));
        expect(
          screen.getByRole("option", { name: "Opções" })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole("option", { name: "Containers Docker" })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("option", { name: /Deploy/i })
        ).not.toBeInTheDocument();
        expect(!!screen.queryByRole("option", { name: "Personalização" })).toBe(
          actor.super
        );
      } else {
        expect(screen.getByRole("tab", { name: "Opções" })).toBeInTheDocument();
        expect(
          screen.queryByRole("tab", { name: "Containers Docker" })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole("tab", { name: /Deploy/i })
        ).not.toBeInTheDocument();
        expect(!!screen.queryByRole("tab", { name: "Personalização" })).toBe(
          actor.super
        );
      }
      expect(
        jest.requireMock("../components/ContainersManager")
      ).not.toHaveBeenCalled();
    }
  );
});
