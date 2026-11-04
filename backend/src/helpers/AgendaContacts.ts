// Zap Komunick: the WhatsApp address book becomes clients in Contacts
// (docs/PRD.md, RF-018), so a client shows up before writing for the first
// time. Groups, broadcast lists, channels and ids without a number are left out.

export interface AgendaEntry {
  id?: string | null;
  lid?: string | null;
  phoneNumber?: string | null;
  jid?: string | null;
  name?: string | null;
  notify?: string | null;
  verifiedName?: string | null;
}

export interface AgendaContact {
  number: string;
  name: string;
}

const USER_JID = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/;

const numberOf = (entry: AgendaEntry): string | null => {
  const candidates = [entry.id, entry.phoneNumber, entry.jid].filter(Boolean);
  for (let i = 0; i < candidates.length; i += 1) {
    const match = USER_JID.exec(String(candidates[i]));
    if (match) return match[1];
  }
  return null;
};

/** Clients to create, one per number, with the best name the phone has. */
export function agendaToContacts(entries: AgendaEntry[]): AgendaContact[] {
  const byNumber = new Map<string, AgendaContact>();
  (entries || []).forEach(entry => {
    const number = numberOf(entry || {});
    if (!number) return;
    const name = (
      entry.name ||
      entry.verifiedName ||
      entry.notify ||
      ""
    ).trim();
    const current = byNumber.get(number);
    // a saved name beats the profile name; the number is the last resort
    if (!current || (current.name === number && name)) {
      byNumber.set(number, { number, name: name || number });
    }
  });
  return Array.from(byNumber.values());
}
