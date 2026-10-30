import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import ChatList from "./ChatList";
import { createKomunickTheme } from "../../theme/komunick";

jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
const people = [
  { id: 7, name: "Ator fictício" },
  { id: 8, name: "Colega fictício", email: "colega@fixture.local.test" }
];
const direct = {
  id: 101,
  uuid: "fixture-direct",
  isDirect: true,
  users: [{ userId: 7 }, { userId: 8 }],
  lastMessage: ""
};
function Fixture() {
  const [search, setSearch] = useState("");
  return (
    <ThemeProvider theme={createKomunickTheme({ mode: "light" })}>
      <ChatList
        chats={[direct]}
        contacts={people}
        user={{ id: 7 }}
        activeUuid={direct.uuid}
        search={search}
        onSearch={setSearch}
        onSelectChat={jest.fn()}
        onSelectContact={jest.fn()}
      />
    </ThemeProvider>
  );
}

test("an empty active direct conversation marks its person selected", () => {
  render(<Fixture />);
  expect(
    screen.getByRole("button", { name: /Colega fictício/ })
  ).toHaveAttribute("aria-pressed", "true");
});

test("search has an empty result and clearing returns focus and the available person", () => {
  render(<Fixture />);
  const search = screen.getByRole("textbox", { name: "chatPage.search" });
  fireEvent.change(search, {
    target: { value: "Pessoa inexistente na simulação" }
  });
  expect(screen.getByText("chatPage.noResults")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Colega fictício/ })
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "chatPage.clearSearch" }));
  expect(search).toHaveValue("");
  expect(search).toHaveFocus();
  expect(
    screen.getByRole("button", { name: /Colega fictício/ })
  ).toBeInTheDocument();
});
