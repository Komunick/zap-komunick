import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SciSettings from "./index";
import api from "../../services/api";
jest.mock("../../services/api", () => ({ put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
beforeEach(() => jest.clearAllMocks());
test("defaults off, then explicitly changes only the SCI company flag", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(<SciSettings settings={[]} />);
  const field = screen.getByRole("checkbox", {
    name: "sci.settingsTitle"
  });
  expect(field).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(field);
  await waitFor(() => expect(field).toBeChecked());
  expect(api.put).toHaveBeenCalledWith("/settings/sciEnabled", {
    value: "enabled"
  });
});
test("failure keeps the previous flag without echoing request details", async () => {
  api.put.mockRejectedValue(new Error("private-fictitious-payload"));
  render(
    <SciSettings
      settings={[{ key: "sciEnabled", value: "enabled" }]}
    />
  );
  const field = screen.getByRole("checkbox", {
    name: "sci.settingsTitle"
  });
  fireEvent.click(field);
  await screen.findByText("sci.settingError");
  expect(field).toBeChecked();
  expect(
    screen.queryByText("private-fictitious-payload")
  ).not.toBeInTheDocument();
});
test("duplicate conflicting flags are disabled and visibly explained", () => {
  render(
    <SciSettings
      settings={[
        { key: "sciEnabled", value: "enabled" },
        { key: "sciEnabled", value: "disabled" }
      ]}
    />
  );
  expect(
    screen.getByRole("checkbox", { name: "sci.settingsTitle" })
  ).not.toBeChecked();
  expect(screen.getByText("sci.settingConflict")).toBeInTheDocument();
});


test("P1 and Acessórias flags cannot turn on SCI", () => {
  render(<SciSettings settings={[{ key: "aiAssistantEnabled", value: "enabled" }, { key: "acessoriasEnabled", value: "enabled" }]} />);
  expect(screen.getByRole("checkbox", { name: "sci.settingsTitle" })).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
});

test("a successful toggle converges a conflicting local display only after acceptance", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(<SciSettings settings={[{ key: "sciEnabled", value: "enabled" }, { key: "sciEnabled", value: "disabled" }]} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "sci.settingsTitle" }));
  await waitFor(() => expect(screen.queryByText("sci.settingConflict")).not.toBeInTheDocument());
  expect(screen.getByRole("checkbox", { name: "sci.settingsTitle" })).toBeChecked();
  expect(api.put).toHaveBeenCalledTimes(1);
});
