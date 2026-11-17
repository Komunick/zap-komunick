import path from "path";
import { randomBytes } from "crypto";
import multer from "multer";
import { safeUploadExtension } from "../helpers/SafeUploadExtension";

const publicFolder = __dirname.endsWith("/dist")
  ? path.resolve(__dirname, "..", "public")
  : path.resolve(__dirname, "..", "..", "public");

export default {
  directory: publicFolder,

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      // Zap Komunick: several files of one request can start in the same
      // millisecond; the random part keeps one from overwriting another.
      const fileName = `${new Date().getTime()}-${randomBytes(6).toString(
        "hex"
      )}${safeUploadExtension(file.originalname)}`;

      return cb(null, fileName);
    }
  })
};
