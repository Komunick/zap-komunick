import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import ScheduleModal from ".";

jest.mock("../../services/api", () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn()
}));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../context/Auth/AuthContext", () => ({
  AuthContext: require("react").createContext()
}));

const fiscal = { id: 14, name: "Fila Fiscal" };
const pessoal = { id: 15, name: "Fila Pessoal" };
const contact = { id: 16, name: "Contato Fictício" };
const user = { id: 4, companyId: 8, profile: "admin", queues: [] };

function renderModal(props = {}, actor = user) {
  const onClose = jest.fn();
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user: actor }}>
        <ScheduleModal open onClose={onClose} {...props} />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return { onClose };
}

const getBody = () =>
  screen.getAllByRole("textbox").find(input => input.name === "body");

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(async path => {
    if (path === "/queue") return { data: [fiscal, pessoal] };
    if (path === "/contacts/list") return { data: [contact] };
    if (path === "/tags/list") return { data: [] };
    if (path === "/schedules/23" || path === "/schedules/24")
      return {
        data: {
          id: Number(path.split("/").pop()),
          ticketId: 34,
          queueId: path === "/schedules/23" ? fiscal.id : null,
          contactId: contact.id,
          contact,
          body: "Mensagem existente",
          sendAt: "2030-03-01T17:45:00Z",
          sentAt: null,
          status: "PENDENTE"
        }
      };
    throw new Error(`Unexpected request: ${path}`);
  });
  api.post.mockResolvedValue({ data: [] });
  api.put.mockResolvedValue({ data: {} });
});

it("sends the selected queue with standalone recipients and keeps the draft on an unavailable channel", async () => {
  const apiError = new Error("ERR_NO_CONNECTED_WHATSAPP_FOR_QUEUE");
  api.post.mockRejectedValueOnce(apiError);
  const { onClose } = renderModal({ contactId: contact.id });
  await screen.findByText(contact.name);
  const body = getBody();
  fireEvent.change(body, { target: { value: "Mensagem fictícia" } });
  const submit = screen.getByRole("button", { name: "Adicionar" });
  expect(submit).toBeDisabled();
  fireEvent.mouseDown(screen.getByRole("button", { name: /Fila/ }));
  fireEvent.click(within(screen.getByRole("listbox")).getByText(pessoal.name));
  fireEvent.click(submit);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/schedules",
      expect.objectContaining({
        queueId: pessoal.id,
        contactIds: [contact.id],
        tagId: null
      })
    )
  );
  await waitFor(() => expect(toastError).toHaveBeenCalledWith(apiError));
  expect(body).toHaveValue("Mensagem fictícia");
  expect(onClose).not.toHaveBeenCalled();
});

it("preselects a regular user's sole queue without loading the company queue list", async () => {
  renderModal(
    { contactId: contact.id },
    { ...user, profile: "user", queues: [fiscal] }
  );
  await screen.findByText(contact.name);
  const body = getBody();
  fireEvent.change(body, { target: { value: "Mensagem fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/schedules",
      expect.objectContaining({
        queueId: fiscal.id
      })
    )
  );
  expect(api.get).not.toHaveBeenCalledWith("/queue");
});

it("sends a singular ticket/contact route and displays them as fixed for a new schedule", async () => {
  renderModal({
    ticketId: 34,
    ticketQueueId: fiscal.id,
    ticketQueueName: fiscal.name,
    contactId: contact.id,
    contactName: contact.name
  });
  const queueField = await screen.findByLabelText("Fila");
  expect(queueField).toHaveValue(fiscal.name);
  expect(queueField).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Contato")).toHaveValue(contact.name);
  expect(screen.getByLabelText("Contato")).toHaveAttribute("readonly");
  fireEvent.change(getBody(), { target: { value: "Mensagem fictícia" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/schedules",
      expect.objectContaining({
        ticketId: 34,
        queueId: fiscal.id,
        contactId: contact.id
      })
    )
  );
  expect(api.post.mock.calls[0][1]).not.toHaveProperty("contactIds");
  expect(api.post.mock.calls[0][1]).not.toHaveProperty("tagId");
});

it("preserves the existing ticket route when saving a linked schedule", async () => {
  renderModal({ scheduleId: 23 });
  const body = await screen.findByDisplayValue("Mensagem existente");
  expect(screen.getByLabelText("Fila")).toHaveValue(fiscal.name);
  expect(screen.getByLabelText("Contato")).toHaveValue(contact.name);
  fireEvent.change(body, { target: { value: "Mensagem editada" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/schedules/23",
      expect.objectContaining({
        ticketId: 34,
        queueId: fiscal.id,
        contactId: contact.id,
        body: "Mensagem editada"
      })
    )
  );
});

it("lets the server resolve the queue when editing a legacy ticket schedule", async () => {
  renderModal({ scheduleId: 24 });
  await screen.findByDisplayValue("Mensagem existente");
  expect(screen.getByLabelText("Fila")).toHaveValue("Fila do atendimento");
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/schedules/24",
      expect.objectContaining({
        ticketId: 34,
        contactId: contact.id
      })
    )
  );
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("queueId");
});
