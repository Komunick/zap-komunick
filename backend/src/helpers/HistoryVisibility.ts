import { Op, WhereOptions } from "sequelize";
import Ticket from "../models/Ticket";

// Zap Komunick: which messages of the OTHER tickets of a client an attendant
// may read when the office keeps "Histórico do cliente para atendentes" in
// "Só dos setores do atendente" (`messageVisibility` = "message"; docs/PRD.md,
// RF-017 and RF-027). One rule for the conversation, its cursor, quotes and
// replies, the files of the ticket and every message opened by id.
//
// THE SECTOR OF A MESSAGE IS THE ONE WRITTEN ON THE MESSAGE: the sector the
// ticket was in when the message was exchanged. Where the ticket is NOW does
// not take a message away from the sector that exchanged it: an attendant who
// talked to the client and transferred the ticket to another sector still
// reads that part of the conversation from any other ticket of the client.
// What the other sector exchanged after the transfer carries the other
// sector, and stays out.
//
// A message without a sector (the menu of the robot, old rows) has nothing of
// its own to go by: it follows the sector its ticket is in now, as before.
//
// The ticket that is open is not decided here: whoever may open a ticket reads
// all of it (the context a transfer hands over).

// Tickets of the client that are, now, in a sector of the attendant: the ones
// whose messages without a sector may be read.
export const loadSectorTicketIds = async (
  contactId: number,
  companyId: number,
  queueIds: number[]
): Promise<number[]> => {
  if (!queueIds.length) return [];
  const tickets = await Ticket.findAll({
    where: { contactId, companyId, queueId: { [Op.in]: queueIds } },
    attributes: ["id"]
  });
  return tickets.map(ticket => ticket.id);
};

// The same rule as a filter of `Messages`. It does not bound the client or
// the office: the caller does.
export const sectorHistoryFence = (
  currentTicketId: number,
  queueIds: number[],
  sectorTicketIds: number[]
): WhereOptions => ({
  [Op.or]: [
    { ticketId: currentTicketId },
    { queueId: { [Op.in]: queueIds } },
    { queueId: null, ticketId: { [Op.in]: sectorTicketIds } }
  ]
});

// The same rule for one message of another ticket of the client.
export const seesHistoryMessage = (
  queueIds: number[],
  messageQueueId: number | null,
  sourceTicketQueueId: number | null
): boolean => {
  if (messageQueueId !== null && messageQueueId !== undefined)
    return queueIds.includes(messageQueueId);
  return (
    sourceTicketQueueId !== null &&
    sourceTicketQueueId !== undefined &&
    queueIds.includes(sourceTicketQueueId)
  );
};
