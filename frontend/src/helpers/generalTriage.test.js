import {
  chipQueueId,
  isWaitingForSector,
  outsideSelectedQueues
} from "./generalTriage";
import { komunickMessages } from "../translate/languages/komunick";

// A conversation whose customer has not picked a sector yet, as the server
// sends it.
const waiting = {
  id: 694,
  status: "pending",
  queueId: null,
  queue: null,
  userId: null,
  isGroup: false,
  generalTriageStartedAt: "2026-11-25T14:11:00.000Z"
};

it("recognises a conversation waiting for the customer to pick a sector", () => {
  expect(isWaitingForSector(waiting)).toBe(true);
  // the list payload may leave `queue` out
  const { queue, ...withoutQueue } = waiting;
  expect(queue).toBeNull();
  expect(isWaitingForSector(withoutQueue)).toBe(true);
});

it.each([
  ["has a sector", { queueId: 8 }],
  ["has a sector (object only)", { queue: { id: 8, name: "Legalização" } }],
  [
    "never entered the wait (started from the phone)",
    {
      generalTriageStartedAt: null
    }
  ],
  ["has no wait field at all", { generalTriageStartedAt: undefined }],
  ["was taken by someone", { userId: 3 }],
  ["is in service", { status: "open" }],
  ["is closed", { status: "closed" }],
  ["is a group", { isGroup: true }]
])("does not take for it a conversation that %s", (_reason, change) => {
  expect(isWaitingForSector({ ...waiting, ...change })).toBe(false);
});

it("is false for nothing", () => {
  expect(isWaitingForSector(null)).toBe(false);
  expect(isWaitingForSector(undefined)).toBe(false);
});

it.each(["pt", "pt_PT", "en", "es"])("has the label in %s", language => {
  expect(
    komunickMessages[language].translations.generalTriage.waiting.trim()
  ).not.toBe("");
});

describe("the queue chips of the list", () => {
  const attendant = { profile: "user", generalQueueId: 7 };
  const admin = { profile: "admin", generalQueueId: 7 };
  const ofLegal = { ...waiting, queueId: 8, generalTriageStartedAt: null };
  const fromPhone = { ...waiting, generalTriageStartedAt: null };

  it("counts a waiting conversation in the general queue for an attendant", () => {
    expect(chipQueueId(waiting, attendant)).toBe(7);
    expect(chipQueueId(ofLegal, attendant)).toBe(8);
    expect(chipQueueId(fromPhone, attendant)).toBe(0);
  });

  it("hides it when the chip of the general queue is off, like the server does", () => {
    expect(outsideSelectedQueues(waiting, [7, 8], attendant)).toBe(false);
    expect(outsideSelectedQueues(waiting, [8], attendant)).toBe(true);
    expect(outsideSelectedQueues(waiting, [], attendant)).toBe(true);
  });

  it("keeps the rule of every other ticket as it was", () => {
    expect(outsideSelectedQueues(ofLegal, [8], attendant)).toBe(false);
    expect(outsideSelectedQueues(ofLegal, [7], attendant)).toBe(true);
    // a ticket without a sector that is not waiting has no chip to follow
    expect(outsideSelectedQueues(fromPhone, [], attendant)).toBe(false);
  });

  it("changes nothing for an administrator", () => {
    expect(chipQueueId(waiting, admin)).toBe(0);
    expect(outsideSelectedQueues(waiting, [8], admin)).toBe(false);
    expect(outsideSelectedQueues(ofLegal, [7], admin)).toBe(true);
  });

  it("shows the conversation while the general queue is not known yet", () => {
    // the setting has not loaded (or the company has no triage)
    const unknown = { profile: "user", generalQueueId: 0 };
    expect(outsideSelectedQueues(waiting, [8], unknown)).toBe(false);
    expect(outsideSelectedQueues(waiting, [8], { profile: "user" })).toBe(
      false
    );
  });
});
