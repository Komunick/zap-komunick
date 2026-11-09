import { Readable } from "stream";
import { collectStream } from "../../helpers/CollectStream";

const legacyCollect = async (
  stream: AsyncIterable<Buffer>
): Promise<Buffer> => {
  let buffer = Buffer.from([]);
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk] as unknown as Uint8Array[]);
  }
  return buffer;
};

describe("collectStream", () => {
  it("joins the chunks in order", async () => {
    const stream = Readable.from([
      Buffer.from("ab"),
      Buffer.from("cd"),
      Buffer.from("e")
    ]);

    const result = await collectStream(stream);

    expect(result.toString()).toBe("abcde");
  });

  it("returns an empty buffer for an empty stream", async () => {
    const result = await collectStream(Readable.from([]));

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("reports the accumulated size after each chunk", async () => {
    const progress: number[] = [];

    await collectStream(
      Readable.from([Buffer.alloc(3), Buffer.alloc(5), Buffer.alloc(2)]),
      total => progress.push(total)
    );

    expect(progress).toEqual([3, 8, 10]);
  });

  it("returns the same bytes as the previous concatenating loop", async () => {
    const chunks = Array.from({ length: 960 }, (_, i) =>
      Buffer.alloc(16 * 1024, i % 251)
    );

    const current = await collectStream(Readable.from(chunks));
    const previous = await legacyCollect(Readable.from(chunks));

    expect(current.length).toBe(960 * 16 * 1024);
    expect(current.equals(previous as unknown as Uint8Array)).toBe(true);
  });

  it("propagates a stream error instead of returning a partial buffer", async () => {
    async function* failing(): AsyncGenerator<Buffer> {
      yield Buffer.from("parcial");
      throw new Error("ERR_STREAM");
    }

    await expect(collectStream(failing())).rejects.toThrow("ERR_STREAM");
  });

  it("lets the caller change behavior when the size crosses a limit", async () => {
    const limit = 4;
    let crossed = false;

    await collectStream(
      Readable.from([Buffer.alloc(2), Buffer.alloc(2), Buffer.alloc(2)]),
      total => {
        if (total > limit) crossed = true;
      }
    );

    expect(crossed).toBe(true);
  });
});
