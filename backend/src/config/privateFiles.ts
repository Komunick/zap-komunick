import path from "path";
import multer from "multer";
import { safeUploadExtension } from "../helpers/SafeUploadExtension";

const privateFolder = __dirname.endsWith("/dist")
  ? path.resolve(__dirname, "..", "private")
  : path.resolve(__dirname, "..", "..", "private");

export default {
  directory: privateFolder,

  storage: multer.diskStorage({
    destination: privateFolder,
    filename(req, file, cb) {
      const fileName =
        new Date().getTime() + safeUploadExtension(file.originalname);

      return cb(null, fileName);
    }
  })
};
