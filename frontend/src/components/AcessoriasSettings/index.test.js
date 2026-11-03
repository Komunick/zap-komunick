import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AcessoriasSettings from "./index";
import api from "../../services/api";
jest.mock("../../services/api", () => ({ put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
beforeEach(() => jest.clearAllMocks());
test("defaults off, then explicitly changes only the Acessórias company flag", async () => {
  api.put.mockResolvedValue({ data: {} });
  render(<AcessoriasSettings settings={[]} />);
  const field = screen.getByRole("checkbox", {
    name: "acessorias.settingsTitle"
  });
  expect(field).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
  fireEvent.click(field);
  await waitFor(() => expect(field).toBeChecked());
  expect(api.put).toHaveBeenCalledWith("/settings/acessoriasEnabled", {
    value: "enabled"
  });
});
test("failure keeps the previous flag without echoing request details", async () => {
  api.put.mockRejectedValue(new Error("private-fictitious-payload"));
  render(
    <AcessoriasSettings
      settings={[{ key: "acessoriasEnabled", value: "enabled" }]}
    />
  );
  const field = screen.getByRole("checkbox", {
    name: "acessorias.settingsTitle"
  });
  fireEvent.click(field);
  await screen.findByText("acessorias.settingError");
  expect(field).toBeChecked();
  expect(
    screen.queryByText("private-fictitious-payload")
  ).not.toBeInTheDocument();
});
test("duplicate conflicting flags are disabled and visibly explained", () => {
  render(
    <AcessoriasSettings
      settings={[
        { key: "acessoriasEnabled", value: "enabled" },
        { key: "acessoriasEnabled", value: "disabled" }
      ]}
    />
  );
  expect(
    screen.getByRole("checkbox", { name: "acessorias.settingsTitle" })
  ).not.toBeChecked();
  expect(screen.getByText("acessorias.settingConflict")).toBeInTheDocument();
});
