import {
  formatQueueMenu,
  pickMenuQueue,
  queuePositions,
  sortWhatsappQueues
} from "../../helpers/WhatsappQueueMenu";

const queue = (id: number, name: string, position?: number | null) => ({
  id,
  name,
  WhatsappQueue: position === undefined ? undefined : { position }
});

// JB Fraga: the order of the Zappy Contábil menu, which is not alphabetical.
const jbFraga = [
  queue(7, "Atendimento geral", 6),
  queue(10, "Contábil", 5),
  queue(9, "Financeiro", 2),
  queue(2, "Fiscal", 4),
  queue(8, "Legalização", 1),
  queue(3, "Pessoal", 3)
];

describe("sortWhatsappQueues", () => {
  it("follows the order saved for the channel, not the name", () => {
    expect(sortWhatsappQueues(jbFraga).map(q => q.name)).toEqual([
      "Legalização",
      "Financeiro",
      "Pessoal",
      "Fiscal",
      "Contábil",
      "Atendimento geral"
    ]);
  });

  it("keeps the query order (alphabetical) when nothing was saved", () => {
    const queues = [
      queue(1, "Comercial"),
      queue(2, "Financeiro", null),
      queue(3, "Suporte")
    ];
    expect(sortWhatsappQueues(queues).map(q => q.id)).toEqual([1, 2, 3]);
  });

  it("puts queues linked after the last save at the end", () => {
    const queues = [
      queue(1, "Comercial", null),
      queue(2, "Financeiro", 2),
      queue(3, "Suporte", 1)
    ];
    expect(sortWhatsappQueues(queues).map(q => q.id)).toEqual([3, 2, 1]);
  });

  it("does not change the array it receives", () => {
    const queues = [queue(1, "B", 2), queue(2, "A", 1)];
    sortWhatsappQueues(queues);
    expect(queues.map(q => q.id)).toEqual([1, 2]);
  });
});

describe("formatQueueMenu", () => {
  const ordered = sortWhatsappQueues(jbFraga);

  it("numbers the options in the saved order", () => {
    expect(formatQueueMenu(ordered)).toBe(
      "*[ 1 ]* - Legalização\n" +
        "*[ 2 ]* - Financeiro\n" +
        "*[ 3 ]* - Pessoal\n" +
        "*[ 4 ]* - Fiscal\n" +
        "*[ 5 ]* - Contábil\n" +
        "*[ 6 ]* - Atendimento geral\n"
    );
  });

  it("uses the number label given (numeric icons)", () => {
    expect(formatQueueMenu(ordered.slice(0, 2), number => `<${number}>`)).toBe(
      "<1> - Legalização\n<2> - Financeiro\n"
    );
  });
});

describe("pickMenuQueue", () => {
  const ordered = sortWhatsappQueues(jbFraga);
  const general = ordered.find(q => q.id === 7);

  it.each([
    ["1", 8],
    ["2", 9],
    ["3", 3],
    ["4", 2],
    ["5", 10],
    ["6", 7],
    [" 4 ", 2],
    ["04", 2]
  ])("reads %p as the queue of that number in the menu", (reply, id) => {
    expect(pickMenuQueue(ordered, reply)?.id).toBe(id);
  });

  it.each([null, undefined, "", "  ", "0", "7", "-1", "1.5", "um", "2 fiscal"])(
    "ignores %p",
    reply => {
      expect(pickMenuQueue(ordered, reply)).toBeNull();
    }
  );

  it("reads the word geral as the general triage queue", () => {
    expect(pickMenuQueue(ordered, "geral", general)?.id).toBe(7);
    expect(pickMenuQueue(ordered, " GERAL ", general)?.id).toBe(7);
  });

  it("does not read geral without a general triage queue", () => {
    expect(pickMenuQueue(ordered, "geral")).toBeNull();
    expect(pickMenuQueue(ordered, "geral", null)).toBeNull();
  });

  it("still reads numbers when there is a general triage queue", () => {
    expect(pickMenuQueue(ordered, "1", general)?.id).toBe(8);
  });
});

describe("queuePositions", () => {
  it("numbers the queue ids in the order sent", () => {
    expect(queuePositions([8, 9, 3, 2, 10, 7])).toEqual([
      { queueId: 8, position: 1 },
      { queueId: 9, position: 2 },
      { queueId: 3, position: 3 },
      { queueId: 2, position: 4 },
      { queueId: 10, position: 5 },
      { queueId: 7, position: 6 }
    ]);
  });

  it("drops repeated and invalid ids without leaving gaps", () => {
    expect(queuePositions([5, "5", "x", 2, 1.5, "3"])).toEqual([
      { queueId: 5, position: 1 },
      { queueId: 2, position: 2 },
      { queueId: 3, position: 3 }
    ]);
  });
});
