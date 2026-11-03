import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AssistantSettings from "./index";
import api from "../../services/api";
jest.mock("../../services/api", () => ({ put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
beforeEach(() => jest.clearAllMocks());
test("defaults off and saves only the company setting after explicit choice", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(<AssistantSettings settings={[]} />);
  const toggle = screen.getByRole("checkbox", {
    name: "assistant.settingsTitle"
  });
  expect(toggle).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toBeChecked());
  expect(api.put).toHaveBeenCalledWith("/settings/aiAssistantEnabled", {
    value: "enabled"
  });
});
test("failure preserves the setting and hides request details", async () => {
  api.put.mockRejectedValue(new Error("private-fixture-payload"));
  render(
    <AssistantSettings
      settings={[{ key: "aiAssistantEnabled", value: "enabled" }]}
    />
  );
  const toggle = screen.getByRole("checkbox", {
    name: "assistant.settingsTitle"
  });
  fireEvent.click(toggle);
  await screen.findByText("assistant.settingError");
  expect(toggle).toBeChecked();
  expect(screen.queryByText("private-fixture-payload")).not.toBeInTheDocument();
});

test("conflicting duplicate flags stay off and explain the conflict", () => {
  render(
    <AssistantSettings
      settings={[
        { key: "aiAssistantEnabled", value: "enabled" },
        { key: "aiAssistantEnabled", value: "disabled" }
      ]}
    />
  );
  expect(
    screen.getByRole("checkbox", { name: "assistant.settingsTitle" })
  ).not.toBeChecked();
  expect(screen.getByText("assistant.settingConflict")).toBeInTheDocument();
});
