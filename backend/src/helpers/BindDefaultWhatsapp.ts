import Ticket from "../models/Ticket";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";

// Zap Komunick: a WhatsApp ticket may have no connection (its connection was
// deleted, or it is history imported from the previous system, RF-029).
// Answering or reopening it uses the default connection, as before; reading
// it never does (see SetTicketMessagesAsRead).
const BindDefaultWhatsapp = async (ticket: Ticket): Promise<void> => {
  if (ticket.channel !== "whatsapp" || ticket.whatsappId) return;
  const defaultWhatsapp = await GetDefaultWhatsApp(ticket.companyId);
  await ticket.$set("whatsapp", defaultWhatsapp);
};

export default BindDefaultWhatsapp;
