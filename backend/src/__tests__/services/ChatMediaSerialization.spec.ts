import ChatMessage from "../../models/ChatMessage";

it("serializes stored media as an authenticated message URL without exposing its public storage basename", () => {
  const before = process.env.BACKEND_URL;
  process.env.BACKEND_URL = "https://backend.example.invalid/backend";
  try {
    const getter = Object.getOwnPropertyDescriptor(
      ChatMessage.prototype,
      "mediaPath"
    )?.get;
    expect(getter).toBeDefined();
    const value = getter.call({
      id: 91,
      chatId: 301,
      getDataValue: () => "1890171090516.png"
    });
    expect(value).toBe(
      "https://backend.example.invalid/backend/chats/301/messages/91/media"
    );
    expect(value).not.toContain("1890171090516.png");
    expect(value).not.toContain("/public/");
  } finally {
    if (before === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = before;
  }
});
