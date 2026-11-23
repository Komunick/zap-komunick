import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../../services/api";
import SlaAlertSettings from "./SlaAlertSettings";

jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../helpers/i18nToast", () => ({
  i18nToast: { success: jest.fn() }
}));

test("saves the explicit observers and only a queue member as its responsible user", async () => {
  const queue = { id: 20, name: "Atendimento geral fictício" };
  const config = { enabled: false, extraRecipientIds: [31, 32], queues: [] };
  api.get.mockImplementation(url =>
    Promise.resolve({
      data:
        url === "/sla/alert-config"
          ? config
          : {
              users: [
                { id: 30, name: "Responsável fictício", queues: [queue] },
                { id: 31, name: "Carol fictícia", queues: [] },
                { id: 32, name: "Yasmin fictícia", queues: [] }
              ]
            }
    })
  );
  api.put.mockResolvedValue({ data: { ...config, enabled: true } });
  render(<SlaAlertSettings queues={[queue]} />);

  fireEvent.click(await screen.findByLabelText("slaNotifications.enabled"));
  const department = screen.getByLabelText("slaNotifications.queue");
  fireEvent.mouseDown(department);
  fireEvent.keyDown(department, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: queue.name }));

  const responsible = screen.getByLabelText("slaNotifications.responsible");
  fireEvent.mouseDown(responsible);
  fireEvent.keyDown(responsible, { key: "ArrowDown" });
  expect(await screen.findAllByRole("option")).toHaveLength(1);
  fireEvent.click(screen.getByRole("option", { name: "Responsável fictício" }));
  fireEvent.click(
    screen.getByRole("button", { name: "slaNotifications.save" })
  );

  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/sla/alert-config", {
      enabled: true,
      extraRecipientIds: [31, 32],
      queues: [{ queueId: 20, responsibleIds: [30] }]
    })
  );
});
