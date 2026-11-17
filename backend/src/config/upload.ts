import path from "path";
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
      const fileName =
        new Date().getTime() + safeUploadExtension(file.originalname);

      return cb(null, fileName);
    }
  })
};
