import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@material-ui/core/styles";
import { createKomunickTheme } from "../../theme/komunick";
import api from "../../services/api";
import TicketPreviewDialog from ".";

jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));

const ticket = {
  id: 301,
  status: "pending",
  contact: { name: "Contato fictício" }
};

const conversation = Array.from({ length: 40 }, (_, index) => ({
  id: `m${index + 1}`,
  fromMe: index % 2 === 1,
  createdAt: new Date(Date.UTC(2026, 10, 17, 12, index)).toISOString(),
  kind: "text",
  text: `Mensagem fictícia ${index + 1}`
}));

const renderDialog = (props = {}) =>
  render(
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <TicketPreviewDialog
        ticket={ticket}
        onClose={jest.fn()}
        onAccept={jest.fn()}
        {...props}
      />
    </ThemeProvider>
  );

beforeEach(() => {
  jest.resetAllMocks();
});

test("shows every message of the pending conversation in a scrollable log", async () => {
  api.get.mockResolvedValue({
    data: { messages: conversation, truncated: false }
  });

  renderDialog();

  expect(await screen.findByText("Mensagem fictícia 1")).toBeTruthy();
  expect(screen.getByText("Mensagem fictícia 40")).toBeTruthy();
  const log = screen.getByRole("log");
  expect(log.children).toHaveLength(40);
  expect(log.style.overflowY || getComputedStyle(log).overflowY).toBe("auto");
  expect(screen.getAllByText(/ticketPreview\.sent/)).toHaveLength(20);
  expect(screen.queryByText("ticketPreview.truncated")).toBeNull();
  expect(api.put).not.toHaveBeenCalled();
});

test("labels attachments and warns when the conversation was capped", async () => {
  api.get.mockResolvedValue({
    data: {
      truncated: true,
      messages: [
        { id: "a", fromMe: false, kind: "audio", text: "" },
        { id: "b", fromMe: false, kind: "image", text: "Legenda fictícia" }
      ]
    }
  });

  renderDialog();

  expect(await screen.findByText("ticketPreview.kinds.audio")).toBeTruthy();
  expect(screen.getByText("ticketPreview.kinds.image")).toBeTruthy();
  expect(screen.getByText("Legenda fictícia")).toBeTruthy();
  expect(screen.getByText("ticketPreview.truncated")).toBeTruthy();
});

test("accepting is the only action that leaves the preview", async () => {
  const onAccept = jest.fn();
  api.get.mockResolvedValue({ data: { messages: conversation.slice(0, 2) } });

  renderDialog({ onAccept });
  await screen.findByText("Mensagem fictícia 2");

  expect(onAccept).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "ticketPreview.accept" }));
  expect(onAccept).toHaveBeenCalledTimes(1);
  expect(api.put).not.toHaveBeenCalled();
});

test("still reads the single preview of an older backend", async () => {
  api.get.mockResolvedValue({
    data: { preview: { kind: "text", text: "Mensagem antiga fictícia" } }
  });

  renderDialog();

  expect(await screen.findByText("Mensagem antiga fictícia")).toBeTruthy();
});

test("an empty conversation says so", async () => {
  api.get.mockResolvedValue({ data: { messages: [], truncated: false } });

  renderDialog();

  expect(await screen.findByText("ticketPreview.empty")).toBeTruthy();
});
