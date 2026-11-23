import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import api from "../../services/api";
import SlaAlertsPopover from ".";

jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({
  i18n: { t: key => key, language: "pt-BR" }
}));
jest.mock("../../errors/toastError", () => jest.fn());

test("marks an oversight alert read without navigating to a restricted ticket", async () => {
  api.get.mockResolvedValue({
    data: {
      unreadCount: 1,
      alerts: [
        {
          id: 41,
          ticketUuid: null,
          queueName: null,
          createdAt: "2026-11-13T10:00:00Z",
          readAt: null
        }
      ]
    }
  });
  api.put.mockResolvedValue({});
  const history = createMemoryHistory({ initialEntries: ["/tickets"] });
  render(
    <Router history={history}>
      <SlaAlertsPopover />
    </Router>
  );

  fireEvent.click(
    screen.getByRole("button", { name: "slaNotifications.title" })
  );
  fireEvent.click(await screen.findByText("slaNotifications.waiting"));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/sla/alerts/41/read")
  );
  expect(history.location.pathname).toBe("/tickets");
});
