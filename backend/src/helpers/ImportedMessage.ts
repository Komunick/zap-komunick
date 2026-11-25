import AppError from "../errors/AppError";

// Zap Komunick: history imported from the previous system (RF-029) is text
// only. It has no WhatsApp payload, so there is nothing to edit, delete, react
// to or quote on WhatsApp: these actions are refused before any connection is
// looked up (GetTicketWbot would save the default one on the closed ticket).

type MessageFacts = { dataJson?: string | null; remoteJid?: string | null };

export const isImportedMessage = (message: MessageFacts): boolean =>
  !message.dataJson && !message.remoteJid;

export const assertNotImportedMessage = (message: MessageFacts): void => {
  if (isImportedMessage(message)) {
    throw new AppError("ERR_IMPORTED_MESSAGE_READ_ONLY", 400);
  }
};
