import {
  completionAllowed,
  completionPromptEnabled,
  completionRequested,
  completionTextOnClose,
  mayNotifyOnClose
} from "../../helpers/CloseCompletion";

const facts = {
  channel: "whatsapp",
  isGroup: false,
  contactDisableBot: false,
  whatsappStatus: "CONNECTED",
  completionMessage: "  *Seu atendimento será finalizado.*\nAté logo.  "
};

describe("the completion message of a finished ticket", () => {
  it("is the text of the connection, trimmed", () => {
    expect(completionTextOnClose(facts)).toBe(
      "*Seu atendimento será finalizado.*\nAté logo."
    );
  });

  it.each([
    ["no text on the connection", { completionMessage: "" }],
    ["only spaces", { completionMessage: "  \n " }],
    ["no text at all", { completionMessage: null }],
    ["a group", { isGroup: true }],
    ["a client who turned the robot off", { contactDisableBot: true }],
    ["a connection that is down", { whatsappStatus: "DISCONNECTED" }],
    ["a connection waiting for the QR code", { whatsappStatus: "qrcode" }],
    ["no connection", { whatsappStatus: undefined }],
    ["another channel", { channel: "facebook" }]
  ])("is not sent with %s", (_label, change) => {
    expect(completionTextOnClose({ ...facts, ...change })).toBeNull();
  });

  it("goes only to a person, through a connection that is up", () => {
    expect(mayNotifyOnClose(facts)).toBe(true);
    expect(mayNotifyOnClose({ ...facts, isGroup: true })).toBe(false);
    expect(mayNotifyOnClose({ ...facts, contactDisableBot: true })).toBe(false);
    expect(mayNotifyOnClose({ ...facts, whatsappStatus: "OPENING" })).toBe(
      false
    );
  });
});

describe("who decides whether it goes", () => {
  it("asks only when the office turned the question on", () => {
    expect(completionPromptEnabled("enabled")).toBe(true);
    ["disabled", "", undefined, null, "true", true, 1].forEach(value =>
      expect(completionPromptEnabled(value)).toBe(false)
    );
  });

  it("without the question, every finish sends it, as it always did", () => {
    [undefined, null, true, "no", "false", 0].forEach(answer =>
      expect(completionAllowed("disabled", answer)).toBe(true)
    );
    expect(completionAllowed(undefined, undefined)).toBe(true);
  });

  it("without the question, only a literal no holds it back", () => {
    expect(completionAllowed("disabled", false)).toBe(false);
    expect(completionAllowed(undefined, false)).toBe(false);
  });

  it("a yes only counts as an answer where the question exists", () => {
    expect(completionRequested("enabled", true)).toBe(true);
    expect(completionRequested("enabled", "true")).toBe(false);
    expect(completionRequested("enabled", undefined)).toBe(false);
    expect(completionRequested("disabled", true)).toBe(false);
  });

  it("with the question, only an explicit yes sends it", () => {
    expect(completionAllowed("enabled", true)).toBe(true);
    // a screen that does not know about the question says nothing
    [undefined, null, false, "true", 1, "yes", {}].forEach(answer =>
      expect(completionAllowed("enabled", answer)).toBe(false)
    );
  });
});
