import { isWaitingForSector } from "./generalTriage";
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
