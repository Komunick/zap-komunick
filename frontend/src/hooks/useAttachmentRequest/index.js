import { useCallback, useEffect, useRef } from "react";
import {
  ATTACHMENT_TIMEOUT_MS,
  MAX_ATTACHMENT_BYTES
} from "../../helpers/attachments";

// Zap Komunick: one pending operation per panel/viewer, including adapters that
// do not settle immediately on abort. Late results never become UI state.
export default function useAttachmentRequest(scope) {
  const current = useRef(null);
  const cancel = useCallback(() => {
    current.current?.abort();
    current.current = null;
  }, []);
  useEffect(() => cancel, [scope, cancel]);
  const run = useCallback(
    async work => {
      cancel();
      const controller = new AbortController();
      current.current = controller;
      let timer;
      let abortCode = "ERR_CANCELED";
      const stopped = new Promise((_, reject) => {
        controller.signal.addEventListener(
          "abort",
          () => {
            const error = new Error(abortCode);
            error.code = abortCode;
            reject(error);
          },
          { once: true }
        );
        timer = setTimeout(() => {
          abortCode = "ERR_ATTACHMENT_TIMEOUT";
          controller.abort();
        }, ATTACHMENT_TIMEOUT_MS);
      });
      try {
        return await Promise.race([
          work({
            signal: controller.signal,
            timeout: ATTACHMENT_TIMEOUT_MS,
            onDownloadProgress: event => {
              if (
                event.loaded > MAX_ATTACHMENT_BYTES ||
                event.total > MAX_ATTACHMENT_BYTES
              ) {
                abortCode = "ERR_ATTACHMENT_TOO_LARGE";
                controller.abort();
              }
            }
          }),
          stopped
        ]);
      } finally {
        clearTimeout(timer);
        if (current.current === controller) current.current = null;
      }
    },
    [cancel]
  );
  return { run, cancel };
}
