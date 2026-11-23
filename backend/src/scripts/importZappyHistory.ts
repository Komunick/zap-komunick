// Zap Komunick: imports the conversation history exported from ZapContábil
// (Zappy) as closed tickets of one company (docs/PRD.md, RF-029).
//
//   node dist/scripts/importZappyHistory.js --company=2 --file=/path/export.json
//     [--queue-map=/path/queues.json]  {"Nome no ZapContábil": <queueId>}
//     [--default-queue=<queueId>]       queue for names not in the map
//     [--until=<ISO date>]              SuperChat receives the number since
//     [--allow-no-queue]                accept tickets without queue
//     [--execute]                       writes; without it, dry run only
//
// Prints counts and queue/agent names only, never message content. Safe to
// run again: messages already in SuperChat are skipped by id.
import { promises as fs } from "fs";
import { Op } from "sequelize";
import {
  HistoryExport,
  ImportContext,
  messageIdForms,
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
  const allowNoQueue = args.includes("--allow-no-queue");
  const defaultQueue = option("default-queue");
  const untilValue = option("until");
  const until = untilValue ? new Date(untilValue) : null;
  if (
    !Number.isSafeInteger(companyId) ||
    companyId <= 0 ||
    !file ||
    (until && Number.isNaN(until.getTime())) ||
    (defaultQueue !== undefined && !(Number(defaultQueue) > 0))
  ) {
    throw new Error(
      "usage: importZappyHistory --company=<id> --file=<export.json> [--queue-map=<json>] [--default-queue=<id>] [--until=<ISO>] [--allow-no-queue] [--execute]"
    );
  }

  const data = JSON.parse(await fs.readFile(file, "utf8")) as HistoryExport;
  const queueMapFile = option("queue-map");
  const queueMap: Record<string, number> = queueMapFile
    ? JSON.parse(await fs.readFile(queueMapFile, "utf8"))
    : {};

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

    const companyQueueIds = new Set(queues.map(q => q.id));
    const queueIdByName = new Map(
      queues.map(q => [q.name.trim().toLowerCase(), q.id])
    );
    Object.entries(queueMap).forEach(([name, id]) => {
      if (!companyQueueIds.has(Number(id))) {
        throw new Error(
          `queue-map: queue ${id} is not of company ${companyId}`
        );
      }
      queueIdByName.set(name.trim().toLowerCase(), Number(id));
    });
    if (defaultQueue && !companyQueueIds.has(Number(defaultQueue))) {
      throw new Error(
        `default-queue ${defaultQueue} is not of company ${companyId}`
      );
    }

    const ids = Array.from(
      new Set(
        data.tickets.flatMap(t => (t.messages || []).flatMap(messageIdForms))
      )
    );
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += 5000) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await Message.findAll({
        where: { companyId, id: { [Op.in]: ids.slice(i, i + 5000) } },
        attributes: ["id"]
      });
      rows.forEach(row => existing.add(row.id));
    }

    // first stored contact wins when the same number is stored twice
    const contactIdByNumber = new Map<string, number>();
    contacts
      .sort((a, b) => a.id - b.id)
      .forEach(c => {
        if (!contactIdByNumber.has(c.number)) {
          contactIdByNumber.set(c.number, c.id);
        }
      });

    const context: ImportContext = {
      contactIdByNumber,
      queueIdByName,
      defaultQueueId: defaultQueue ? Number(defaultQueue) : null,
      userIdByName: new Map(
        users.map(u => [u.name.trim().toLowerCase(), u.id])
      ),
      existingMessageIds: existing,
      until
    };
    const plan = planImport(data, context);
    const withoutQueue = plan.tickets.filter(t => t.queueId === null).length;

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
          until: until?.toISOString() ?? null,
          exportTickets: data.tickets.length,
          ...plan.totals,
          ticketsWithoutQueue: withoutQueue,
          ticketsWithoutUser: plan.tickets.filter(t => t.userId === null)
            .length,
          skipped: skippedByReason,
          unmatchedQueues: plan.unmatchedQueues,
          unmatchedUsers: plan.unmatchedUsers
        },
        null,
        2
      )}\n`
    );
    if (!execute) return;
    if (withoutQueue > 0 && !allowNoQueue) {
      throw new Error(
        `${withoutQueue} tickets without queue would be hidden from agents (RF-027): map them with --queue-map/--default-queue or pass --allow-no-queue`
      );
    }

    const createdContacts = new Map<string, number>();
    const writeTicket = async (planned: PlannedTicket) =>
      database.transaction(async transaction => {
        let contactId: number;
        let created: { number: string; id: number } | null = null;
        if ("id" in planned.contact) {
          contactId = planned.contact.id;
        } else {
          const { name, number, createdAt } = planned.contact.create;
          contactId = createdContacts.get(number);
          if (!contactId) {
            const [contact] = await Contact.findOrCreate({
              where: { companyId, number },
              defaults: {
                name,
                number,
                companyId,
                isGroup: false,
                createdAt,
                updatedAt: createdAt
              },
              transaction
            });
            contactId = contact.id;
            created = { number, id: contactId };
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
        return created;
      });

    let done = 0;
    const failures: Array<{ externalId: string; error: string }> = [];
    for (let i = 0; i < plan.tickets.length; i += 1) {
      const planned = plan.tickets[i];
      try {
        // one transaction per ticket: a failure keeps the others
        // eslint-disable-next-line no-await-in-loop
        const created = await writeTicket(planned);
        // only after the commit, so a rollback never leaves a dead id here
        if (created) createdContacts.set(created.number, created.id);
        done += 1;
      } catch (err) {
        failures.push({
          externalId: planned.externalId,
          error: String(err?.name || err?.message || err).slice(0, 120)
        });
      }
      if ((i + 1) % 200 === 0) {
        process.stdout.write(`progress ${i + 1}/${plan.tickets.length}\n`);
      }
    }
    process.stdout.write(
      `${JSON.stringify(
        { imported: done, failed: failures.length, failures },
        null,
        2
      )}\n`
    );
    if (failures.length) process.exitCode = 1;
  } finally {
    await database.close();
  }
}

main().catch(err => {
  process.stderr.write(`${err?.message || err}\n`);
  process.exit(1);
});
