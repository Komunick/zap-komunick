import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import { sign } from "jsonwebtoken";
import request from "supertest";
import AppError from "../../errors/AppError";
import { getWhatsAppProxyAgent } from "../../helpers/WhatsAppProxyAgent";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import whatsappSessionRoutes from "../../routes/whatsappSessionRoutes";
import { StartWhatsAppSession } from "../../services/WbotServices/StartWhatsAppSession";
import { sendWhatsappUpdate } from "../../services/WhatsappService/SocketSendWhatsappUpdate";

jest.mock("../../config/auth", () => ({ secret: "fictional-qr-signing-key" }));
jest.mock("../../helpers/WhatsAppProxyAgent", () => ({
  getWhatsAppProxyAgent: jest.fn()
}));
jest.mock("../../libs/socket", () => ({}));
jest.mock("../../libs/wbot", () => ({}));
jest.mock("../../models/BaileysKeys", () => ({}));
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/Whatsapp", () => ({
  findOne: jest.fn(),
  update: jest.fn()
}));
jest.mock(
  "../../services/WbotServices/BuildCaptureExtensionService",
  () => ({})
);
jest.mock(
  "../../services/WbotServices/ImportWhatsAppSessionService",
  () => ({})
);
jest.mock("../../services/WbotServices/StartWhatsAppSession", () => ({
  StartWhatsAppSession: jest.fn()
}));
jest.mock("../../services/WhatsappService/SocketSendWhatsappUpdate", () => ({
  sendWhatsappUpdate: jest.fn()
}));
jest.mock("../../utils/logger", () => ({ logger: { error: jest.fn() } }));

const app = express();
app.use(whatsappSessionRoutes);
app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

const sessionUrl = "/whatsappsession/73";
const qrUrl = `${sessionUrl}/qr`;
const channel = { id: 73, companyId: 21, channel: "whatsapp" };
const token = sign(
  { id: "105", companyId: channel.companyId, profile: "admin" },
  "fictional-qr-signing-key"
);
const findChannel = Whatsapp.findOne as jest.Mock;
const updateChannel = Whatsapp.update as jest.Mock;
const start = StartWhatsAppSession as jest.Mock;

beforeEach(() => {
  (User.findByPk as jest.Mock).mockResolvedValue({ profile: "admin" });
  findChannel.mockResolvedValue(null);
  updateChannel.mockReset();
  start.mockReset();
});

describe("WhatsApp pairing QR routes", () => {
  it.each([
    ["get", qrUrl],
    ["put", sessionUrl]
  ] as const)(
    "requires authentication and a current admin for %s",
    async (method, url) => {
      expect((await request(app)[method](url)).status).toBe(401);

      (User.findByPk as jest.Mock).mockResolvedValue({ profile: "user" });
      const denied = await request(app)
        [method](url)
        .auth(token, { type: "bearer" });
      expect(denied.status).toBe(403);
      expect(findChannel).not.toHaveBeenCalled();
      expect(updateChannel).not.toHaveBeenCalled();
    }
  );

  it.each([
    ["qrcode", "fictional-pairing-code"],
    ["passkey_required", null],
    ["DISCONNECTED", null]
  ])(
    "returns only the scoped QR representation for %s",
    async (status, qrcode) => {
      findChannel.mockResolvedValue({
        status,
        qrcode: "fictional-pairing-code",
        session: "fictional-session-secret"
      });

      const response = await request(app)
        .get(qrUrl)
        .auth(token, { type: "bearer" });

      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("private, no-store");
      expect(response.body).toEqual({ status, qrcode });
      expect(findChannel).toHaveBeenCalledWith({
        attributes: ["status", "qrcode"],
        where: channel
      });
    }
  );

  it.each([
    ["get", qrUrl],
    ["put", sessionUrl]
  ] as const)(
    "cannot access a channel outside the WhatsApp company scope via %s",
    async (method, url) => {
      const response = await request(app)
        [method](url)
        .auth(token, { type: "bearer" });

      expect(response.status).toBe(404);
      expect(findChannel).toHaveBeenCalledWith(
        expect.objectContaining({ where: channel })
      );
      expect(updateChannel).not.toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
    }
  );

  it("rejects a connected channel and an invalid proxy before mutation", async () => {
    findChannel.mockResolvedValue({ status: "CONNECTED" });
    expect(
      (await request(app).put(sessionUrl).auth(token, { type: "bearer" }))
        .status
    ).toBe(409);

    findChannel.mockResolvedValue({ status: "DISCONNECTED" });
    (getWhatsAppProxyAgent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("Fictional proxy failure");
    });
    expect(
      (await request(app).put(sessionUrl).auth(token, { type: "bearer" }))
        .status
    ).toBe(503);

    expect(updateChannel).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it("claims a disconnected channel once and returns before pairing completes", async () => {
    const opening = { ...channel, status: "OPENING", updatedAt: new Date() };
    findChannel.mockResolvedValue({ status: "DISCONNECTED" });
    updateChannel
      .mockResolvedValueOnce([1, [opening]])
      .mockResolvedValueOnce([0, []]);
    start.mockReturnValue(new Promise(() => {}));

    const response = await request(app)
      .put(sessionUrl)
      .auth(token, { type: "bearer" });
    const duplicate = await request(app)
      .put(sessionUrl)
      .auth(token, { type: "bearer" });

    expect(response.status).toBe(200);
    expect(duplicate.status).toBe(409);
    expect(updateChannel).toHaveBeenCalledWith(
      { status: "OPENING", session: "", qrcode: "" },
      { where: { ...channel, status: "DISCONNECTED" }, returning: true }
    );
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(opening, channel.companyId, false, {
      propagateErrors: true
    });
  });

  it("releases only the claimed attempt after a startup failure", async () => {
    const updatedAt = new Date("2026-01-01T12:00:00Z");
    const opening = { ...channel, status: "OPENING", updatedAt };
    const failed = { ...channel, status: "DISCONNECTED" };
    findChannel.mockResolvedValue(failed);
    updateChannel
      .mockResolvedValueOnce([1, [opening]])
      .mockResolvedValueOnce([1, [failed]]);
    start.mockRejectedValue(new Error("Fictional startup failure"));

    const response = await request(app)
      .put(sessionUrl)
      .auth(token, { type: "bearer" });

    expect(response.status).toBe(200);
    expect(updateChannel).toHaveBeenLastCalledWith(
      { status: "DISCONNECTED" },
      { where: { ...channel, status: "OPENING", updatedAt }, returning: true }
    );
    expect(sendWhatsappUpdate).toHaveBeenCalledWith(failed);
  });
});
