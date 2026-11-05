import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import "@testing-library/jest-dom";
import QrcodeModal from "./index";
import api from "../../services/api";
import { SocketContext } from "../../context/Socket/SocketContext";

jest.mock("../../services/api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../../errors/toastError", () => jest.fn());
jest.mock("../../translate/i18n", () => ({ i18n: { t: key => key } }));
jest.mock("qrcode.react", () => ({ value }) => (
  <div data-testid="qr-code">{value}</div>
));

const sessionEvent = "company-7-whatsappSession";
const qrPath = "/whatsappsession/23/qr";
const firstCode = "fictitious-pairing-code-1";
const nextCode = "fictitious-pairing-code-2";

function renderModal(props = {}) {
  const socket = { on: jest.fn(), disconnect: jest.fn() };
  const onClose = jest.fn();
  const socketManager = { GetSocket: () => socket };
  render(
    <SocketContext.Provider value={socketManager}>
      <QrcodeModal open whatsAppId={23} onClose={onClose} {...props} />
    </SocketContext.Provider>
  );

  const updateSession = session => {
    const [, listener] = socket.on.mock.calls.find(
      ([event]) => event === sessionEvent
    );
    listener({ action: "update", session });
  };

  return { onClose, updateSession };
}

beforeEach(() => {
  jest.resetAllMocks();
  localStorage.setItem("companyId", "7");
});

afterEach(() => {
  localStorage.removeItem("companyId");
  jest.useRealTimers();
});

test("clears an expired code and displays a fresh one after retry", async () => {
  let session = { status: "qrcode", qrcode: firstCode };
  api.get.mockImplementation(async () => ({ data: session }));
  api.put.mockImplementation(async () => {
    session = { status: "qrcode", qrcode: nextCode };
    return { data: {} };
  });
  const { onClose, updateSession } = renderModal();

  expect(await screen.findByTestId("qr-code")).toHaveTextContent(firstCode);
  expect(api.get.mock.calls[0][0]).toBe(qrPath);

  session = { status: "DISCONNECTED", qrcode: null };
  act(() => updateSession({ id: 23, ...session }));
  expect(await screen.findByText("qrCode.expired")).toBeInTheDocument();
  expect(screen.queryByTestId("qr-code")).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(
    screen.getByRole("button", { name: "connections.toolTips.newQr" })
  );
  expect(await screen.findByTestId("qr-code")).toHaveTextContent(nextCode);
  expect(api.put.mock.calls.map(([path]) => path)).toEqual([
    "/whatsappsession/23"
  ]);
});

test("ignores another channel and picks up a missed update by polling", async () => {
  jest.useFakeTimers();
  let session = { status: "qrcode", qrcode: firstCode };
  api.get.mockImplementation(async () => ({ data: session }));
  let modal;
  await act(async () => {
    modal = renderModal();
  });
  expect(screen.getByTestId("qr-code")).toHaveTextContent(firstCode);
  const initialReads = api.get.mock.calls.length;

  act(() => modal.updateSession({ id: 24, status: "CONNECTED", qrcode: null }));
  expect(modal.onClose).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledTimes(initialReads);
  expect(screen.getByTestId("qr-code")).toHaveTextContent(firstCode);

  session = { status: "qrcode", qrcode: nextCode };
  await act(async () => jest.advanceTimersByTime(3000));
  await waitFor(() =>
    expect(screen.getByTestId("qr-code")).toHaveTextContent(nextCode)
  );
});
