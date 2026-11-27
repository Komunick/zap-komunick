import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CloseTicketModal from "./index";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";

jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../errors/toastError", () => jest.fn());

const MESSAGE =
  "*Seu atendimento será finalizado.*\nSempre que precisar não hesite em nos contatar.";
const ticket = { id: 301, contact: { name: "Cliente" } };

const open = props => {
  const onClose = jest.fn();
  const onClosed = jest.fn();
  render(
    <AuthContext.Provider value={{ user: { id: 101 } }}>
      <CloseTicketModal
        open
        ticket={ticket}
        onClose={onClose}
        onClosed={onClosed}
        {...props}
      />
    </AuthContext.Provider>
  );
  return { onClose, onClosed };
};

// the field of the reason: a MUI select, which has no accessible name here
const reasonField = async () => {
  await waitFor(() =>
    expect(document.querySelector('[aria-haspopup="listbox"]')).not.toBeNull()
  );
  return document.querySelector('[aria-haspopup="listbox"]');
};

const sent = () => api.put.mock.calls.map(([url, body]) => ({ url, body }));

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
  api.get.mockResolvedValue({ data: [{ id: 7, name: "Dúvida resolvida" }] });
  api.put.mockResolvedValue({ data: {} });
});

describe("the office asks whether the client receives the completion message", () => {
  test("shows the text the client would receive and no single finish button", () => {
    open({ askReason: false, completionMessage: MESSAGE });

    expect(screen.getByText("closeCompletion.question")).toBeInTheDocument();
    expect(screen.getByTestId("completion-preview")).toHaveTextContent(
      "Seu atendimento será finalizado."
    );
    expect(
      screen.getByRole("button", { name: "closeCompletion.withoutMessage" })
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "closeCompletion.withMessage" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "closeReasons.modal.confirm" })
    ).not.toBeInTheDocument();
    // the reasons are not asked, so they are not even loaded
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText("closeCompletion.subtitle")).toBeInTheDocument();
  });

  test("the button that sends is never the one in focus", () => {
    open({ askReason: false, completionMessage: MESSAGE });
    expect(
      screen.getByRole("button", { name: "closeCompletion.withoutMessage" })
    ).toHaveFocus();
  });

  test("finishing with the message says so, explicitly", async () => {
    const { onClose, onClosed } = open({
      askReason: false,
      completionMessage: MESSAGE
    });
    fireEvent.click(
      screen.getByRole("button", { name: "closeCompletion.withMessage" })
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual([
      {
        url: "/tickets/301",
        body: { status: "closed", userId: 101, sendCompletion: true }
      }
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("finishing without the message says no, explicitly", async () => {
    const { onClosed } = open({ askReason: false, completionMessage: MESSAGE });
    fireEvent.click(
      screen.getByRole("button", { name: "closeCompletion.withoutMessage" })
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(sent()).toEqual([
      {
        url: "/tickets/301",
        body: { status: "closed", userId: 101, sendCompletion: false }
      }
    ]);
  });

  test("the choice that sends is neither the strong button nor the last one", () => {
    open({ askReason: false, completionMessage: MESSAGE });
    const buttons = screen
      .getAllByRole("button")
      .map(button => button.textContent);
    expect(buttons).toEqual([
      "closeReasons.modal.cancel",
      "closeCompletion.withMessage",
      "closeCompletion.withoutMessage"
    ]);
    expect(
      screen.getByRole("button", { name: "closeCompletion.withoutMessage" })
        .className
    ).toMatch(/contained/);
    expect(
      screen.getByRole("button", { name: "closeCompletion.withMessage" })
        .className
    ).toMatch(/outlined/);
  });

  test("a second click while it saves does not finish, or send, twice", async () => {
    let release;
    api.put.mockReturnValue(
      new Promise(resolve => {
        release = () => resolve({ data: {} });
      })
    );
    const { onClosed } = open({ askReason: false, completionMessage: MESSAGE });
    const withMessage = screen.getByRole("button", {
      name: "closeCompletion.withMessage"
    });
    fireEvent.click(withMessage);
    fireEvent.click(withMessage);
    fireEvent.click(
      screen.getByRole("button", { name: "closeCompletion.withoutMessage" })
    );
    release();
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledTimes(1);
  });

  test("with a reason required too, both questions are answered in the same window", async () => {
    const { onClosed } = open({ askReason: true, completionMessage: MESSAGE });
    const withMessage = screen.getByRole("button", {
      name: "closeCompletion.withMessage"
    });
    const without = screen.getByRole("button", {
      name: "closeCompletion.withoutMessage"
    });
    // no reason picked yet: neither way of finishing is available
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/close-reasons"));
    expect(withMessage).toBeDisabled();
    expect(without).toBeDisabled();

    fireEvent.mouseDown(await reasonField());
    fireEvent.click(await screen.findByText("Dúvida resolvida"));
    expect(withMessage).toBeEnabled();
    fireEvent.click(withMessage);
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(sent()[0].body).toEqual({
      status: "closed",
      userId: 101,
      closeReasonId: 7,
      closeReasonNote: null,
      sendCompletion: true
    });
  });
});

describe("the office does not ask about the message (how it was)", () => {
  test("asks only the reason, with the single finish button", async () => {
    const { onClosed } = open({});
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/close-reasons"));
    expect(
      screen.queryByText("closeCompletion.question")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("completion-preview")).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", {
      name: "closeReasons.modal.confirm"
    });
    expect(confirm).toBeDisabled();

    fireEvent.mouseDown(await reasonField());
    fireEvent.click(await screen.findByText("Dúvida resolvida"));
    fireEvent.click(confirm);
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(sent()[0].body).toEqual({
      status: "closed",
      userId: 101,
      closeReasonId: 7,
      closeReasonNote: null
    });
  });

  test("the silent finish of the list stays silent", async () => {
    const { onClosed } = open({ justClose: true });
    fireEvent.mouseDown(await reasonField());
    fireEvent.click(await screen.findByText("Dúvida resolvida"));
    fireEvent.click(
      screen.getByRole("button", { name: "closeReasons.modal.confirm" })
    );
    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(sent()[0].body).toMatchObject({ justClose: true });
    expect(sent()[0].body).not.toHaveProperty("sendCompletion");
  });
});
