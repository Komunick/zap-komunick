import { Server as SocketServer } from "socket.io";
import { initIO } from "../../libs/socket";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";

jest.mock("socket.io", () => ({ Server: jest.fn() }));
jest.mock("@socket.io/admin-ui", () => ({ instrument: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: () => ({ id: 101 }) }));
jest.mock("../../config/auth", () => ({ secret: "fixture-only" }));
jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  },
  setSocketIo: jest.fn()
}));
jest.mock("../../models/User", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Ticket", () => ({
  findByPk: jest.fn(),
  findOne: jest.fn()
}));
jest.mock("../../models/Contact", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Message", () => ({ findOne: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/UserSocketSession", () => ({
  update: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  count: jest.fn().mockResolvedValue(1)
}));
jest.mock("../../helpers/CheckSettings", () => ({
  GetCompanySetting: jest.fn().mockResolvedValue("disabled")
}));
jest.mock("../../helpers/corsOrigin", () => ({
  corsOrigin: "http://fixture.invalid"
}));
jest.mock(
  "../../services/DecoupledDriverServices/DecoupledDriverServices",
  () => ({
    DecoupledDriverServices: { getInstance: () => ({ getFunction: jest.fn() }) }
  })
);

describe("socket ticket context authorization", () => {
  it("does not let an assigned attendant without a sector join the ticket", async () => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    let connect: (socket: unknown) => Promise<unknown>;
    const io = {
      on: jest.fn((_name, handler) => {
        connect = handler;
      }),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
    (SocketServer as unknown as jest.Mock).mockImplementation(() => io);
    const user = {
      id: 101,
      companyId: 10,
      profile: "user",
      queues: [],
      save: jest.fn()
    };
    const ticket = {
      id: 301,
      companyId: 10,
      contactId: 201,
      userId: 101,
      queueId: 401
    };
    (User.findByPk as jest.Mock).mockResolvedValue(user);
    (User.findOne as jest.Mock).mockResolvedValue(user);
    (Ticket.findByPk as jest.Mock).mockResolvedValue(ticket);
    (Ticket.findOne as jest.Mock).mockResolvedValue(ticket);
    (Contact.findOne as jest.Mock).mockResolvedValue({
      id: 201,
      companyId: 10
    });
    const socket = {
      id: "fixture-socket",
      handshake: { query: { token: "fixture-token" } },
      data: {},
      on: jest.fn((name, handler) => {
        handlers[name] = handler;
      }),
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn()
    };
    initIO({} as never);
    await connect(socket);
    socket.join.mockClear();
    await handlers.joinChatBox("301");
    await new Promise(resolve => setImmediate(resolve));
    expect(socket.join).not.toHaveBeenCalledWith("301");
  });
});
