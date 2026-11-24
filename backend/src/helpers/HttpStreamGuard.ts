import axios from "axios";
import { Readable, Writable } from "stream";

// Zap Komunick: the WhatsApp library decrypts downloads with
// `response.pipe(decrypter)`. pipe() does not forward errors, so a download
// cut in the middle never ends and whoever reads it waits forever. Inside the
// library that blocks the queue of incoming messages (docs/TAD.md, "WhatsApp
// mudo").

export const HTTP_STREAM_IDLE_MS = 60 * 1000;

type GuardedPipe = (
  destination: Writable,
  options?: { end?: boolean }
) => Writable;

/**
 * Makes `stream.pipe(destination)` fail the destination when the source
 * fails, closes before its end or stays `idleMs` without data.
 */
export function guardHttpStream<T>(data: T, idleMs = HTTP_STREAM_IDLE_MS): T {
  const source = data as unknown as Omit<Readable, "pipe"> & {
    pipe: GuardedPipe;
  };
  if (!source || typeof source.pipe !== "function") return data;

  const originalPipe = source.pipe.bind(source) as GuardedPipe;

  source.pipe = (destination: Writable, options?: { end?: boolean }) => {
    let timer: NodeJS.Timeout;
    let finished = false;

    const finish = () => {
      finished = true;
      clearTimeout(timer);
    };
    const fail = (error: Error) => {
      if (finished) return;
      finish();
      destination.destroy(error);
      source.destroy();
    };
    const restartTimer = () => {
      clearTimeout(timer);
      if (finished) return;
      timer = setTimeout(
        () => fail(new Error("WhatsApp download stalled")),
        idleMs
      );
      timer.unref?.();
    };

    source.once("end", finish);
    source.once("error", fail);
    source.once("close", () =>
      fail(new Error("WhatsApp download interrupted"))
    );
    // The reader may not be listening yet: keep the failure for it instead of
    // an uncaught exception.
    destination.on("error", () => undefined);
    destination.once("close", () => {
      if (finished) return;
      finish();
      source.destroy();
    });

    const piped = originalPipe(destination, options);
    source.on("data", restartTimer);
    restartTimer();
    return piped;
  };

  return data;
}

/**
 * Axios options that guard the streams of the library's downloads. `timeout`
 * covers the wait for the response; the guard covers its body.
 */
export function getStreamGuardOptions() {
  return {
    timeout: HTTP_STREAM_IDLE_MS,
    transformResponse: [
      (data: unknown) => guardHttpStream(data),
      ...[].concat(axios.defaults.transformResponse ?? [])
    ]
  };
}
