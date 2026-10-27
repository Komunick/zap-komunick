import {
  backoffDelay,
  BASE_DELAY_MS,
  decideReconnect,
  MAX_DELAY_MS
} from "../../helpers/ReconnectPolicy";

const noJitter = () => 0;

describe("decideReconnect", () => {
  it.each([401, 403, 411, 500])(
    "asks for a new QR code when the session is gone (%i)",
    code => {
      expect(decideReconnect(code, 0).action).toBe("logout");
    }
  );

  it("does not fight another client that took the session (440)", () => {
    expect(decideReconnect(440, 0)).toEqual({
      action: "stop",
      reason: "connectionReplaced"
    });
  });

  it("reconnects at once after pairing (515)", () => {
    expect(decideReconnect(515, 7)).toEqual({
      action: "reconnect",
      reason: "restartRequired",
      delayMs: 500
    });
  });

  it.each([408, 428, 503, undefined, 999])(
    "reconnects network hiccups with backoff (%s)",
    code => {
      const decision = decideReconnect(code, 0, noJitter);
      expect(decision.action).toBe("reconnect");
      expect(decision).toHaveProperty("delayMs", BASE_DELAY_MS);
    }
  );

  it("names unknown codes", () => {
    expect(decideReconnect(999, 0).reason).toBe("unknown(999)");
    expect(decideReconnect(undefined, 0).reason).toBe("unknown(-)");
  });
});

describe("backoffDelay", () => {
  it("doubles at each attempt in a row, up to 5 minutes", () => {
    expect([0, 1, 2, 3].map(n => backoffDelay(n, noJitter))).toEqual([
      2000, 4000, 8000, 16000
    ]);
    expect(backoffDelay(20, noJitter)).toBe(MAX_DELAY_MS);
  });

  it("adds up to 20% of jitter", () => {
    expect(backoffDelay(0, () => 1)).toBe(2400);
    expect(backoffDelay(0, () => 0.5)).toBe(2200);
  });
});
