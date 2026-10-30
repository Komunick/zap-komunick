import { Server as SocketServer } from "socket.io";
import { verify } from "jsonwebtoken";
import { initIO } from "../../libs/socket";
import User from "../../models/User";
import UserSocketSession from "../../models/UserSocketSession";

jest.mock("socket.io", () => ({ Server: jest.fn() }));
jest.mock("@socket.io/admin-ui", () => ({ instrument: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ verify: jest.fn() }));
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
jest.mock("../../models/User", () => ({ findByPk: jest.fn() }));
jest.mock("../../models/Queue", () => ({}));
jest.mock("../../models/UserSocketSession", () => ({
  update: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({}),
  count: jest.fn().mockResolvedValue(0)
}));
jest.mock(
  "../../services/TicketServices/AuthorizeTicketContextService",
  () => ({
    __esModule: true,
    default: jest.fn().mockRejectedValue(new Error("fixture-denied"))
  })
);
jest.mock("../../services/SocketServices/TicketContextSocketService", () => ({
  refreshSocketContextRooms: jest.fn()
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

const connect = async (
  claimCompany: number | undefined,
  actualCompany = 10
) => {
  let connected: (socket: unknown) => Promise<unknown>;
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const io = {
    on: jest.fn((_name, callback) => {
      connected = callback;
    }),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };
  (SocketServer as unknown as jest.Mock).mockImplementation(() => io);
  (verify as jest.Mock).mockReturnValue({ id: 101, companyId: claimCompany });
  const user = {
    id: 101,
    companyId: actualCompany,
    profile: "user",
    save: jest.fn()
  };
  (User.findByPk as jest.Mock).mockResolvedValue(user);
  const socket = {
    id: "fixture-socket",
    handshake: {
      query: { token: "fixture-token", companyId: 20, userId: 999 }
    },
    data: {},
    on: jest.fn((name, callback) => {
      handlers[name] = callback;
    }),
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn()
  };
  initIO({} as never);
  await connected(socket);
  return { user, socket, handlers };
};

beforeEach(() => jest.clearAllMocks());

describe("socket identity is bound to the token company and current user", () => {
  it("rejects an old-company token before saving, recording a session or joining rooms", async () => {
    const { user, socket } = await connect(10, 20);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(user.save).not.toHaveBeenCalled();
    expect(UserSocketSession.create).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalledWith("ready");
  });

  it("rejects a token without company scope before side effects", async () => {
    const { user, socket } = await connect(undefined);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(user.save).not.toHaveBeenCalled();
    expect(UserSocketSession.create).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("keeps the legitimate actor rooms and ignores forged identity in the handshake", async () => {
    const { socket, handlers } = await connect(10);
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledWith("user-101");
    expect(socket.join).toHaveBeenCalledWith("company-10-mainchannel");
    expect(socket.join).not.toHaveBeenCalledWith("user-999");
    expect(socket.join).not.toHaveBeenCalledWith("company-20-mainchannel");
    await handlers.joinChatBox("user-999");
    await handlers.joinTickets("company-20-mainchannel");
    expect(socket.join).not.toHaveBeenCalledWith("user-999");
    expect(socket.join).not.toHaveBeenCalledWith("company-20-mainchannel");
  });
});
