import path from "path";
import {
  forgetQueueStalls,
  guardQueue,
  MAX_QUEUE_STALL_MS,
  QUEUE_STALL_MS,
  queueStallLimit,
  registerQueueStall
} from "../../helpers/WhatsAppQueueGuard";

// The mutex the library uses for its incoming queue. The package does not
// export it, so it is loaded by its path.
const { makeMutex } = jest.requireActual(
  path.join(
    path.dirname(require.resolve("libzapitu-rf")),
    "Utils",
    "make-mutex.js"
  )
);

const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

describe("WhatsAppQueueGuard", () => {
  it("keeps order, results and errors of a healthy queue", async () => {
    const queue = makeMutex();
    const onStall = jest.fn();
    guardQueue(queue, 50, onStall);
    const order: number[] = [];

    const first = queue.mutex(async () => {
      await wait(10);
      order.push(1);
      return "a";
    });
    const second = queue.mutex(async () => {
      order.push(2);
      throw new Error("item failed");
    });
    const third = queue.mutex(() => {
      order.push(3);
      return "c";
    });

    await expect(first).resolves.toBe("a");
    await expect(second).rejects.toThrow("item failed");
    await expect(third).resolves.toBe("c");
    expect(order).toEqual([1, 2, 3]);
    await wait(80);
    expect(onStall).not.toHaveBeenCalled();
  });

  it("does not mistake a long queue for a stalled one", async () => {
    const queue = makeMutex();
    const onStall = jest.fn();
    guardQueue(queue, 200, onStall);

    await Promise.all(
      Array.from({ length: 12 }, () => queue.mutex(() => wait(30)))
    );
    expect(onStall).not.toHaveBeenCalled();
  });

  it("reports a stalled item once and drops the waiting ones", async () => {
    const queue = makeMutex();
    const onStall = jest.fn();
    guardQueue(queue, 30, onStall);
    const waiting = jest.fn();
    let release: () => void;

    queue.mutex(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    queue.mutex(waiting);

    await wait(80);
    expect(onStall).toHaveBeenCalledTimes(1);

    // the stalled item ends late, after the socket was replaced
    release();
    await wait(50);
    expect(waiting).not.toHaveBeenCalled();
    expect(onStall).toHaveBeenCalledTimes(1);
  });

  it("raises the limit after each recent stall, up to a maximum", () => {
    const id = 987;
    forgetQueueStalls(id);
    const now = 1000000;
    expect(queueStallLimit(id, now)).toBe(QUEUE_STALL_MS);
    registerQueueStall(id, now);
    expect(queueStallLimit(id, now)).toBe(2 * QUEUE_STALL_MS);
    for (let i = 0; i < 5; i += 1) registerQueueStall(id, now);
    expect(queueStallLimit(id, now)).toBe(MAX_QUEUE_STALL_MS);
    expect(queueStallLimit(id, now + 2 * 60 * 60 * 1000)).toBe(QUEUE_STALL_MS);
    forgetQueueStalls(id);
    expect(queueStallLimit(id, now)).toBe(QUEUE_STALL_MS);
  });
});
