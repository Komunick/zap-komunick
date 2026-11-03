import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegratedAssistantSettings from "./index";
import api from "../../services/api";
jest.mock("../../services/api", () => ({ put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
const field = () =>
  screen.getByRole("checkbox", { name: "integratedAssistant.settingsTitle" });
beforeEach(() => jest.clearAllMocks());
test("defaults off and changes only the integrated company flag after confirmation", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(<IntegratedAssistantSettings settings={[]} />);
  expect(field()).not.toBeChecked();
  fireEvent.click(field());
  await waitFor(() => expect(field()).toBeChecked());
  expect(api.put).toHaveBeenCalledWith("/settings/integratedAssistantEnabled", {
    value: "enabled"
  });
});
test("existing assistant and source flags cannot enable the integrated feature", () => {
  render(
    <IntegratedAssistantSettings
      settings={[
        { key: "aiAssistantEnabled", value: "enabled" },
        { key: "acessoriasEnabled", value: "enabled" },
        { key: "sciEnabled", value: "enabled" }
      ]}
    />
  );
  expect(field()).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
});
test("conflicting duplicate settings fail closed and clear only after successful save", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(
    <IntegratedAssistantSettings
      settings={[
        { key: "integratedAssistantEnabled", value: "enabled" },
        { key: "integratedAssistantEnabled", value: "disabled" }
      ]}
    />
  );
  expect(field()).not.toBeChecked();
  expect(
    screen.getByText("integratedAssistant.settingConflict")
  ).toBeInTheDocument();
  fireEvent.click(field());
  await waitFor(() =>
    expect(
      screen.queryByText("integratedAssistant.settingConflict")
    ).not.toBeInTheDocument()
  );
  expect(field()).toBeChecked();
});
test("a failed save preserves the previous value and never echoes the error", async () => {
  api.put.mockRejectedValue(new Error("fictitious-private-payload"));
  render(
    <IntegratedAssistantSettings
      settings={[{ key: "integratedAssistantEnabled", value: "enabled" }]}
    />
  );
  fireEvent.click(field());
  await screen.findByText("integratedAssistant.settingError");
  expect(field()).toBeChecked();
  expect(
    screen.queryByText("fictitious-private-payload")
  ).not.toBeInTheDocument();
});
