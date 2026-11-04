import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CompanyCredentialSettings from "./index";
import api from "../../services/api";

jest.mock("../../services/api", () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));
jest.mock("../../translate/i18n", () => ({
  i18n: { t: key => key, exists: () => false }
}));

const status = {
  configured: true,
  migrationPending: false,
  masterKeyConfigured: true
};
const field = () => screen.getByLabelText("settings.credentials.aiKey");
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.get.mockResolvedValue({ data: status });
});

test("configured key remains empty and is never hydrated from a response", async () => {
  api.get.mockResolvedValue({
    data: { ...status, value: "fictitious-canary" }
  });
  render(<CompanyCredentialSettings />);
  await screen.findByText("settings.credentials.configured");
  expect(field()).toHaveValue("");
  expect(field()).toHaveAttribute("type", "password");
  expect(
    screen.queryByDisplayValue("fictitious-canary")
  ).not.toBeInTheDocument();
});

test("blur never writes; explicit save runs once and clears the replacement value", async () => {
  const pending = deferred();
  api.put.mockReturnValue(pending.promise);
  render(<CompanyCredentialSettings />);
  await screen.findByText("settings.credentials.configured");
  fireEvent.change(field(), { target: { value: " fictitious-new-key " } });
  fireEvent.blur(field());
  expect(api.put).not.toHaveBeenCalled();
  const button = screen.getByRole("button", {
    name: "settings.credentials.save"
  });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(api.put).toHaveBeenCalledTimes(1);
  expect(api.put).toHaveBeenCalledWith("/credentials/openAiKey", {
    value: "fictitious-new-key"
  });
  await act(async () => pending.resolve({ data: status }));
  expect(field()).toHaveValue("");
  expect(button).toBeDisabled();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});

test("failed replacement preserves the draft and hides request details", async () => {
  api.put.mockRejectedValue({
    response: { data: { error: "contains-fictitious-secret" } }
  });
  render(<CompanyCredentialSettings />);
  await screen.findByText("settings.credentials.configured");
  fireEvent.change(field(), { target: { value: "replacement" } });
  fireEvent.click(
    screen.getByRole("button", { name: "settings.credentials.save" })
  );
  await screen.findByText("settings.credentials.requestError");
  expect(field()).toHaveValue("replacement");
  expect(
    screen.queryByText("contains-fictitious-secret")
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("settings.credentials.configured")
  ).toBeInTheDocument();
});

test("missing server protection prevents writes but allows confirmed removal", async () => {
  api.get.mockResolvedValue({
    data: { ...status, migrationPending: true, masterKeyConfigured: false }
  });
  api.delete.mockResolvedValue({
    data: { configured: false, masterKeyConfigured: false }
  });
  render(<CompanyCredentialSettings />);
  await screen.findByText("settings.credentials.migrationPending");
  expect(field()).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "settings.credentials.save" })
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "settings.credentials.migrate" })
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "settings.credentials.remove" })
  );
  await screen.findByText("settings.credentials.removeWarning");
  expect(api.delete).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "settings.credentials.confirmRemove" })
  );
  await screen.findByText("settings.credentials.notConfigured");
  expect(api.delete).toHaveBeenCalledWith("/credentials/openAiKey");
});

test("legacy migration refreshes status without retrieving a stored value", async () => {
  api.get.mockResolvedValueOnce({
    data: { ...status, migrationPending: true }
  });
  api.post.mockResolvedValue({ data: {} });
  render(<CompanyCredentialSettings />);
  await screen.findByText("settings.credentials.migrationPending");
  fireEvent.click(
    screen.getByRole("button", { name: "settings.credentials.migrate" })
  );
  await screen.findByText("settings.credentials.configured");
  expect(api.post).toHaveBeenCalledWith("/credentials/migrate");
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(field()).toHaveValue("");
});

test("failed status request keeps the field and writes disabled", async () => {
  api.get.mockRejectedValue(new Error("offline"));
  render(<CompanyCredentialSettings />);
  await screen.findByRole("alert");
  expect(
    screen.getByText("settings.credentials.unavailable")
  ).toBeInTheDocument();
  expect(field()).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "settings.credentials.save" })
  ).toBeDisabled();
  expect(api.put).not.toHaveBeenCalled();
});
