import { reconnectWithRetry } from "../../helpers/ReconnectRetry";

describe("ReconnectRetry", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const advance = async (ms: number) => {
    // @types/jest 27 does not know the function jest 29 has
    await (
      jest as unknown as {
        advanceTimersByTimeAsync: (time: number) => Promise<void>;
      }
    ).advanceTimersByTimeAsync(ms);
  };

  it("starts once, after the delay", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    reconnectWithRetry("Teste", start, async () => true, 2000);

    await advance(1999);
    expect(start).not.toHaveBeenCalled();
    await advance(1);
    expect(start).toHaveBeenCalledTimes(1);
    await advance(60 * 60 * 1000);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("keeps trying when the attempt fails, until it works", async () => {
    const start = jest
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(undefined);
    reconnectWithRetry("Teste", start, async () => true, 2000);

    await advance(60 * 60 * 1000);
    expect(start).toHaveBeenCalledTimes(3);
  });

  it("also survives a failure to look the connection up", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    const exists = jest
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(true);
    reconnectWithRetry("Teste", start, exists, 2000);

    await advance(60 * 60 * 1000);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("stops when the connection was deleted", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    reconnectWithRetry("Teste", start, async () => false, 2000);

    await advance(60 * 60 * 1000);
    expect(start).not.toHaveBeenCalled();
  });
});
