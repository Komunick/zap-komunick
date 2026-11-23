import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import { SendMessage } from "../../helpers/SendMessage";
import Whatsapp from "../../models/Whatsapp";
import { handleMessage } from "../../services/WbotServices/wbotMessageListener";

jest.mock("../../helpers/GetWhatsappWbot", () => jest.fn());
jest.mock("../../helpers/CheckSettings", () => jest.fn());
jest.mock("../../helpers/saveMediaFile", () => jest.fn());
jest.mock("../../models/OutOfTicketMessages", () => ({}));
jest.mock("../../services/WbotServices/SendWhatsAppMedia", () => ({}));
jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  handleMessage: jest.fn()
}));
jest.mock("../../services/WbotServices/getJidOf", () => ({
  getJidOf: jest.fn()
}));

it.each([
  [true, undefined],
  [402, 402]
])(
  "does not treat saveOnTicket=%s as a different queue",
  async (saveOnTicket, queueId) => {
    const message = { key: { id: "fixture" } };
    const wbot = { sendMessage: jest.fn().mockResolvedValue(message) };
    const whatsapp = { id: 501, companyId: 10 } as Whatsapp;
    (GetWhatsappWbot as jest.Mock).mockResolvedValue(wbot);

    await SendMessage(whatsapp, {
      number: "000",
      body: "fixture",
      saveOnTicket
    });

    expect(handleMessage).toHaveBeenCalledWith(message, wbot, 10, queueId);
  }
);
