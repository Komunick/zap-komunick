import { Request, Response } from "express";
import { DataTypes, Op, Sequelize } from "sequelize";
import Chat from "../../models/Chat";
import ChatUser from "../../models/ChatUser";
import ChatMessage from "../../models/ChatMessage";
import User from "../../models/User";
import CreateService from "../../services/ChatService/CreateService";
import UpdateService from "../../services/ChatService/UpdateService";
import DeleteService from "../../services/ChatService/DeleteService";
import ShowFromUuidService from "../../services/ChatService/ShowFromUuidService";
import FindMessages from "../../services/ChatService/FindMessages";
import ListService from "../../services/ChatService/ListService";
import FindOrCreateDirectService from "../../services/ChatService/FindOrCreateDirectService";
import CreateMessageService, * as ChatMessageServices from "../../services/ChatService/CreateMessageService";
const createChatMessages = (
  ChatMessageServices as unknown as {
    createChatMessages: (
      id: unknown,
      actor: FixtureActor,
      messages: { message: string }[]
    ) => Promise<{ chat: FixtureRecord; messages: FixtureRecord[] }>;
  }
).createChatMessages;
import * as ChatController from "../../controllers/ChatController";

jest.mock("../../models/Chat", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  sequelize: { transaction: jest.fn(), query: jest.fn() }
}));
jest.mock("../../models/ChatUser", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  bulkCreate: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn()
}));
jest.mock("../../models/ChatMessage", () => ({
  create: jest.fn(),
  findAndCountAll: jest.fn()
}));
jest.mock("../../models/User", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn()
}));
jest.mock("../../libs/socket", () => ({
  getIO: () => ({ emit: jest.fn(), to: jest.fn().mockReturnThis() })
}));
jest.mock(
  "../../services/SocketServices/ChatSocketService",
  () => ({ emitChatEvent: jest.fn().mockResolvedValue(undefined) }),
  { virtual: true }
);
jest.mock(
  "../../config/chatUpload",
  () => ({ removeChatUploadFiles: jest.fn().mockResolvedValue(undefined) }),
  { virtual: true }
);

const tx = { LOCK: { SHARE: "SHARE", UPDATE: "UPDATE" } };
const owner = { userId: 1, companyId: 10 };
const member = { userId: 2, companyId: 10 };
const outsider = { userId: 3, companyId: 10 };
const foreign = { userId: 4, companyId: 20 };
interface FixtureActor {
  userId: number;
  companyId: number;
}
interface FixturePerson {
  id: number;
  name: string;
  companyId?: number;
  passwordHash?: string;
  tokenVersion?: number;
  twoFactorSecret?: string;
}
interface FixtureRecord {
  [key: string]: unknown;
  id?: number;
  chatId?: number;
  userId?: number;
  companyId?: number;
  ownerId?: number;
  uuid?: string;
  title?: string;
  isDirect?: boolean;
  lastMessage?: string;
  unreads?: number;
  senderId?: number;
  users?: FixtureRecord[];
  owner?: FixturePerson;
  user?: FixturePerson;
  sender?: FixturePerson;
  chat?: FixtureRecord;
  setDataValue: (key: string, value: unknown) => void;
  toJSON: () => Record<string, unknown>;
  update: jest.Mock;
  reload: jest.Mock;
  destroy: jest.Mock;
}
let people: FixturePerson[],
  chats: FixtureRecord[],
  memberships: FixtureRecord[];
const invoke = <T = unknown>(
  service: unknown,
  ...args: unknown[]
): Promise<T> => (service as (...values: unknown[]) => Promise<T>)(...args);

function entity(values: Record<string, unknown>): FixtureRecord {
  const record = { ...values } as unknown as FixtureRecord;
  record.setDataValue = (key: string, value: unknown) => {
    record[key] = value;
  };
  record.toJSON = () =>
    Object.fromEntries(
      Object.entries(record).filter(([, value]) => typeof value !== "function")
    );
  record.update = jest.fn(async (next: object) => Object.assign(record, next));
  record.reload = jest.fn(async () => record);
  record.destroy = jest.fn(async () => {});
  return record;
}

const matches = (row: object, where: Record<string, unknown> = {}) =>
  Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object")
      return (value as Record<symbol, unknown[]>)[Op.in]
        ? (value as Record<symbol, unknown[]>)[Op.in].includes(
            (row as Record<string, unknown>)[key]
          )
        : (value as Record<symbol, unknown[]>)[Op.notIn]
          ? !(value as Record<symbol, unknown[]>)[Op.notIn].includes(
              (row as Record<string, unknown>)[key]
            )
          : true;
    return String((row as Record<string, unknown>)[key]) === String(value);
  });

beforeEach(() => {
  jest.clearAllMocks();
  people = [1, 2, 3, 4].map(id => ({
    id,
    companyId: id === 4 ? 20 : 10,
    name: `Pessoa ficticia ${id}`,
    passwordHash: "FIXTURE-PRIVATE",
    tokenVersion: 7,
    twoFactorSecret: "FIXTURE-PRIVATE"
  }));
  memberships = [
    [101, 1],
    [101, 2],
    [201, 4]
  ].map(([chatId, userId]) =>
    entity({
      chatId,
      userId,
      unreads: 3,
      user: people.find(p => p.id === userId)
    })
  );
  chats = [
    entity({
      id: 101,
      uuid: "11111111-1111-4111-8111-111111111111",
      companyId: 10,
      ownerId: 1,
      isDirect: false,
      title: "Grupo ficticio A"
    }),
    entity({
      id: 201,
      uuid: "22222222-2222-4222-8222-222222222222",
      companyId: 20,
      ownerId: 4,
      isDirect: false,
      title: "Grupo ficticio B"
    })
  ];
  chats.forEach(chat => {
    chat.users = memberships.filter(m => m.chatId === chat.id);
  });
  (Chat.sequelize.transaction as jest.Mock).mockImplementation(work =>
    work(tx)
  );
  (Chat.sequelize.query as jest.Mock).mockResolvedValue([]);
  (User.findOne as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(people.find(p => matches(p, where)) || null)
  );
  (User.findAll as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(people.filter(p => matches(p, where)))
  );
  (User.findByPk as jest.Mock).mockImplementation(id =>
    Promise.resolve(people.find(p => p.id === id))
  );
  (Chat.findOne as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(chats.find(c => matches(c, where)) || null)
  );
  (Chat.findByPk as jest.Mock).mockImplementation(id =>
    Promise.resolve(chats.find(c => c.id === Number(id)))
  );
  (Chat.findAll as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(chats.filter(c => matches(c, where)))
  );
  (Chat.findAndCountAll as jest.Mock).mockResolvedValue({
    count: 2,
    rows: chats
  });
  (Chat.count as jest.Mock).mockResolvedValue(1);
  (Chat.create as jest.Mock).mockImplementation(async values => {
    const chat = entity({
      id: 301,
      uuid: "33333333-3333-4333-8333-333333333333",
      ...values
    });
    chats.push(chat);
    return chat;
  });
  (ChatUser.findAll as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(memberships.filter(m => matches(m, where)))
  );
  (ChatUser.findOne as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(memberships.find(m => matches(m, where)))
  );
  (ChatUser.count as jest.Mock).mockImplementation(({ where }) =>
    Promise.resolve(memberships.filter(m => matches(m, where)).length)
  );
  (ChatUser.create as jest.Mock).mockImplementation(async values => {
    const m = entity(values);
    memberships.push(m);
    return m;
  });
  (ChatUser.bulkCreate as jest.Mock).mockImplementation(async values => {
    const list = values.map(entity);
    memberships.push(...list);
    return list;
  });
  (ChatUser.destroy as jest.Mock).mockImplementation(async ({ where }) => {
    memberships = memberships.filter(m => !matches(m, where));
    return 1;
  });
  (ChatUser.update as jest.Mock).mockImplementation(
    async (values, { where }) => {
      memberships
        .filter(m => matches(m, where))
        .forEach(m => Object.assign(m, values));
      return [1];
    }
  );
  (ChatMessage.findAndCountAll as jest.Mock).mockResolvedValue({
    count: 1,
    rows: [{ id: 9, chatId: 101, message: "Texto ficticio" }]
  });
  (ChatMessage.create as jest.Mock).mockImplementation(async values =>
    entity({
      id: 9,
      ...values,
      chat: chats.find(c => c.id === values.chatId),
      sender: people.find(p => p.id === values.senderId)
    })
  );
});

describe("scoped chat operations", () => {
  it("hydrates real Sequelize associations for authorized operations without a database connection", async () => {
    const database = new Sequelize("postgres://fake:fake@127.0.0.1/fake", {
      logging: false
    });
    const recordModel = database.define("FakeChat", {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      ownerId: DataTypes.INTEGER,
      companyId: DataTypes.INTEGER,
      uuid: DataTypes.STRING
    });
    const memberModel = database.define("FakeChatMember", {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      chatId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER
    });
    const userModel = database.define("FakeUser", {
      id: { type: DataTypes.INTEGER, primaryKey: true }
    });
    recordModel.hasMany(memberModel, { as: "users" });
    recordModel.belongsTo(userModel, { as: "owner", foreignKey: "ownerId" });
    memberModel.belongsTo(userModel, { as: "user", foreignKey: "userId" });
    const record = recordModel.build({
      id: 101,
      ownerId: 1,
      companyId: 10,
      uuid: chats[0].uuid
    });
    const participants = [1, 2].map(userId =>
      memberModel.build({ id: userId, chatId: 101, userId })
    );
    (Chat.findOne as jest.Mock).mockResolvedValue(record);
    (ChatUser.findAll as jest.Mock).mockResolvedValue(participants);
    try {
      const result = await invoke<FixtureRecord>(
        ShowFromUuidService,
        chats[0].uuid,
        member
      );
      expect(result.users.map(person => person.userId)).toEqual([1, 2]);
      expect(result.users[1].user).toEqual({ id: 2, name: people[1].name });
      expect(result.owner).toEqual({ id: 1, name: people[0].name });
      expect(JSON.stringify(result)).not.toContain("FIXTURE-PRIVATE");
    } finally {
      await database.close();
    }
  });
  it.each([outsider, foreign])(
    "denies unauthorized UUID lookup without returning a chat: %o",
    async actor => {
      await expect(
        invoke<FixtureRecord>(ShowFromUuidService, chats[0].uuid, actor)
      ).rejects.toMatchObject({ statusCode: 404 });
    }
  );
  it.each([outsider, foreign])(
    "denies unauthorized send before creating a message: %o",
    async actor => {
      await expect(
        invoke<FixtureRecord>(CreateMessageService, {
          chatId: 101,
          senderId: actor.userId,
          companyId: actor.companyId,
          message: "Tentativa ficticia"
        })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(ChatMessage.create).not.toHaveBeenCalled();
      expect(chats[0].update).not.toHaveBeenCalled();
    }
  );
  it.each([outsider, foreign])(
    "denies unauthorized history before reading message data: %o",
    async actor => {
      await expect(
        invoke<FixtureRecord>(FindMessages, {
          chatId: "101",
          ownerId: actor.userId,
          companyId: actor.companyId
        })
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(ChatMessage.findAndCountAll).not.toHaveBeenCalled();
    }
  );
  it.each([member, outsider, foreign])(
    "cannot edit or remove someone else's group: %o",
    async actor => {
      const code = actor === member ? 403 : 404;
      await expect(
        invoke<FixtureRecord>(UpdateService, {
          id: 101,
          actor,
          title: "Alteracao negada"
        })
      ).rejects.toMatchObject({ statusCode: code });
      await expect(
        invoke<FixtureRecord>(DeleteService, "101", actor)
      ).rejects.toMatchObject({
        statusCode: code
      });
      expect(chats[0].update).not.toHaveBeenCalled();
      expect(chats[0].destroy).not.toHaveBeenCalled();
    }
  );
  it("validates all group participants before creating any row", async () => {
    await expect(
      CreateService({
        ownerId: 1,
        companyId: 10,
        title: "Grupo ficticio",
        users: [{ id: 2 }, { id: 4 }]
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Chat.create).not.toHaveBeenCalled();
    expect(ChatUser.create).not.toHaveBeenCalled();
    expect(ChatUser.bulkCreate).not.toHaveBeenCalled();
  });
  it("validates all replacement participants before changing title or membership", async () => {
    await expect(
      invoke<FixtureRecord>(UpdateService, {
        id: 101,
        actor: owner,
        title: "Novo titulo ficticio",
        users: [{ id: 2 }, { id: 4 }]
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(chats[0].update).not.toHaveBeenCalled();
    expect(ChatUser.destroy).not.toHaveBeenCalled();
  });
  it("renaming and adding a participant preserves existing unread state and membership identity", async () => {
    const retained = memberships.find(m => m.chatId === 101 && m.userId === 2);
    await invoke<FixtureRecord>(UpdateService, {
      id: 101,
      actor: owner,
      title: "Grupo renomeado",
      users: [{ id: 2 }, { id: 3 }]
    });
    expect(memberships.find(m => m.chatId === 101 && m.userId === 2)).toBe(
      retained
    );
    expect(retained.unreads).toBe(3);
    expect(
      memberships.filter(m => m.chatId === 101).map(m => m.userId)
    ).toEqual([1, 2, 3]);
  });
  it("uses current actor company rather than trusting an old authenticated claim", async () => {
    people[0].companyId = 20;
    await expect(
      invoke<FixtureRecord>(ListService, { ownerId: 1, companyId: 10 })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(Chat.findAll).not.toHaveBeenCalled();
  });
  it("foreign legacy membership never grants access or appears in a legitimate DTO", async () => {
    memberships.push(entity({ chatId: 101, userId: 4, unreads: 0 }));
    await expect(
      invoke<FixtureRecord>(ShowFromUuidService, chats[0].uuid, foreign)
    ).rejects.toMatchObject({ statusCode: 404 });
    const record = await invoke<FixtureRecord>(
      ShowFromUuidService,
      chats[0].uuid,
      owner
    );
    expect(record.users.map((m: FixtureRecord) => m.userId)).toEqual([1, 2]);
    expect(JSON.stringify(record)).not.toContain("FIXTURE-PRIVATE");
    expect(Object.keys(record.owner)).toEqual(["id", "name"]);
  });
  it("keeps history while limiting sender metadata to the authenticated company", async () => {
    const result = await invoke<{ records: FixtureRecord[] }>(FindMessages, {
      chatId: "101",
      ownerId: 1,
      companyId: 10
    });
    expect(result.records).toHaveLength(1);
    expect(ChatMessage.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        include: [
          expect.objectContaining({
            as: "sender",
            attributes: ["id", "name"],
            where: { companyId: 10 },
            required: false
          })
        ]
      })
    );
  });
  it("keeps a valid member's history accessible when the owner moved companies without exposing that owner", async () => {
    people[0].companyId = 20;
    const record = await invoke<FixtureRecord>(
      ShowFromUuidService,
      chats[0].uuid,
      member
    );
    expect(record.users.map(m => m.userId)).toEqual([2]);
    expect(record.owner).toBeNull();
    expect(JSON.stringify(record)).not.toContain(people[0].name);
    const list = await invoke<{ records: FixtureRecord[] }>(ListService, {
      ownerId: 2,
      companyId: 10
    });
    expect(list.records.map(chat => chat.id)).toEqual([101]);
    expect(list.records[0].owner).toBeNull();
  });
  it("denies a chat whose owner disappears before the chat can be locked", async () => {
    (User.findAll as jest.Mock).mockResolvedValueOnce([]);
    await expect(
      invoke(FindMessages, { chatId: "101", ownerId: 2, companyId: 10 })
    ).rejects.toMatchObject({ message: "ERR_NO_CHAT_FOUND", statusCode: 404 });
    expect(ChatMessage.findAndCountAll).not.toHaveBeenCalled();
  });
  it("denies management when the owner identity changes during authorization", async () => {
    (Chat.findOne as jest.Mock)
      .mockResolvedValueOnce(entity({ id: 101, companyId: 10, ownerId: 1 }))
      .mockResolvedValueOnce(entity({ id: 101, companyId: 10, ownerId: 3 }));
    await expect(
      invoke(UpdateService, { id: 101, actor: owner, title: "Negado" })
    ).rejects.toMatchObject({ message: "ERR_NO_CHAT_FOUND", statusCode: 404 });
    expect(chats[0].update).not.toHaveBeenCalled();
    expect(ChatUser.destroy).not.toHaveBeenCalled();
  });
  it("reuses a legacy direct chat with a different owner while protecting that owner's identity", async () => {
    chats[0].isDirect = true;
    chats[0].ownerId = 4;
    const result = await invoke<{ record: FixtureRecord; created: boolean }>(
      FindOrCreateDirectService,
      { ownerId: 1, companyId: 10, userId: 2 }
    );
    expect(result.created).toBe(false);
    expect(result.record.id).toBe(101);
    expect(result.record.owner).toBeNull();
    expect(JSON.stringify(result)).not.toContain(people[3].name);
    expect(Chat.create).not.toHaveBeenCalled();
  });
  it("keeps a direct chat immutable for its own creator", async () => {
    chats[0].isDirect = true;
    await expect(
      invoke<FixtureRecord>(UpdateService, {
        id: 101,
        actor: owner,
        title: "Negado"
      })
    ).rejects.toMatchObject({
      message: "ERR_CHAT_DIRECT_READONLY",
      statusCode: 403
    });
    await expect(
      invoke<FixtureRecord>(DeleteService, 101, owner)
    ).rejects.toMatchObject({
      message: "ERR_CHAT_DIRECT_READONLY",
      statusCode: 403
    });
  });
  it("allows an ordinary participant to send without exposing private User fields", async () => {
    const result = await createChatMessages(101, member, [
      { message: "Texto ficticio permitido" }
    ]);
    expect(ChatMessage.create).toHaveBeenCalledTimes(1);
    expect(result.messages[0].senderId).toBe(2);
    expect(result.chat.lastMessage).toBe(
      "Pessoa ficticia 2: Texto ficticio permitido"
    );
    expect(JSON.stringify(result)).not.toContain("FIXTURE-PRIVATE");
  });
});

describe("controller actor ownership and effects", () => {
  const request = (actor: FixtureActor, body: Record<string, unknown> = {}) =>
    ({
      user: {
        id: String(actor.userId),
        companyId: actor.companyId,
        profile: "admin",
        isSuper: true
      },
      params: { id: "101" },
      body,
      query: {}
    }) as unknown as Request;
  const response = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    }) as unknown as Response;
  it("a read receipt ignores a spoofed body userId and only clears the actor", async () => {
    await ChatController.checkAsRead(request(owner, { userId: 2 }), response());
    expect(memberships.find(m => m.userId === 1).unreads).toBe(0);
    expect(memberships.find(m => m.userId === 2).unreads).toBe(3);
  });
  it("a denied actor causes no unread update or socket event", async () => {
    await expect(
      ChatController.checkAsRead(request(outsider, { userId: 2 }), response())
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(ChatUser.update).not.toHaveBeenCalled();
    expect(memberships.every(m => m.unreads === 3)).toBe(true);
    expect(
      jest.requireMock("../../services/SocketServices/ChatSocketService")
        .emitChatEvent
    ).not.toHaveBeenCalled();
  });
  it("a denied upload revalidation cleans its request files and does not emit", async () => {
    const req = request(outsider);
    req.files = [
      {
        filename: "chat-11111111-1111-4111-8111-111111111111.txt",
        path: "/public/chat-11111111-1111-4111-8111-111111111111.txt",
        originalname: "ficticio.txt",
        mimetype: "text/plain"
      }
    ] as unknown as Express.Multer.File[];
    await expect(
      ChatController.saveMessage(req, response())
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(ChatMessage.create).not.toHaveBeenCalled();
    expect(
      jest.requireMock("../../config/chatUpload").removeChatUploadFiles
    ).toHaveBeenCalledWith(req.files);
    expect(
      jest.requireMock("../../services/SocketServices/ChatSocketService")
        .emitChatEvent
    ).not.toHaveBeenCalled();
  });
});
