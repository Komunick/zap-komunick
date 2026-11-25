import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import UpdateNotice from ".";
import { komunickMessages } from "../../translate/languages/komunick";

jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));

// By default a newer version is published; `available: false` says it is not.
const page = (onReload, props) => (
  <div>
    <textarea aria-label="reply" />
    <UpdateNotice available onReload={onReload} {...props} />
  </div>
);

const renderNotice = (props = {}) => {
  const onReload = jest.fn();
  const view = render(page(onReload, props));
  return {
    ...view,
    onReload,
    update: next => view.rerender(page(onReload, next))
  };
};

const button = () =>
  screen.getByRole("button", { name: "updateNotice.buttonLabel" });

// The click-away listener of the card only arms itself a tick after it
// mounts, like in a real browser, where a person cannot click that fast.
const tick = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

it("shows nothing while the page runs the published version", () => {
  renderNotice({ available: false });
  expect(screen.queryByTestId("update-notice")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("shows the button when a newer version was published", () => {
  renderNotice();
  expect(button()).toHaveTextContent("updateNotice.button");
  // a polite notice, never an alert that interrupts a screen reader
  expect(screen.getByTestId("update-notice")).toHaveAttribute("role", "status");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  // the details stay closed until the person asks
  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();
});

it("never takes the keyboard from someone who is typing", () => {
  const { update, onReload } = renderNotice({ available: false });
  const reply = screen.getByLabelText("reply");
  reply.focus();
  fireEvent.change(reply, { target: { value: "Bom dia, segue o bol" } });

  // the new version is published while the person types
  update({ available: true });

  expect(button()).toBeInTheDocument();
  expect(reply).toHaveFocus();
  expect(reply).toHaveValue("Bom dia, segue o bol");
  // Enter keeps belonging to the reply, and nothing reloads by itself
  fireEvent.keyDown(reply, { key: "Enter" });
  expect(onReload).not.toHaveBeenCalled();
});

it("tells what is kept and what is lost before reloading, only on a click", () => {
  const { onReload } = renderNotice();

  fireEvent.click(button());
  expect(button()).toHaveAttribute("aria-expanded", "true");
  ["title", "text", "kept", "lost"].forEach(key =>
    expect(screen.getByText(`updateNotice.${key}`)).toBeInTheDocument()
  );
  // the card is not a modal: no dialog, no backdrop, the page stays usable
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
  expect(onReload).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "updateNotice.now" }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

it('closes with "Depois" and keeps the button in the bar', () => {
  const { onReload } = renderNotice();
  fireEvent.click(button());
  fireEvent.click(screen.getByRole("button", { name: "updateNotice.later" }));

  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();
  expect(button()).toHaveAttribute("aria-expanded", "false");
  expect(onReload).not.toHaveBeenCalled();
});

it("opens and closes on its own button, and closes on a click elsewhere", async () => {
  renderNotice();

  fireEvent.click(button());
  expect(screen.getByText("updateNotice.title")).toBeInTheDocument();
  await tick();
  // the click on the button itself is not a "click away" that reopens it
  fireEvent.click(button());
  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();

  fireEvent.click(button());
  expect(screen.getByText("updateNotice.title")).toBeInTheDocument();
  await tick();
  // a click inside the card keeps it open
  fireEvent.click(screen.getByText("updateNotice.kept"));
  expect(screen.getByText("updateNotice.title")).toBeInTheDocument();
  // a click anywhere else closes it
  fireEvent.click(screen.getByLabelText("reply"));
  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();
});

it("keeps the card right after the button for the keyboard, and closes it with Esc", () => {
  renderNotice();
  fireEvent.click(button());

  // the card lives inside the notice, not at the end of the page
  const notice = screen.getByTestId("update-notice");
  const now = screen.getByRole("button", { name: "updateNotice.now" });
  expect(notice).toContainElement(now);
  expect(
    button().compareDocumentPosition(now) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();

  now.focus();
  fireEvent.keyDown(now, { key: "Escape" });
  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();
  expect(button()).toHaveFocus();
});

it("leaves Esc alone while the card is closed", () => {
  renderNotice();
  const onKeyDown = jest.fn();
  document.addEventListener("keydown", onKeyDown);
  button().focus();
  fireEvent.keyDown(button(), { key: "Escape" });
  // the key goes on to whoever else wants it
  expect(onKeyDown).toHaveBeenCalledTimes(1);
  document.removeEventListener("keydown", onKeyDown);
});

it("stays out of the way while the tour is on screen", () => {
  const { update } = renderNotice();
  fireEvent.click(button());
  expect(screen.getByText("updateNotice.title")).toBeInTheDocument();

  update({ hidden: true });
  expect(screen.queryByTestId("update-notice")).not.toBeInTheDocument();
  expect(screen.queryByText("updateNotice.title")).not.toBeInTheDocument();

  // and comes back closed when the tour ends
  update({ hidden: false });
  expect(button()).toHaveAttribute("aria-expanded", "false");
});

it.each(["pt", "pt_PT", "en", "es"])("has every text in %s", language => {
  const texts = komunickMessages[language].translations.updateNotice;
  [
    "button",
    "buttonLabel",
    "title",
    "text",
    "kept",
    "lost",
    "later",
    "now"
  ].forEach(key => expect(texts[key].trim()).not.toBe(""));
});
