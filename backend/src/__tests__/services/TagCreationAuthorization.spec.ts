import Tag from "../../models/Tag";
import CreateService from "../../services/TagServices/CreateService";

jest.mock("../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));

interface TagFields {
  name: string;
  color: string;
  kanban: number;
  companyId: number;
  queueIds?: number[] | null;
}
interface StoredTag extends TagFields {
  id: number;
  update: jest.Mock;
  reload: jest.Mock;
}

const request: TagFields = {
  name: "Fiscal fictício",
  color: "#6B7280",
  kanban: 1,
  companyId: 10
};
let records: StoredTag[];
function storedTag(fields: TagFields, id = 100): StoredTag {
  const record: StoredTag = {
    ...fields,
    id,
    queueIds: fields.queueIds ?? null,
    update: jest.fn(),
    reload: jest.fn()
  };
  record.update.mockImplementation(async patch => {
    Object.assign(record, patch);
    return record;
  });
  record.reload.mockResolvedValue(record);
  return record;
}

beforeEach(() => {
  jest.clearAllMocks();
  records = [];
  (Tag.findOrCreate as jest.Mock).mockImplementation(
    async ({ where, defaults }: { where: TagFields; defaults: TagFields }) => {
      const existing = records.find(
        record =>
          record.name === where.name &&
          record.color === where.color &&
          record.kanban === where.kanban &&
          record.companyId === where.companyId
      );
      if (existing) return [existing, false];
      const created = storedTag(defaults, records.length + 100);
      records.push(created);
      return [created, true];
    }
  );
});

describe("idempotent tag creation preserves existing sector authorization", () => {
  // POST can create a tag; changing an existing tag belongs to the authorized PUT.
  it.each([{ queueIds: null }, { queueIds: [202] }])(
    "does not replace an existing tag's sectors with %j",
    async ({ queueIds }) => {
      const existing = storedTag({ ...request, queueIds: [101] });
      records.push(existing);

      const result = await CreateService({ ...request, queueIds });

      expect(result).toBe(existing);
      expect(existing.queueIds).toEqual([101]);
      expect(existing.update).not.toHaveBeenCalled();
      expect(records).toHaveLength(1);
    }
  );

  it("keeps the existing tag when the create request omits sectors", async () => {
    const existing = storedTag({ ...request, queueIds: [101] });
    records.push(existing);

    expect(await CreateService(request)).toBe(existing);
    expect(existing.queueIds).toEqual([101]);
    expect(existing.update).not.toHaveBeenCalled();
  });

  it.each([
    { label: "selected sectors", queueIds: [101, 102], expected: [101, 102] },
    { label: "explicit global scope", queueIds: null, expected: null },
    { label: "omitted sectors", queueIds: undefined, expected: null }
  ])("persists a new tag with $label", async ({ queueIds, expected }) => {
    const result = await CreateService({ ...request, queueIds });

    expect(records).toHaveLength(1);
    expect(result).toBe(records[0]);
    expect(result.companyId).toBe(10);
    expect(result.queueIds).toEqual(expected);
  });

  it("creates within the requested company without mutating an equal foreign tag", async () => {
    const foreign = storedTag({ ...request, companyId: 20, queueIds: [202] });
    records.push(foreign);

    const result = await CreateService({ ...request, queueIds: [101] });

    expect(result).not.toBe(foreign);
    expect(result.companyId).toBe(10);
    expect(result.queueIds).toEqual([101]);
    expect(foreign.queueIds).toEqual([202]);
    expect(foreign.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid name before repository access", async () => {
    await expect(CreateService({ ...request, name: "" })).rejects.toMatchObject(
      {
        statusCode: 400
      }
    );
    expect(Tag.findOrCreate).not.toHaveBeenCalled();
  });
});
