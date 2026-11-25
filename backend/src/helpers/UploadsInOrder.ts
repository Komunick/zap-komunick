import fs from "fs";
import { logger } from "../utils/logger";

type Upload = { path: string };

// Zap Komunick: the files of one request leave one at a time, in the order
// they were chosen. The customer receives them in that order, only one
// encrypted copy sits in the temporary folder at a time, and the copy written
// by the upload is removed whether the file went out or not. The first
// failure stops the rest and is the error of the request.

const removeUpload = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    logger.warn({ message: error.message }, "Could not remove uploaded file");
  }
};

export const sendUploadsInOrder = async <T extends Upload>(
  uploads: T[],
  send: (upload: T) => Promise<unknown>,
  remove: (path: string) => void = removeUpload
): Promise<void> => {
  let failed = false;
  let failure: unknown;
  // eslint-disable-next-line no-restricted-syntax
  for (const upload of uploads) {
    try {
      if (!failed) await send(upload);
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      remove(upload.path);
    }
  }
  if (failed) throw failure;
};

// A multipart request that brings no file and no text has nothing to send.
// Answering it with success would hide the loss from who sent it.
export const isEmptyUpload = (uploads: unknown, body: unknown): boolean =>
  Array.isArray(uploads) && uploads.length === 0 && !body;
