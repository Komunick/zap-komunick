import { agendaToContacts } from "../../helpers/AgendaContacts";

describe("agendaToContacts", () => {
  it("turns phone contacts into clients with their saved name", () => {
    expect(
      agendaToContacts([
        { id: "5571999990001@s.whatsapp.net", name: "Padaria Avenida" },
        { id: "5571999990002@s.whatsapp.net", notify: "Ana" }
      ])
    ).toEqual([
      { number: "5571999990001", name: "Padaria Avenida" },
      { number: "5571999990002", name: "Ana" }
    ]);
  });

  it("leaves out groups, broadcasts, channels and junk", () => {
    expect(
      agendaToContacts([
        { id: "120363000000000001@g.us", name: "Grupo" },
        { id: "status@broadcast" },
        { id: "120363000000000002@newsletter", name: "Canal" },
        { id: "abc@s.whatsapp.net" },
        { id: null },
        null as never
      ])
    ).toEqual([]);
  });

  it("uses the phone number of a contact known only by its LID", () => {
    expect(
      agendaToContacts([
        {
          id: "123456789012345@lid",
          phoneNumber: "5571999990003@s.whatsapp.net",
          name: "Oficina"
        },
        { id: "123456789099999@lid", name: "Sem número" }
      ])
    ).toEqual([{ number: "5571999990003", name: "Oficina" }]);
  });

  it("keeps one entry per number, preferring a real name", () => {
    expect(
      agendaToContacts([
        { id: "5571999990004@s.whatsapp.net" },
        { id: "5571999990004:12@s.whatsapp.net", name: "Mercado" }
      ])
    ).toEqual([{ number: "5571999990004", name: "Mercado" }]);
  });

  it("falls back to the number when the phone has no name", () => {
    expect(agendaToContacts([{ id: "5571999990005@s.whatsapp.net" }])).toEqual([
      { number: "5571999990005", name: "5571999990005" }
    ]);
  });
});
