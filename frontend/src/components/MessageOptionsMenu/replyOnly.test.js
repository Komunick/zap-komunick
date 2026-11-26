import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageOptionsMenu from "./index";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";

jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn()
}));
jest.mock("../MessageHistoryModal", () => () => null);
jest.mock("../MessageForwardModal", () => () => null);
jest.mock("../ConfirmationModal", () => () => null);
jest.mock("emoji-mart", () => ({ Picker: () => null }));

// One of her own messages, edited, with a WhatsApp payload: every action of
// the menu applies to it.
const message = {
  id: "m1",
  ticketId: 303,
  fromMe: true,
  isEdited: true,
  remoteJid: "5500000000111@s.whatsapp.net",
  dataJson: "{}"
};

const open = props => {
  const setReplyingMessage = jest.fn();
  render(
    <ReplyMessageContext.Provider
      value={{ replyingMessage: null, setReplyingMessage }}
    >
      <MessageOptionsMenu
        message={message}
        data={{ message: { conversation: "oi" } }}
        menuOpen
        handleClose={jest.fn()}
        anchorEl={document.body}
        {...props}
      />
    </ReplyMessageContext.Provider>
  );
  return { setReplyingMessage };
};

const ACTIONS = [
  "messageOptionsMenu.delete",
  "messageOptionsMenu.edit",
  "messageOptionsMenu.history",
  "messageOptionsMenu.forward"
];

test("a message of the open ticket keeps every action", () => {
  open();
  ACTIONS.forEach(action =>
    expect(screen.getByText(action)).toBeInTheDocument()
  );
  expect(screen.getByText("messageOptionsMenu.reply")).toBeInTheDocument();
  expect(screen.getByText("👍")).toBeInTheDocument();
  expect(
    screen.queryByText("messageOptionsMenu.otherSectorReplyOnly")
  ).not.toBeInTheDocument();
});

// The history shows what her sector exchanged on a ticket that is now in
// another sector. The server refuses to react, edit, delete, forward and show
// the edit history there: the menu does not offer what can only fail.
test("a message of a ticket in another sector can only be quoted in a reply", () => {
  const { setReplyingMessage } = open({ replyOnly: true });
  ACTIONS.forEach(action =>
    expect(screen.queryByText(action)).not.toBeInTheDocument()
  );
  expect(screen.queryByText("👍")).not.toBeInTheDocument();
  expect(screen.queryByText("+")).not.toBeInTheDocument();
  expect(
    screen.getByText("messageOptionsMenu.otherSectorReplyOnly")
  ).toBeInTheDocument();

  fireEvent.click(screen.getByText("messageOptionsMenu.reply"));
  expect(setReplyingMessage).toHaveBeenCalledWith(message);
});
