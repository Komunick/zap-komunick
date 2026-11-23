import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { ThemeProvider } from "@material-ui/core/styles";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { createKomunickTheme } from "../../theme/komunick";
import api from "../../services/api";
import TicketListItem from ".";
import TicketListItemCustom from "../TicketListItemCustom";

jest.mock("../../services/api", () => ({
  get: jest.fn(),
  put: jest.fn()
}));
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: jest.requireActual("react").createContext({})
}));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../TicketMessagesDialog", () => () => null);
jest.mock("../CloseTicketModal", () => () => null);
jest.mock("../TagPicker", () => ({ TagPickerPopover: () => null }));
jest.mock("../TicketsBulk", () => ({
  BulkSelectionContext: jest.requireActual("react").createContext(null)
}));
jest.mock(
  "react-whatsmarked",
  () =>
    ({ children }) =>
      children
);

const ticket = {
  id: 301,
  uuid: "fixture-ticket",
  status: "pending",
  unreadMessages: 2,
  contact: { name: "Contato fictício" },
  queue: { name: "Fila fictícia" }
};

function renderPendingTicket(Component = TicketListItem, mode = "light") {
  const history = createMemoryHistory({ initialEntries: ["/tickets"] });
  render(
    <ThemeProvider theme={createKomunickTheme({ mode })}>
      <AuthContext.Provider value={{ user: { id: 101, profile: "user" } }}>
        <Router history={history}>
          <TicketsContext.Provider value={{ setCurrentTicket: jest.fn() }}>
            <Component ticket={ticket} setTabOpen={jest.fn()} />
          </TicketsContext.Provider>
        </Router>
      </AuthContext.Provider>
    </ThemeProvider>
  );
  return history;
}

beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockResolvedValue({
    data: { preview: { kind: "text", text: "Mensagem fictícia" } }
  });
});

test.each([
  ["notification list", TicketListItem, "light"],
  ["ticket list", TicketListItemCustom, "dark"]
])(
  "%s preview opens the ticket only after acceptance",
  async (_, Component, mode) => {
    const history = renderPendingTicket(Component, mode);
    api.put.mockResolvedValue({});

    fireEvent.click(
      screen.getByRole("button", { name: "ticketPreview.action" })
    );
    await screen.findByText("Mensagem fictícia");

    expect(api.get).toHaveBeenCalledWith(
      "/messages/301/preview",
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(api.put).not.toHaveBeenCalled();
    expect(history.location.pathname).toBe("/tickets");

    fireEvent.click(
      screen.getByRole("button", { name: "ticketPreview.accept" })
    );
    await waitFor(() =>
      expect(history.location.pathname).toBe("/tickets/fixture-ticket")
    );
    expect(api.put).toHaveBeenCalledWith("/tickets/301", {
      status: "open",
      onlyIfPending: true,
      userId: 101
    });
  }
);

test("a failed acceptance keeps the ticket in the preview", async () => {
  const history = renderPendingTicket();
  api.put.mockRejectedValue(new Error("Fixture rejection"));
  fireEvent.click(screen.getByRole("button", { name: "ticketPreview.action" }));
  await screen.findByText("Mensagem fictícia");

  const accept = screen.getByRole("button", { name: "ticketPreview.accept" });
  fireEvent.click(accept);
  await waitFor(() => expect(accept.disabled).toBe(false));

  expect(history.location.pathname).toBe("/tickets");
  expect(screen.getByRole("dialog")).toBeTruthy();
});
