import { visibleReactions } from "./messageReactions";
import { messageListReducer } from "./messageListState";

const reaction = (id, body, extra = {}) => ({
  id,
  ticketId: 301,
  mediaType: "reactionMessage",
  body,
  fromMe: false,
  contactId: 77,
  quotedMsgId: "original-fixture",
  createdAt: "2026-11-17T12:00:00.000Z",
  ...extra
});

test("shows a client's reaction", () => {
  expect(visibleReactions([reaction("r1", "👍")]).map(r => r.body)).toEqual([
    "👍"
  ]);
});

test("keeps only the latest reaction of each sender", () => {
  const replies = [
    reaction("r2", "❤️", { createdAt: "2026-11-17T12:05:00.000Z" }),
    reaction("r1", "👍"),
    reaction("r3", "🙏", { fromMe: true, contactId: null })
  ];
  expect(visibleReactions(replies).map(r => r.body)).toEqual(["❤️", "🙏"]);
});

test("a removed reaction disappears", () => {
  const replies = [
    reaction("r1", "👍"),
    reaction("r2", "reaction", { createdAt: "2026-11-17T12:05:00.000Z" })
  ];
  expect(visibleReactions(replies)).toEqual([]);
});

test("group members each keep their own reaction", () => {
  const replies = [
    reaction("r1", "👍", { contactId: 1 }),
    reaction("r2", "😂", { contactId: 2 })
  ];
  expect(visibleReactions(replies)).toHaveLength(2);
});

test("ignores replies that are not reactions", () => {
  expect(
    visibleReactions([{ id: "x", mediaType: null, body: "resposta" }])
  ).toEqual([]);
  expect(visibleReactions(undefined)).toEqual([]);
});

test("a reaction arriving live attaches to the original message", () => {
  const original = {
    id: "original-fixture",
    ticketId: 301,
    body: "Segue a guia",
    createdAt: "2026-11-17T11:00:00.000Z"
  };
  const next = messageListReducer([original], {
    type: "ADD_MESSAGE",
    payload: reaction("r1", "👍", {
      quotedMsg: { id: "original-fixture", ticketId: 301 }
    })
  });
  expect(visibleReactions(next[0].replies).map(r => r.body)).toEqual(["👍"]);
});
