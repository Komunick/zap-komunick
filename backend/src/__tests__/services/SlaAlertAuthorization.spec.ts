import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import SlaAlert from "../../models/SlaAlert";
import SlaAlertConfiguration from "../../models/SlaAlertConfiguration";
import slaRoutes from "../../routes/slaRoutes";
import { normalizeSlaAlertConfiguration } from "../../services/SlaServices/SlaAlertConfigurationService";

jest.mock("../../config/auth", () => ({ secret: "sla-alert-fictional-key" }));
jest.mock("../../middleware/isCompliant", () => jest.fn());
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({ findAll: jest.fn() }));
jest.mock("../../models/SlaAlert", () => ({
  findAll: jest.fn(),
  count: jest.fn(),
  findOne: jest.fn(),
  sequelize: { transaction: jest.fn() }
}));
jest.mock("../../models/SlaAlertConfiguration", () => ({
  findByPk: jest.fn()
}));

const app = express();
app.use(slaRoutes);
app.use((err, _req: Request, res: Response, _next: NextFunction) =>
  res.status(err.statusCode ?? 500).json({ error: err.message })
);

const token = sign(
  { id: 8, profile: "admin", companyId: 12, super: false },
  "sla-alert-fictional-key"
);
const auth = `Bearer ${token}`;
const transaction = { LOCK: { UPDATE: "UPDATE" } };
const when = new Date("2026-11-13T12:00:00.000Z");

describe("SLA alert privacy and recipient configuration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SlaAlert.sequelize.transaction as jest.Mock).mockImplementation(
      (...args) => args.at(-1)(transaction)
    );
    (User.findOne as jest.Mock).mockResolvedValue({
      profile: "user",
      companyId: 12,
      queues: [{ id: 22, companyId: 12 }]
    });
    (SlaAlert.findAll as jest.Mock).mockResolvedValue([
      { id: 30, ticketId: 1, createdAt: when, readAt: null },
      { id: 31, ticketId: 2, createdAt: when, readAt: null }
    ]);
    (SlaAlert.count as jest.Mock).mockResolvedValue(2);
    (Ticket.findAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        uuid: "own-ticket",
        companyId: 12,
        contactId: 88,
        contact: { companyId: 12, name: "Do not expose" },
        queueId: 22,
        queue: { name: "Atendimento geral" }
      },
      {
        id: 2,
        uuid: "private-ticket",
        companyId: 12,
        contactId: 89,
        contact: { companyId: 12 },
        queueId: 23,
        queue: { name: "Setor privado" }
      }
    ]);
  });

  it("shows only authorized ticket details and sends no customer data", async () => {
    const response = await request(app)
      .get("/sla/alerts")
      .set("Authorization", auth)
      .expect("Cache-Control", "private, no-store")
      .expect(200);
    expect(response.body).toEqual({
      unreadCount: 2,
      alerts: [
        {
          id: 30,
          createdAt: when.toISOString(),
          readAt: null,
          queueName: "Atendimento geral",
          ticketUuid: "own-ticket"
        },
        {
          id: 31,
          createdAt: when.toISOString(),
          readAt: null,
          queueName: null,
          ticketUuid: null
        }
      ]
    });
    expect(SlaAlert.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 12, recipientId: 8 }
      })
    );
  });

  it("scopes mark-read to the authenticated user and company", async () => {
    (SlaAlert.findOne as jest.Mock).mockResolvedValue(null);
    await request(app)
      .put("/sla/alerts/31/read")
      .set("Authorization", auth)
      .expect(404);
    expect(SlaAlert.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 31, companyId: 12, recipientId: 8 }
      })
    );
  });

  it("requires a current administrator to view company recipients", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue({
      profile: "user",
      companyId: 12
    });
    await request(app)
      .get("/sla/alert-config")
      .set("Authorization", auth)
      .expect(403);
    expect(SlaAlertConfiguration.findByPk).not.toHaveBeenCalled();
  });

  it("normalizes recipient duplicates and rejects malformed queue assignments", () => {
    const config = {
      enabled: true,
      extraRecipientIds: [8, 8],
      queues: [{ queueId: 22, responsibleIds: [5, 5] }]
    };
    expect(normalizeSlaAlertConfiguration(config)).toEqual({
      ...config,
      extraRecipientIds: [8],
      queues: [{ queueId: 22, responsibleIds: [5] }]
    });
    expect(() =>
      normalizeSlaAlertConfiguration({
        ...config,
        queues: [...config.queues, ...config.queues]
      })
    ).toThrow();
  });
});
