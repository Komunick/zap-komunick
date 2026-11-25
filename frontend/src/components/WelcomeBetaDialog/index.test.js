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
        "welcomeBeta.highlightTitle": "Encontrou uma falha? Abra um chamado.",
        "welcomeBeta.report": "Qualquer erro pode virar um chamado.",
        "welcomeBeta.stepOpen": "Clique em Suporte.",
        "welcomeBeta.stepDescribe": "Conte o que aconteceu.",
        "welcomeBeta.stepFollow": "Acompanhe a resposta.",
        "welcomeBeta.encourage": "Na dúvida, abra o chamado.",
        "welcomeBeta.thanks": "Obrigado.",
        "welcomeBeta.confirm": "Agora não",
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
  // The call to open a ticket stands out, with the steps and the push to do it.
  const highlight = screen.getByRole("note");
  expect(highlight).toHaveTextContent("Encontrou uma falha? Abra um chamado.");
  expect(highlight).toHaveTextContent("Clique em Suporte.");
  expect(highlight).toHaveTextContent("Conte o que aconteceu.");
  expect(highlight).toHaveTextContent("Acompanhe a resposta.");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Na dúvida, abra o chamado."
  );
  // Opening a ticket is the main button of the notice.
  expect(screen.getByRole("button", { name: "Abrir um chamado" })).toHaveClass(
    "MuiButton-contained"
  );

  fireEvent.click(screen.getByRole("button", { name: "Agora não" }));

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

it("shows the new notice to who had only seen the first version", () => {
  localStorage.setItem(
    "superchat:welcomeBeta:v1:7",
    "2026-11-24T00:00:00.000Z"
  );

  renderDialog(7);

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(welcomeBetaKey(7)).toBe("superchat:welcomeBeta:v2:7");
});

// The feature tour waits for this notice to be out of the way (RF-031).
describe("onSettled", () => {
  const renderWith = (userId, onSettled) =>
    render(
      <MemoryRouter initialEntries={["/tickets"]}>
        <WelcomeBetaDialog userId={userId} onSettled={onSettled} />
      </MemoryRouter>
    );

  it("stays silent while the notice is on screen", () => {
    const onSettled = jest.fn();
    renderWith(7, onSettled);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('tells "dismissed" when the person closes the notice', () => {
    const onSettled = jest.fn();
    renderWith(7, onSettled);
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith("dismissed");
  });

  it('tells "support" when the person goes to open a ticket', () => {
    const onSettled = jest.fn();
    renderWith(7, onSettled);
    fireEvent.click(screen.getByRole("button", { name: "Abrir um chamado" }));
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(onSettled).toHaveBeenCalledWith("support");
    expect(localStorage.getItem(welcomeBetaKey(7))).not.toBeNull();
  });

  it('tells "seen" when the notice was answered on an earlier visit', () => {
    localStorage.setItem(welcomeBetaKey(7), "2026-11-24T12:00:00.000Z");
    const onSettled = jest.fn();
    renderWith(7, onSettled);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSettled).toHaveBeenCalledWith("seen");
  });

  it("says nothing before the user is known", () => {
    const onSettled = jest.fn();
    renderWith(undefined, onSettled);
    expect(onSettled).not.toHaveBeenCalled();
  });
});
