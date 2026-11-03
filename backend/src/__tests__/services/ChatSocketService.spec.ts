import { Op, Transaction } from "sequelize";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import User from "../../models/User";
import { emitChatEvent } from "../../services/SocketServices/ChatSocketService";
import { logger } from "../../utils/logger";

jest.mock("../../models/Chat", () => ({
  findOne: jest.fn(),
  sequelize: { transaction: jest.fn() }
}));
jest.mock("../../models/ChatUser", () => ({ findAll: jest.fn() }));
jest.mock("../../models/User", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../utils/logger", () => ({ logger: { warn: jest.fn() } }));

const person = (id: number, companyId = 10) => ({
  id,
  companyId,
  name: `Pessoa fictícia ${id}`,
  passwordHash: "must-not-leak",
  email: "private@fixture.local.test",
  twoFactorSecret: "must-not-leak"
});
const member = (userId: number) => ({
  id: userId + 1000,
  chatId: 301,
  userId,
  unreads: 1,
  user: person(userId)
});
const snapshot = {
  id: 301,
  companyId: 10,
  users: [{ userId: 101 }, { userId: 102 }]
};
const chat = () => ({
  ...snapshot,
  uuid: "fixture-group",
  ownerId: 101,
  title: "Grupo fictício",
  lastMessage: "Texto fictício",
  isDirect: false,
  createdAt: "2026-10-30T12:00:00Z",
  updatedAt: "2026-10-30T12:00:00Z",
  secretUnexpected: "must-not-leak",
  owner: person(101)
});
const message = {
  id: 401,
  chatId: 301,
  senderId: 101,
  message: "Texto fictício",
  createdAt: "2026-10-30T12:00:00Z",
  sender: person(101),
  unexpectedPrivate: "must-not-leak"
};
const recipient = (userId: number, companyId = 10) => ({
  data: { contextActor: { userId, companyId } },
  emit: jest.fn()
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};

let activeTransaction: boolean;
let transaction: object;
beforeEach(() => {
  jest.clearAllMocks();
  activeTransaction = false;
  transaction = { fixture: true };
  (Chat.sequelize.transaction as jest.Mock).mockImplementation(
    async callback => {
      activeTransaction = true;
      try {
        return await callback(transaction);
      } finally {
        activeTransaction = false;
      }
    }
  );
  (Chat.findOne as jest.Mock).mockResolvedValue(chat());
  (ChatUser.findAll as jest.Mock).mockResolvedValue([member(101), member(102)]);
  (User.findAll as jest.Mock).mockResolvedValue([person(101), person(102)]);
  (User.findByPk as jest.Mock).mockResolvedValue({ id: 101 });
});

const server = (...sockets: ReturnType<typeof recipient>[]) => ({
  in: jest
    .fn()
    .mockReturnValue({ fetchSockets: jest.fn().mockResolvedValue(sockets) })
});

describe("chat events authorize current recipients, not room names", () => {
  it("serializes attachment events by message identity, never a public storage URL", async () => {
    const before = process.env.BACKEND_URL;
    process.env.BACKEND_URL = "https://backend.example.invalid/backend";
    try {
      const owner = recipient(101);
      await emitChatEvent(server(owner) as never, {
        kind: "message",
        chat: snapshot,
        newMessage: {
          ...message,
          mediaPath: "https://backend.example.invalid/public/1890171090516.png"
        }
      });
      expect(owner.emit.mock.calls[0][1].newMessage.mediaPath).toBe(
        "https://backend.example.invalid/backend/chats/301/messages/401/media"
      );
      expect(JSON.stringify(owner.emit.mock.calls)).not.toContain(
        "1890171090516.png"
      );
    } finally {
      if (before === undefined) delete process.env.BACKEND_URL;
      else process.env.BACKEND_URL = before;
    }
  });

  it("locks the owner before the chat to avoid a concurrent owner-delete cascade cycle", async () => {
    await emitChatEvent(server(recipient(101)) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(User.findByPk).toHaveBeenCalledWith(101, {
      attributes: ["id"],
      transaction,
      lock: Transaction.LOCK.SHARE
    });
    const lockedIndex = (Chat.findOne as jest.Mock).mock.calls.findIndex(
      ([options]) => options.lock === Transaction.LOCK.UPDATE
    );
    expect(
      (User.findByPk as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
      (Chat.findOne as jest.Mock).mock.invocationCallOrder[lockedIndex]
    );
  });

  it("withholds delivery when the chat owner changes before its row is locked", async () => {
    (Chat.findOne as jest.Mock).mockImplementation(async options => ({
      ...chat(),
      ownerId: options.lock ? 999 : 101
    }));
    const owner = recipient(101);
    await emitChatEvent(server(owner) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(owner.emit).not.toHaveBeenCalled();
  });

  it("locks a legacy foreign owner only by id and never exposes their data", async () => {
    (Chat.findOne as jest.Mock).mockResolvedValue({ ...chat(), ownerId: 201 });
    (User.findByPk as jest.Mock).mockResolvedValue({ id: 201 });
    const owner = recipient(101);
    await emitChatEvent(server(owner) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(User.findByPk).toHaveBeenCalledWith(201, {
      attributes: ["id"],
      transaction,
      lock: Transaction.LOCK.SHARE
    });
    expect(owner.emit).toHaveBeenCalledTimes(2);
    expect(owner.emit.mock.calls[0][1].chat.owner).toBeNull();
    expect(JSON.stringify(owner.emit.mock.calls)).not.toContain(
      "Pessoa fictícia 201"
    );
  });

  it("does not lock a live chat after its owner was already deleted", async () => {
    (User.findByPk as jest.Mock).mockResolvedValue(null);
    const owner = recipient(101);
    await emitChatEvent(server(owner) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(owner.emit).not.toHaveBeenCalled();
    expect(
      (Chat.findOne as jest.Mock).mock.calls.every(([options]) => !options.lock)
    ).toBe(true);
  });

  it.each(["create", "membership-update", "read", "message"] as const)(
    "restricts %s to current members and emits only explicit public fields",
    async kind => {
      const owner = recipient(101),
        colleague = recipient(102),
        outsider = recipient(103),
        foreign = recipient(201, 20),
        wrongCompany = recipient(101, 20);
      const io = server(owner, colleague, outsider, foreign, wrongCompany);
      await emitChatEvent(io as never, {
        kind,
        chat: snapshot,
        newMessage: message
      });
      expect(owner.emit).toHaveBeenCalledTimes(
        kind === "read" || kind === "message" ? 2 : 1
      );
      expect(colleague.emit).toHaveBeenCalledTimes(
        kind === "read" || kind === "message" ? 2 : 1
      );
      [outsider, foreign, wrongCompany].forEach(socket =>
        expect(socket.emit).not.toHaveBeenCalled()
      );
      const wire = JSON.stringify(owner.emit.mock.calls);
      expect(wire).not.toContain("must-not-leak");
      expect(wire).not.toContain("passwordHash");
      expect(wire).not.toContain("twoFactorSecret");
      expect(wire).not.toContain("email");
      expect(wire).toContain("Pessoa fictícia 101");
      expect(User.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { [Op.in]: [101, 102] }, companyId: 10 },
          lock: Transaction.LOCK.SHARE,
          transaction
        })
      );
      expect(Chat.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 301, companyId: 10 },
          lock: Transaction.LOCK.UPDATE,
          transaction
        })
      );
    }
  );

  it("never delivers or serializes a legacy member whose current company differs", async () => {
    (ChatUser.findAll as jest.Mock).mockResolvedValue([
      member(101),
      member(201)
    ]);
    (User.findAll as jest.Mock).mockResolvedValue([
      person(101),
      person(201, 20)
    ]);
    const owner = recipient(101),
      foreign = recipient(201, 20),
      staleForeign = recipient(201, 10);
    await emitChatEvent(server(owner, foreign, staleForeign) as never, {
      kind: "message",
      chat: snapshot,
      newMessage: message
    });
    expect(owner.emit).toHaveBeenCalledTimes(2);
    expect(foreign.emit).not.toHaveBeenCalled();
    expect(staleForeign.emit).not.toHaveBeenCalled();
    const payload = owner.emit.mock.calls[0][1];
    expect(payload.chat.users.map(m => m.userId)).toEqual([101]);
    expect(JSON.stringify(payload)).not.toContain("Pessoa fictícia 201");
  });

  it("withholds a stale member and a deleted user even if candidate rooms return their sockets", async () => {
    (ChatUser.findAll as jest.Mock).mockResolvedValue([
      member(101),
      member(102)
    ]);
    (User.findAll as jest.Mock).mockResolvedValue([person(101)]);
    const owner = recipient(101),
      deleted = recipient(102),
      removed = recipient(103);
    await emitChatEvent(server(owner, deleted, removed) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(owner.emit).toHaveBeenCalledTimes(2);
    expect(deleted.emit).not.toHaveBeenCalled();
    expect(removed.emit).not.toHaveBeenCalled();
  });

  it("sends removed members only a tombstone and never the new group content", async () => {
    (ChatUser.findAll as jest.Mock).mockResolvedValue([member(101)]);
    (User.findAll as jest.Mock).mockResolvedValue([person(101), person(102)]);
    const owner = recipient(101),
      removed = recipient(102),
      otherCompany = recipient(102, 20);
    await emitChatEvent(server(owner, removed, otherCompany) as never, {
      kind: "membership-update",
      chat: snapshot,
      removedUserIds: [102]
    });
    expect(owner.emit).toHaveBeenCalledWith(
      "company-10-chat-user-101",
      expect.objectContaining({ action: "update" })
    );
    expect(removed.emit).toHaveBeenCalledTimes(1);
    expect(removed.emit).toHaveBeenCalledWith("company-10-chat", {
      action: "delete",
      id: 301
    });
    expect(otherCompany.emit).not.toHaveBeenCalled();
  });

  it("does not remove a member who was already added back before delivery", async () => {
    const restored = recipient(102);
    await emitChatEvent(server(restored) as never, {
      kind: "membership-update",
      chat: snapshot,
      removedUserIds: [102]
    });
    expect(restored.emit).toHaveBeenCalledTimes(1);
    expect(restored.emit).toHaveBeenCalledWith(
      "company-10-chat-user-102",
      expect.objectContaining({ action: "update" })
    );
  });

  it("deletion exposes only the tombstone to previous members still in the same company", async () => {
    (Chat.findOne as jest.Mock).mockResolvedValue(null);
    (User.findAll as jest.Mock).mockResolvedValue([
      person(101),
      person(102, 20)
    ]);
    const owner = recipient(101),
      foreign = recipient(102, 20),
      stale = recipient(102, 10),
      outsider = recipient(103);
    await emitChatEvent(server(owner, foreign, stale, outsider) as never, {
      kind: "delete",
      chat: snapshot
    });
    expect(owner.emit).toHaveBeenCalledTimes(1);
    expect(owner.emit).toHaveBeenCalledWith("company-10-chat", {
      action: "delete",
      id: 301
    });
    [foreign, stale, outsider].forEach(socket =>
      expect(socket.emit).not.toHaveBeenCalled()
    );
  });

  it("uses the latest committed metadata rather than the stale event snapshot", async () => {
    (Chat.findOne as jest.Mock).mockResolvedValue({
      ...chat(),
      title: "Nome atual",
      lastMessage: "Última atual"
    });
    const owner = recipient(101);
    await emitChatEvent(server(owner) as never, {
      kind: "membership-update",
      chat: { ...snapshot, title: "Nome antigo" } as never
    });
    expect(owner.emit.mock.calls[0][1].record.title).toBe("Nome atual");
    expect(owner.emit.mock.calls[0][1].record.lastMessage).toBe("Última atual");
  });

  it("rechecks user company after the final asynchronous socket lookup and emits inside the lock", async () => {
    const delayed = deferred();
    const moved = recipient(102),
      owner = recipient(101);
    const io = {
      in: jest.fn().mockReturnValue({ fetchSockets: () => delayed.promise })
    };
    owner.emit.mockImplementation(() => expect(activeTransaction).toBe(true));
    const pending = emitChatEvent(io as never, {
      kind: "message",
      chat: snapshot,
      newMessage: message
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(User.findAll).not.toHaveBeenCalled();
    (User.findAll as jest.Mock).mockResolvedValue([person(101)]);
    delayed.resolve([owner, moved]);
    await pending;
    expect(owner.emit).toHaveBeenCalledTimes(2);
    expect(moved.emit).not.toHaveBeenCalled();
    expect(activeTransaction).toBe(false);
  });

  it("fails closed without rejecting a committed write when authorization lookup fails", async () => {
    (User.findAll as jest.Mock).mockRejectedValue(
      new Error("fixture-private-details")
    );
    const owner = recipient(101);
    await expect(
      emitChatEvent(server(owner) as never, {
        kind: "message",
        chat: snapshot,
        newMessage: message
      })
    ).resolves.toBeUndefined();
    expect(owner.emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Internal chat event withheld because authorization was unavailable"
    );
  });

  it("does not send a live snapshot after the chat disappears or its company mismatches", async () => {
    const owner = recipient(101);
    (Chat.findOne as jest.Mock).mockResolvedValue(null);
    await emitChatEvent(server(owner) as never, {
      kind: "read",
      chat: snapshot
    });
    (Chat.findOne as jest.Mock).mockResolvedValue({ ...chat(), companyId: 20 });
    await emitChatEvent(server(owner) as never, {
      kind: "read",
      chat: snapshot
    });
    expect(owner.emit).not.toHaveBeenCalled();
  });

  it("does not cross the chat boundary in a mismatched message", async () => {
    const owner = recipient(101);
    await emitChatEvent(server(owner) as never, {
      kind: "message",
      chat: snapshot,
      newMessage: { ...message, chatId: 999 }
    });
    expect(owner.emit).not.toHaveBeenCalled();
    expect(Chat.findOne).not.toHaveBeenCalled();
  });
});
