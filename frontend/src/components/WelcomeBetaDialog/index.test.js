import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import WelcomeBetaDialog, { welcomeBetaKey } from ".";

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: key =>
      ({
        "welcomeBeta.title": "Boas-vindas ao SuperChat",
        "welcomeBeta.badge": "Versão beta",
        "welcomeBeta.intro": "O SuperChat está em versão beta.",
        "welcomeBeta.report": "Abra um chamado na aba Suporte.",
        "welcomeBeta.thanks": "Obrigado.",
        "welcomeBeta.confirm": "Entendi",
        "welcomeBeta.openReport": "Abrir um chamado"
      })[key] || key
  }
}));

const renderDialog = userId =>
  render(
    <MemoryRouter initialEntries={["/tickets"]}>
      <WelcomeBetaDialog userId={userId} />
      <Route path="/support">
        <p>Tela de suporte</p>
      </Route>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
});

it("welcomes a user who has not seen the notice and remembers the answer", async () => {
  const { unmount } = renderDialog(7);

  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Boas-vindas ao SuperChat"
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("Versão beta");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Abra um chamado na aba Suporte."
  );

  fireEvent.click(screen.getByRole("button", { name: "Entendi" }));

  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  );
  expect(localStorage.getItem(welcomeBetaKey(7))).not.toBeNull();

  unmount();
  renderDialog(7);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows the notice again to another user of the same browser", () => {
  localStorage.setItem(welcomeBetaKey(7), "2026-11-24T00:00:00.000Z");

  renderDialog(8);

  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("waits for the logged-in user", () => {
  renderDialog(undefined);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("opens the support screen from the notice", async () => {
  renderDialog(7);

  fireEvent.click(screen.getByRole("button", { name: "Abrir um chamado" }));

  expect(await screen.findByText("Tela de suporte")).toBeInTheDocument();
  expect(localStorage.getItem(welcomeBetaKey(7))).not.toBeNull();
});
