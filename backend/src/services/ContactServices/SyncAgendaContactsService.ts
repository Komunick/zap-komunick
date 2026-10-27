import { Op } from "sequelize";
import Contact from "../../models/Contact";
import { GetCompanySetting } from "../../helpers/CheckSettings";
import { agendaToContacts, AgendaEntry } from "../../helpers/AgendaContacts";
import { logger } from "../../utils/logger";

// Zap Komunick: clients of the WhatsApp address book in Contacts (docs/PRD.md,
// RF-018). Only adds the numbers that are missing; never renames a contact the
// team already has. On by default, setting "syncPhoneContacts".

const SyncAgendaContactsService = async (
  companyId: number,
  entries: AgendaEntry[]
): Promise<number> => {
  if (
    (await GetCompanySetting(companyId, "syncPhoneContacts", "enabled")) !==
    "enabled"
  ) {
    return 0;
  }

  const agenda = agendaToContacts(entries);
  if (!agenda.length) return 0;

  const existing = await Contact.findAll({
    where: { companyId, number: { [Op.in]: agenda.map(c => c.number) } },
    attributes: ["number"]
  });
  const known = new Set(existing.map(c => c.number));
  const missing = agenda.filter(c => !known.has(c.number));
  if (!missing.length) return 0;

  await Contact.bulkCreate(
    missing.map(c => ({
      name: c.name,
      number: c.number,
      email: "",
      isGroup: false,
      companyId
    })) as never[],
    { ignoreDuplicates: true }
  );
  logger.info(
    { companyId, created: missing.length },
    "Clients added from the WhatsApp address book"
  );
  return missing.length;
};

export default SyncAgendaContactsService;
