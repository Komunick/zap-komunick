import {
  messageIdentity,
  messageListReducer,
  newMessagesForRefresh
} from "./messageListState";
const row = (ticketId, body = "original", extra = {}) => ({
  id: "same-fixture-id",
  ticketId,
  body,
  createdAt: "2026-10-27T12:00:00.000Z",
  ...extra
});
const freeze = rows =>
  rows.map(item =>
    Object.freeze({
      ...item,
      ...(item.replies ? { replies: Object.freeze(item.replies.slice()) } : {})
    })
  );
test("different tickets with the same ID retain distinct list and React identities", () => {
  expect(messageIdentity(row(301))).not.toBe(messageIdentity(row(300)));
});
test("loading another historical page preserves both same-ID attachments", () => {
  const original = row(301);
  const history = row(300, "historical");
  const result = messageListReducer([original], {
    type: "LOAD_MESSAGES",
    payload: [history]
  });
  expect(result).toEqual([history, original]);
});
test.each(["LOAD_MESSAGES", "UPDATE_MESSAGE", "MERGE_MESSAGES", "ADD_MESSAGE"])(
  "%s changes only the matching composite ID without mutating the prior state",
  type => {
    const initial = freeze([row(300, "historical"), row(301, "current")]);
    const next = row(301, "updated");
    const result = messageListReducer(initial, {
      type,
      payload:
        type === "LOAD_MESSAGES" || type === "MERGE_MESSAGES" ? [next] : next
    });
    expect(result.map(message => [message.ticketId, message.body])).toEqual([
      [300, "historical"],
      [301, "updated"]
    ]);
    expect(initial.map(message => message.body)).toEqual([
      "historical",
      "current"
    ]);
  }
);
test("ADD and MERGE preserve new historical/current rows that reuse an existing ID", () => {
  const first = messageListReducer([], {
    type: "ADD_MESSAGE",
    payload: row(300)
  });
  const second = messageListReducer(first, {
    type: "ADD_MESSAGE",
    payload: row(301)
  });
  const merged = messageListReducer(second, {
    type: "MERGE_MESSAGES",
    payload: [row(302)]
  });
  expect(merged.map(message => message.ticketId)).toEqual([300, 301, 302]);
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(2);
});
test("refresh detects a new source ticket even when its ID is already loaded", () => {
  expect(
    newMessagesForRefresh([row(300)], [row(300, "updated"), row(301, "new")])
  ).toEqual([row(301, "new")]);
});
const reaction = (extra = {}) => ({
  id: "reaction-fixture",
  ticketId: 301,
  mediaType: "reactionMessage",
  quotedMsgId: "same-fixture-id",
  body: "fixture-reaction",
  ...extra
});
test("a reaction uses the explicit quoted ticket for duplicate historical target IDs", () => {
  const initial = freeze([row(300), row(301)]);
  const incoming = reaction({
    quotedMsg: { id: "same-fixture-id", ticketId: 300 }
  });
  const result = messageListReducer(initial, {
    type: "ADD_MESSAGE",
    payload: incoming
  });
  expect(result.find(message => message.ticketId === 300).replies).toEqual([
    incoming
  ]);
  expect(
    result.find(
      message => message.ticketId === 301 && message.id === "same-fixture-id"
    ).replies
  ).toBeUndefined();
  expect(initial.every(message => !message.replies)).toBe(true);
});
test("a reaction without a quoted ticket never guesses between duplicate IDs", () => {
  const result = messageListReducer([row(300), row(301)], {
    type: "ADD_MESSAGE",
    payload: reaction()
  });
  expect(
    result
      .filter(message => message.id === "same-fixture-id")
      .every(message => !message.replies)
  ).toBe(true);
});
test("a reaction still reaches a unique historical target, rather than assuming the current ticket", () => {
  const incoming = reaction();
  const result = messageListReducer(freeze([row(300)]), {
    type: "ADD_MESSAGE",
    payload: incoming
  });
  expect(result[0].replies).toEqual([incoming]);
});
test("replayed reaction events do not duplicate replies", () => {
  const incoming = reaction();
  const once = messageListReducer([row(300)], {
    type: "ADD_MESSAGE",
    payload: incoming
  });
  const twice = messageListReducer(once, {
    type: "ADD_MESSAGE",
    payload: { ...incoming, body: "updated reaction" }
  });
  expect(twice[0].replies).toHaveLength(1);
  expect(twice[0].replies[0].body).toBe("updated reaction");
});
test("unique messages keep load/prepend, add/append, update and chronological merge behavior", () => {
  const a = row(301, "a", { id: "a", createdAt: "2026-10-27T12:00:00.000Z" });
  const b = row(301, "b", { id: "b", createdAt: "2026-10-27T13:00:00.000Z" });
  const c = row(301, "c", { id: "c", createdAt: "2026-10-27T12:30:00.000Z" });
  const loaded = messageListReducer([b], {
    type: "LOAD_MESSAGES",
    payload: [a]
  });
  expect(loaded).toEqual([a, b]);
  const merged = messageListReducer(loaded, {
    type: "MERGE_MESSAGES",
    payload: [c]
  });
  expect(merged.map(message => message.id)).toEqual(["a", "c", "b"]);
  const updated = messageListReducer(merged, {
    type: "UPDATE_MESSAGE",
    payload: { ...c, body: "changed" }
  });
  expect(updated[1].body).toBe("changed");
});
test("resetting sticky flags does not mutate source rows", () => {
  const initial = freeze([row(301, "sticky", { bottomStick: true })]);
  expect(
    messageListReducer(initial, { type: "RESET_STICKY" })[0].bottomStick
  ).toBeUndefined();
  expect(initial[0].bottomStick).toBe(true);
  expect(messageListReducer(initial, { type: "RESET" })).toEqual([]);
});
