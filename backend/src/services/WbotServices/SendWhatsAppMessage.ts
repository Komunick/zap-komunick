import { WAMessage } from "libzapitu-rf";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import { assertNotImportedMessage } from "../../helpers/ImportedMessage";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import { formatSignedMessage } from "../../helpers/MessageSignature";
import { verifyMediaMessage, verifyMessage } from "./wbotMessageListener";
import User from "../../models/User";
import { getJidOf } from "./getJidOf";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  body: string;
  ticket: Ticket;
  userId?: number;
  quotedMsg?: Message;
  forceSignature?: boolean;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  userId,
  quotedMsg,
  forceSignature = false
}: Request): Promise<WAMessage> => {
  let options = {};

  const connection = await Whatsapp.findByPk(ticket.whatsappId);

  if (!connection) {
    throw new AppError("ERR_WAPP_NOT_FOUND");
  }

  if (connection.status !== "CONNECTED") {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  const wbot = await GetTicketWbot(ticket);

  if (quotedMsg) {
    const chatMessage = await Message.findOne({
      where: {
        id: quotedMsg.id,
        ticketId: quotedMsg.ticketId,
        companyId: ticket.companyId
      }
    });

    if (chatMessage) {
      // Zap Komunick: imported history (RF-029) cannot be quoted; saying so
      // is better than sending the answer without the quote
      assertNotImportedMessage(chatMessage);
      const msgFound = JSON.parse(chatMessage.dataJson);

      options = {
        quoted: {
          key: msgFound?.key || chatMessage.id,
          message: msgFound?.message
        }
      };
    }
  }

  try {
    const user = userId && (await User.findByPk(userId));
    const formattedBody = forceSignature
      ? formatSignedMessage(body, ticket.companyId, user, text =>
          formatBody(text, ticket, user)
        )
      : formatBody(body, ticket, user);
    const sentMessage = await wbot.sendMessage(
      getJidOf(ticket),
      {
        text: formattedBody
      },
      {
        ...options
      }
    );

    wbot.cacheMessage(sentMessage);

    if (sentMessage?.message?.extendedTextMessage?.thumbnailDirectPath) {
      await verifyMediaMessage(sentMessage, ticket, ticket.contact, { wbot });
    } else {
      await verifyMessage(sentMessage, ticket, ticket.contact);
    }
    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
