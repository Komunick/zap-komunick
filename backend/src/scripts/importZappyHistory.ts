// Zap Komunick: imports the conversation history exported from ZapContábil
// (Zappy) as closed tickets of one company (docs/PRD.md, RF-029).
//
//   node dist/scripts/importZappyHistory.js --company=2 --file=/path/export.json
//   ... --execute    writes; without it, only prints the plan (dry run)
//
// Prints counts only, never message content. Safe to run again: messages
// already in SuperChat (same WhatsApp id or same imported id) are skipped.
import { promises as fs } from "fs";
import { Op } from "sequelize";
import {
  HistoryExport,
  ImportContext,
  numberCandidates,
  PlannedTicket,
  planImport
} from "../helpers/ZappyHistoryImport";

const args = process.argv.slice(2);
const option = (name: string): string | undefined =>
  args
    .find(arg => arg.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");

async function main(): Promise<void> {
  const companyId = Number(option("company"));
  const file = option("file");
  const execute = args.includes("--execute");
  if (!Number.isSafeInteger(companyId) || companyId <= 0 || !file) {
    throw new Error(
      "usage: importZappyHistory --company=<id> --file=<export.json> [--execute]"
    );
  }

  const data = JSON.parse(await fs.readFile(file, "utf8")) as HistoryExport;

  const database = (await import("../database")).default;
  const Contact = (await import("../models/Contact")).default;
  const Queue = (await import("../models/Queue")).default;
  const User = (await import("../models/User")).default;
  const Ticket = (await import("../models/Ticket")).default;
  const Message = (await import("../models/Message")).default;

  try {
    const numbers = Array.from(
      new Set(data.tickets.flatMap(t => numberCandidates(t.contactNumber)))
    );
    const [contacts, queues, users] = await Promise.all([
      Contact.findAll({
        where: { companyId, number: { [Op.in]: numbers } },
        attributes: ["id", "number"]
      }),
      Queue.findAll({ where: { companyId }, attributes: ["id", "name"] }),
      User.findAll({ where: { companyId }, attributes: ["id", "name"] })
    ]);

    const ids = data.tickets.flatMap(t =>
      (t.messages || []).flatMap(m =>
        [m.whatsappId, `zappy-${m.externalId}`].filter(Boolean)
      )
    ) as string[];
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 5000) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await Message.findAll({
        where: { companyId, id: { [Op.in]: ids.slice(i, i + 5000) } },
        attributes: ["id"]
      });
      rows.forEach(row => existing.add(row.id));
    }

    const context: ImportContext = {
      contactIdByNumber: new Map(contacts.map(c => [c.number, c.id])),
      queueIdByName: new Map(queues.map(q => [q.name.toLowerCase(), q.id])),
      userIdByName: new Map(users.map(u => [u.name.toLowerCase(), u.id])),
      existingMessageIds: existing
    };
    const plan = planImport(data, context);

    const skippedByReason = plan.skipped.reduce<Record<string, number>>(
      (acc, item) => ({ ...acc, [item.reason]: (acc[item.reason] || 0) + 1 }),
      {}
    );
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: execute ? "execute" : "dry-run",
          companyId,
          exportedAt: data.exportedAt,
          exportTickets: data.tickets.length,
          ...plan.totals,
          ticketsWithoutQueue: plan.tickets.filter(t => t.queueId === null)
            .length,
          ticketsWithoutUser: plan.tickets.filter(t => t.userId === null)
            .length,
          skipped: skippedByReason
        },
        null,
        2
      )}\n`
    );
    if (!execute) return;

    const createdContacts = new Map<string, number>();
    const writeTicket = async (planned: PlannedTicket) =>
      database.transaction(async transaction => {
        let contactId: number;
        if ("id" in planned.contact) {
          contactId = planned.contact.id;
        } else {
          const { name, number } = planned.contact.create;
          contactId = createdContacts.get(number);
          if (!contactId) {
            const contact = await Contact.create(
              { name, number, companyId, isGroup: false },
              { transaction }
            );
            contactId = contact.id;
            createdContacts.set(number, contactId);
          }
        }
        const last = planned.messages[planned.messages.length - 1];
        const ticket = await Ticket.create(
          {
            contactId,
            companyId,
            status: "closed",
            queueId: planned.queueId,
            userId: planned.userId,
            whatsappId: null,
            isGroup: false,
            lastMessage: last.body.slice(0, 255),
            unreadMessages: 0,
            createdAt: planned.createdAt,
            updatedAt: planned.updatedAt
          },
          { transaction, silent: true }
        );
        await Message.bulkCreate(
          planned.messages.map(message => ({
            id: message.id,
            ticketId: ticket.id,
            companyId,
            contactId: message.fromMe ? null : contactId,
            body: message.body,
            fromMe: message.fromMe,
            read: true,
            ack: message.fromMe ? 3 : 0,
            mediaType: null,
            queueId: planned.queueId,
            createdAt: message.createdAt,
            updatedAt: message.createdAt
          })),
          // bulkCreate keeps the given createdAt/updatedAt
          { transaction }
        );
      });

    let done = 0;
    for (let i = 0; i < plan.tickets.length; i += 1) {
      // one transaction per ticket: a failure keeps the others
      // eslint-disable-next-line no-await-in-loop
      await writeTicket(plan.tickets[i]);
      done += 1;
      if (done % 200 === 0) {
        process.stdout.write(`imported ${done}/${plan.tickets.length}\n`);
      }
    }
    process.stdout.write(
      `imported ${done} tickets, ${plan.totals.messages} messages, ${createdContacts.size} new contacts\n`
    );
  } finally {
    await database.close();
  }
}

main().catch(err => {
  process.stderr.write(`${err?.message || err}\n`);
  process.exit(1);
});
