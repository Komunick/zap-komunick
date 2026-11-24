import { useCallback, useRef, useState } from "react";
import {
  SUPPORT_MAX_FILES,
  SUPPORT_MAX_TOTAL_MB,
  addSupportFiles,
  tr
} from "../../helpers/supportTickets";

// Zap Komunick: files chosen for a ticket or a message, before they are sent.
const useAttachmentDraft = () => {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const current = useRef(files);
  current.current = files;

  const add = useCallback(incoming => {
    if (!incoming.length) return;
    const { files: next, rejected } = addSupportFiles(
      current.current,
      incoming
    );
    current.current = next;
    setFiles(next);
    setError(
      rejected
        ? tr(`support.attachments.${rejected.code}`, {
            name: rejected.name,
            count: SUPPORT_MAX_FILES,
            size: SUPPORT_MAX_TOTAL_MB
          })
        : ""
    );
  }, []);

  const remove = useCallback(index => {
    const next = current.current.filter((_, position) => position !== index);
    current.current = next;
    setFiles(next);
    setError("");
  }, []);

  const clear = useCallback(() => {
    current.current = [];
    setFiles([]);
    setError("");
  }, []);

  return { files, error, add, remove, clear };
};

export default useAttachmentDraft;
