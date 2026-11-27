import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import TicketActionButtonsCustom from "./index";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import { PhoneCallContext } from "../../context/PhoneCall/PhoneCallContext";
import api from "../../services/api";
import toastError from "../../errors/toastError";

jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../TicketOptionsMenu", () => () => null);
jest.mock("../TransferTicketModalCustom", () => () => null);
jest.mock("../../helpers/wavoipCallManager", () => ({
  wavoipAvailable: jest.fn().mockResolvedValue(false),
  wavoipCall: jest.fn()
}));
// the window itself has its own test: here, what the button hands to it
jest.mock(
  "../CloseTicketModal",
  () =>
    ({ open, askReason, completionMessage }) =>
      open ? (
        <div data-testid="close-window">
          {JSON.stringify({ askReason, completionMessage })}
        </div>
      ) : null
);

let mockSettings;
jest.mock("../../hooks/useSettings", () => () => ({
  getSetting: async (key, fallback) => mockSettings[key] ?? fallback
}));

const MESSAGE = "*Seu atendimento será finalizado.*";
const openTicket = {
  id: 301,
  status: "open",
  isGroup: false,
  contact: { name: "Cliente" }
};

const tree = (ticket = openTicket) => (
  <MemoryRouter>
    <AuthContext.Provider value={{ user: { id: 101, profile: "user" } }}>
      <TicketsContext.Provider value={{ setCurrentTicket: jest.fn() }}>
        <PhoneCallContext.Provider value={{}}>
          <TicketActionButtonsCustom ticket={ticket} />
        </PhoneCallContext.Provider>
      </TicketsContext.Provider>
    </AuthContext.Provider>
  </MemoryRouter>
);
const renderButtons = ticket => render(tree(ticket));

const finish = async () => {
  // the options of the office are read when the buttons appear
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /finish/ })).toBeEnabled()
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  fireEvent.click(screen.getByRole("button", { name: /finish/ }));
};
const windowProps = async () =>
  JSON.parse((await screen.findByTestId("close-window")).textContent);

beforeEach(() => {
  mockSettings = {};
  api.get.mockReset();
  api.put.mockReset();
  api.put.mockResolvedValue({ data: {} });
  toastError.mockReset();
});

test("without any question, Finish finishes at once, as it always did", async () => {
  renderButtons();
  await finish();
  await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
  expect(api.put).toHaveBeenCalledWith("/tickets/301", {
    status: "closed",
    userId: 101
  });
  // nobody asked the server about a completion message
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByTestId("close-window")).not.toBeInTheDocument();
});

describe("the office asks whoever finishes about the completion message", () => {
  beforeEach(() => {
    mockSettings.completionMessagePrompt = "enabled";
  });

  test("Finish opens the window with the text the server says the client would receive", async () => {
    api.get.mockResolvedValue({ data: { ask: true, message: MESSAGE } });
    renderButtons();
    await finish();
    expect(await windowProps()).toEqual({
      askReason: false,
      completionMessage: MESSAGE
    });
    expect(api.get).toHaveBeenCalledWith("/tickets/301/completion");
    // nothing was finished, or sent, by the click alone
    expect(api.put).not.toHaveBeenCalled();
  });

  test("when there is nothing to send for this ticket, Finish finishes at once", async () => {
    api.get.mockResolvedValue({ data: { ask: false, message: null } });
    renderButtons();
    await finish();
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith("/tickets/301", {
      status: "closed",
      userId: 101
    });
    expect(screen.queryByTestId("close-window")).not.toBeInTheDocument();
  });

  test("with a reason required too, one window asks both", async () => {
    mockSettings.closeReasonRequired = "enabled";
    api.get.mockResolvedValue({ data: { ask: true, message: MESSAGE } });
    renderButtons();
    await finish();
    expect(await windowProps()).toEqual({
      askReason: true,
      completionMessage: MESSAGE
    });
  });

  test("if the server cannot say, nothing is finished and the error is shown", async () => {
    api.get.mockRejectedValue(new Error("network"));
    renderButtons();
    await finish();
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(api.put).not.toHaveBeenCalled();
    expect(screen.queryByTestId("close-window")).not.toBeInTheDocument();
  });

  test("the window closes when the ticket is finished somewhere else", async () => {
    api.get.mockResolvedValue({ data: { ask: true, message: MESSAGE } });
    const view = renderButtons();
    await finish();
    await screen.findByTestId("close-window");
    view.rerender(tree({ ...openTicket, status: "closed" }));
    await waitFor(() =>
      expect(screen.queryByTestId("close-window")).not.toBeInTheDocument()
    );
    expect(api.put).not.toHaveBeenCalled();
  });

  test("the option is read at the click, not when the conversation opened", async () => {
    mockSettings.completionMessagePrompt = "disabled";
    api.get.mockResolvedValue({ data: { ask: true, message: MESSAGE } });
    renderButtons();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /finish/ })).toBeEnabled()
    );
    // the administrator turns the question on with the conversation on screen
    mockSettings.completionMessagePrompt = "enabled";
    fireEvent.click(screen.getByRole("button", { name: /finish/ }));
    expect(await windowProps()).toEqual({
      askReason: false,
      completionMessage: MESSAGE
    });
    expect(api.put).not.toHaveBeenCalled();
  });

  test("a group is never asked", async () => {
    renderButtons({ ...openTicket, isGroup: true });
    await finish();
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.get).not.toHaveBeenCalled();
  });
});

test("only the reason required: the window asks the reason, as before", async () => {
  mockSettings.closeReasonRequired = "enabled";
  renderButtons();
  await finish();
  expect(await windowProps()).toEqual({
    askReason: true,
    completionMessage: null
  });
  expect(api.get).not.toHaveBeenCalled();
});
