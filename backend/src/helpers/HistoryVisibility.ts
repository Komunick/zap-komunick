import { col, fn, Op, WhereOptions } from "sequelize";
import Message from "../models/Message";
import Ticket from "../models/Ticket";

// Zap Komunick: which messages of the OTHER tickets of a client an attendant
// may read when the office keeps "Histórico do cliente para atendentes" in
// "Só dos setores do atendente" (`messageVisibility` = "message"; docs/PRD.md,
// RF-017 and RF-027). One rule for the conversation, its cursor, quotes and
// replies, the files of the ticket and a message opened by id through
// AuthorizeMessageContextService. (The quotes of a transfer note do not come
// here: they are bound to the ticket being transferred.)
//
// IN THE HISTORY, AN ATTENDANT READS THE MESSAGES THEIR SECTOR MAY READ OR
// ALREADY READ, AND NO MESSAGE THAT CAME AFTER THE SECTOR LEFT.
//
// 1. A ticket that is, now, in a sector of the attendant: all of it, exactly
//    as they would by opening it (whoever may open a ticket reads it whole).
// 2. A ticket that left their sector (transferred to another one, or left
//    without a sector): everything that was already in the conversation up to
//    the last message exchanged in their sector. The sector of a message is
//    the one written on it (`Messages.queueId`: the sector the ticket was in
//    when the message was exchanged), so a message of their sector proves the
//    ticket was theirs at that moment, with everything said before it in
//    view, whatever sector those earlier messages carry (the client who
//    wrote to Financeiro before being handed to Fiscal). What the next sector
//    exchanges afterwards is later than that message and stays out.
// 3. A ticket their sector never exchanged a message in, and that is not in
//    their sector now: nothing.
//
// Reported on 26/11/2026: the history used to follow only where the ticket is
// NOW, so transferring a client took away from the attendant the conversation
// they had just had.
//
// The ticket that is open is not decided here: it is read whole.
//
// WHAT THE RULE DOES NOT PROMISE. It decides WHICH messages appear, by when
// each was exchanged (`createdAt`, always the moment the row was stored), not
// their later state: a message that was already in the conversation and is
// edited or deleted after the sector left appears as it is now, marked as
// edited or deleted. The edit history stays with the sector of the ticket.
//
// COST. One grouped query over the messages of the tickets that left, and one
// OR term per ticket that left and has a message of the sector, in each copy
// of the filter. Fine for tens of such tickets per client; with hundreds (an
// office with `keepUserAndQueue` disabled, where closing takes the sector off
// the ticket) add an index on Messages (ticketId, queueId, createdAt) first.

export interface SectorReach {
  ticketId: number;
  // the last message exchanged in a sector of the attendant on that ticket
  until: Date;
}

export interface SectorHistory {
  // tickets of the client that are now in a sector of the attendant
  sectorTicketIds: number[];
  // tickets that left: how far the sector of the attendant went in each
  reach: SectorReach[];
}

export const NO_SECTOR_HISTORY: SectorHistory = {
  sectorTicketIds: [],
  reach: []
};

interface TicketSector {
  id: number;
  queueId: number | null;
}

const inSectors = (queueIds: number[], queueId: number | null | undefined) =>
  queueId !== null && queueId !== undefined && queueIds.includes(queueId);

// Given the tickets of ONE client in ONE office (the caller bounds both), how
// far the sectors of the attendant reach in each.
export const sectorHistoryOf = async (
  tickets: TicketSector[],
  companyId: number,
  queueIds: number[],
  currentTicketId: number
): Promise<SectorHistory> => {
  if (!queueIds.length) return NO_SECTOR_HISTORY;
  const sectorTicketIds = tickets
    .filter(ticket => inSectors(queueIds, ticket.queueId))
    .map(ticket => ticket.id);
  const gone = tickets
    .filter(
      ticket =>
        ticket.id !== currentTicketId && !inSectors(queueIds, ticket.queueId)
    )
    .map(ticket => ticket.id);
  if (!gone.length) return { sectorTicketIds, reach: [] };
  const rows = (await Message.findAll({
    attributes: ["ticketId", [fn("max", col("createdAt")), "until"]],
    where: {
      ticketId: { [Op.in]: gone },
      companyId,
      queueId: { [Op.in]: queueIds }
    },
    group: ["ticketId"],
    raw: true,
    logging: false
  })) as unknown as { ticketId: number; until: Date | string }[];
  return {
    sectorTicketIds,
    // a row without a date opens nothing (`new Date(null)` would be 1970)
    reach: rows
      .filter(row => row.until)
      .map(row => ({
        ticketId: Number(row.ticketId),
        until: new Date(row.until)
      }))
      .filter(row => !Number.isNaN(row.until.getTime()))
  };
};

// The same, loading the tickets of the client.
export const loadSectorHistory = async (
  contactId: number,
  companyId: number,
  queueIds: number[],
  currentTicketId: number
): Promise<SectorHistory> => {
  if (!queueIds.length) return NO_SECTOR_HISTORY;
  const tickets = await Ticket.findAll({
    where: { contactId, companyId },
    attributes: ["id", "queueId"]
  });
  return sectorHistoryOf(tickets, companyId, queueIds, currentTicketId);
};

// The rule as a filter of `Messages`. It does not bound the client or the
// office: the caller does.
//
// The second branch looks redundant with the third (a message of the sector
// is never later than the last message of the sector) and is not: `until` is
// a JavaScript date, of milliseconds, and PostgreSQL keeps microseconds, so
// the very last message of the sector could fall just after it.
export const sectorHistoryFence = (
  currentTicketId: number,
  queueIds: number[],
  history: SectorHistory
): WhereOptions => ({
  [Op.or]: [
    {
      ticketId: {
        [Op.in]: Array.from(
          new Set([currentTicketId, ...history.sectorTicketIds])
        )
      }
    },
    { queueId: { [Op.in]: queueIds } },
    ...history.reach.map(({ ticketId, until }) => ({
      ticketId,
      createdAt: { [Op.lte]: until }
    }))
  ]
});

// The part of the rule that needs no query, for one message of another ticket
// of the client: its ticket is in a sector of the attendant now, or the
// message itself was exchanged in one.
export const seesHistoryMessage = (
  queueIds: number[],
  messageQueueId: number | null | undefined,
  sourceTicketQueueId: number | null | undefined
): boolean =>
  inSectors(queueIds, sourceTicketQueueId) ||
  inSectors(queueIds, messageQueueId);

// The rest of it: the message was already in the conversation when a sector
// of the attendant last exchanged a message on that ticket. Asked to the
// database with the same comparison as the filter above, so that a message
// opened by id and the list never disagree.
export const sectorReachedMessage = async (
  message: { id: string; ticketId: number },
  companyId: number,
  queueIds: number[]
): Promise<boolean> => {
  if (!queueIds.length) return false;
  const last = await Message.findOne({
    where: {
      ticketId: message.ticketId,
      companyId,
      queueId: { [Op.in]: queueIds }
    },
    attributes: ["createdAt"],
    order: [["createdAt", "DESC"]],
    logging: false
  });
  if (!last || !last.createdAt) return false;
  const until = new Date(last.createdAt);
  if (Number.isNaN(until.getTime())) return false;
  const found = await Message.count({
    where: {
      id: message.id,
      ticketId: message.ticketId,
      companyId,
      createdAt: { [Op.lte]: until }
    },
    logging: false
  });
  return found > 0;
};
