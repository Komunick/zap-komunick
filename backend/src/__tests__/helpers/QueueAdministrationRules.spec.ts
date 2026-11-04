import {
  queueEntityId,
  queueMediaName,
  queueMediaPath,
  queueOptionFields
} from "../../helpers/QueueAdministrationRules";

test.each([1, "1", 101, "9007199254740991"])(
  "accepts canonical safe entity id %p",
  value => expect(queueEntityId(value)).toBe(Number(value))
);

test.each([
  0,
  -1,
  1.5,
  "",
  " ",
  "01",
  "+1",
  "1e0",
  "NaN",
  "9007199254740992",
  [],
  {},
  null
])("rejects malformed entity id %p", value =>
  expect(() => queueEntityId(value)).toThrow(
    expect.objectContaining({ message: "ERR_BAD_REQUEST", statusCode: 400 })
  )
);

test("option edits retain only supported fields and normalize relationship ids", () => {
  expect(
    queueOptionFields({
      title: "QA",
      queueId: "10",
      parentId: "",
      forwardQueueId: null,
      exitChatbot: true,
      id: 500,
      companyId: 2,
      mediaPath: "media/2/other.png",
      mediaName: "other.png",
      children: []
    })
  ).toEqual({
    title: "QA",
    queueId: 10,
    parentId: null,
    forwardQueueId: null,
    exitChatbot: true
  });
});

test.each([null, [], "not-object"])(
  "rejects a non-record option payload %p",
  value => {
    expect(() =>
      queueOptionFields(value as unknown as Record<string, unknown>)
    ).toThrow(
      expect.objectContaining({ message: "ERR_BAD_REQUEST", statusCode: 400 })
    );
  }
);

test.each([
  "media/1/queue-ficticio/image.png",
  "media-persistant/1/fixture/file.pdf",
  "legacy.png"
])("retains own safe media reference %s", value =>
  expect(queueMediaPath(value, 1)).toBe(value)
);

test.each([
  "../outside.png",
  "/outside.png",
  "media/2/other.png",
  "media/1/../other.png",
  "C:\\outside.png",
  "media\\1\\other.png",
  "https://other.invalid/file",
  "media//1/file"
])("rejects unsafe or foreign storage path %s", value =>
  expect(() => queueMediaPath(value, 1)).toThrow(
    expect.objectContaining({ message: "ERR_QUEUE_NOT_FOUND", statusCode: 404 })
  )
);

test("keeps benign filenames and prevents dot-only destinations", () => {
  expect(queueMediaName("comprovante-ficticio.pdf")).toBe(
    "comprovante-ficticio.pdf"
  );
  expect(() => queueMediaName("..")).toThrow(
    expect.objectContaining({ message: "ERR_BAD_REQUEST", statusCode: 400 })
  );
});
