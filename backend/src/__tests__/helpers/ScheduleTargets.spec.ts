import {
  isValidScheduleMediaPath,
  MAX_SCHEDULE_RECIPIENTS,
  mergeRecipients
} from "../../helpers/ScheduleTargets";

describe("isValidScheduleMediaPath", () => {
  it("accepts a stored attachment of the same company", () => {
    expect(
      isValidScheduleMediaPath("media-persistant/1/aB3dE5gH7j/guia DAS.pdf", 1)
    ).toBe(true);
  });

  it("refuses an attachment of another company", () => {
    expect(
      isValidScheduleMediaPath("media-persistant/2/aB3dE5gH7j/guia.pdf", 1)
    ).toBe(false);
  });

  it.each([
    "../../etc/passwd",
    "media-persistant/1/../../.env",
    "media/1/aB3dE5gH7j/guia.pdf",
    "/media-persistant/1/aB3dE5gH7j/guia.pdf",
    "media-persistant/1/aB3dE5gH7j/sub/guia.pdf",
    "media-persistant/1/aB3dE5gH7j/..",
    ""
  ])("refuses %p", path => {
    expect(isValidScheduleMediaPath(path, 1)).toBe(false);
  });

  it("refuses values that are not text", () => {
    expect(isValidScheduleMediaPath(null, 1)).toBe(false);
    expect(isValidScheduleMediaPath(42, 1)).toBe(false);
  });
});

describe("mergeRecipients", () => {
  it("joins chosen contacts and tag contacts without repeating", () => {
    expect(mergeRecipients([3, "4", 4], [4, 5])).toEqual([3, 4, 5]);
  });

  it("ignores invalid ids", () => {
    expect(mergeRecipients(["x", -1, 0, 2.5, 7], [])).toEqual([7]);
  });

  it("refuses an empty recipient list", () => {
    expect(() => mergeRecipients([], [])).toThrow("ERR_SCHEDULE_NO_RECIPIENTS");
  });

  it("refuses more recipients than the limit", () => {
    const many = Array.from(
      { length: MAX_SCHEDULE_RECIPIENTS + 1 },
      (_, index) => index + 1
    );
    expect(() => mergeRecipients(many, [])).toThrow(
      "ERR_SCHEDULE_TOO_MANY_RECIPIENTS"
    );
  });
});
