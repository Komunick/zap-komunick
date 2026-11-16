import Setting from "../../models/Setting";
import {
  FORCE_MESSAGE_SIGNATURE,
  formatSignedMessage,
  isMessageSignatureRequired
} from "../../helpers/MessageSignature";

jest.mock("../../models/Setting", () => ({ count: jest.fn() }));

const actor = { name: "Ana Fictícia", companyId: 10 };
const literal = (text: string) => text;

describe("mandatory signature", () => {
  it("requires an explicitly enabled policy scoped to the company", async () => {
    (Setting.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    await expect(isMessageSignatureRequired(10)).resolves.toBe(false);
    await expect(isMessageSignatureRequired(20)).resolves.toBe(true);
    expect(Setting.count).toHaveBeenNthCalledWith(1, {
      where: { companyId: 10, key: FORCE_MESSAGE_SIGNATURE, value: "enabled" }
    });
    expect(Setting.count).toHaveBeenNthCalledWith(2, {
      where: { companyId: 20, key: FORCE_MESSAGE_SIGNATURE, value: "enabled" }
    });
  });

  it("renders an existing signature once for new or edited text", () => {
    const body = "*Ana Fictícia:*\nMensagem corrigida.\nSegunda linha.";
    expect(formatSignedMessage(body, 10, actor, literal)).toBe(body);
    expect(
      formatSignedMessage(
        "Mensagem corrigida.\nSegunda linha.",
        10,
        actor,
        literal
      )
    ).toBe(body);
  });

  it("keeps other headings in the original text", () => {
    const body = "*Departamento Fiscal:*\n  Informe os dados.\n";
    expect(formatSignedMessage(body, 10, actor, literal)).toBe(
      `*Ana Fictícia:*\n${body}`
    );
  });

  it("renders templates only in the text, never in the actual account name", () => {
    const render = jest.fn().mockReturnValue("Olá, Cliente Fictício.");
    const result = formatSignedMessage(
      "*Ana {{user}}:*\r\nOlá, {{name}}.",
      10,
      { companyId: 10, name: "Ana {{user}}" },
      render
    );
    expect(render).toHaveBeenCalledWith("Olá, {{name}}.");
    expect(result).toBe("*Ana {{user}}:*\nOlá, Cliente Fictício.");
  });

  it.each([null, { ...actor, companyId: 20 }])(
    "rejects a missing or cross-company signer",
    signer => {
      expect(() =>
        formatSignedMessage("Mensagem", 10, signer, literal)
      ).toThrow("ERR_NO_PERMISSION");
    }
  );
});
