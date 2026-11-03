import ListAuditLogsService from "../../services/AuditServices/ListAuditLogsService";
import AuditLog from "../../models/AuditLog";

jest.mock("../../models/AuditLog", () => ({ findAndCountAll: jest.fn() }));
jest.mock("../../models/User", () => ({}));

describe("audit log boundaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AuditLog.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 0,
      rows: []
    });
  });

  it.each(["1.5", "Infinity", "-1", "0", "abc"])(
    "rejects invalid page %s before querying",
    async pageNumber => {
      await expect(
        ListAuditLogsService({ companyId: 7, pageNumber })
      ).rejects.toMatchObject({ message: "ERR_AUDIT_INVALID_FILTER" });
      expect(AuditLog.findAndCountAll).not.toHaveBeenCalled();
    }
  );

  it("rejects a reversed date range", async () => {
    await expect(
      ListAuditLogsService({
        companyId: 7,
        from: "2026-10-28",
        to: "2026-10-27"
      })
    ).rejects.toMatchObject({ message: "ERR_AUDIT_INVALID_FILTER" });
    expect(AuditLog.findAndCountAll).not.toHaveBeenCalled();
  });

  it("retains the company boundary alongside actor and action filters", async () => {
    await ListAuditLogsService({
      companyId: 7,
      userId: "42",
      action: "auth.",
      pageNumber: "2"
    });
    expect(AuditLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 7, userId: 42 }),
        limit: 50,
        offset: 50
      })
    );
  });
});
