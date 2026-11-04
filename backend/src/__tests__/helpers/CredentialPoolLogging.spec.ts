import { Sequelize } from "sequelize-typescript";
import { initPoolMonitor } from "../../database/poolMonitor";
import { logger } from "../../utils/logger";

jest.mock("../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), debug: jest.fn() }
}));

test("slow connections never log SQL literals, parameters or credential envelopes", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  const client = { processID: 123, query: jest.fn().mockResolvedValue({}) };
  const pool = {
    acquire: jest.fn().mockResolvedValue(client),
    release: jest.fn(),
    size: 1,
    using: 1,
    available: 0,
    waiting: 0
  };
  try {
    initPoolMonitor({ connectionManager: { pool } } as unknown as Sequelize);
    await pool.acquire();
    await client.query(
      "SELECT 'FROM FICTITIOUS_CREDENTIAL_CANARY' AS value FROM Settings WHERE key = $1",
      ["FICTITIOUS_BOUND_CANARY"]
    );
    clock.mockReturnValue(3500);
    pool.release(client);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const log = JSON.stringify((logger.warn as jest.Mock).mock.calls);
    expect(log).not.toContain("FICTITIOUS_CREDENTIAL_CANARY");
    expect(log).not.toContain("FICTITIOUS_BOUND_CANARY");
    expect(log).not.toContain("SELECT '");
    expect(log).toContain("querySummary");
  } finally {
    clock.mockRestore();
  }
});
