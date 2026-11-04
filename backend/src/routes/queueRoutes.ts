import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import {
  authorizeQueueAdmin,
  authorizeQueueMedia
} from "../middleware/authorizeQueueMedia";
import { randomUUID } from "crypto";
import path from "path";

import * as QueueController from "../controllers/QueueController";
import uploadConfig from "../config/upload";

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadConfig.directory,
    filename: (_req, file, callback) =>
      callback(
        null,
        `queue-upload-${randomUUID()}${path.extname(file.originalname)}`
      )
  }),
  limits: { files: 1 }
});
const queueRoutes = Router();

queueRoutes.get("/queue", isAuth, QueueController.index);

queueRoutes.post("/queue", isAuth, authorizeQueueAdmin, QueueController.store);

queueRoutes.get("/queue/:queueId", isAuth, QueueController.show);

queueRoutes.put(
  "/queue/:queueId",
  isAuth,
  authorizeQueueAdmin,
  QueueController.update
);

queueRoutes.delete(
  "/queue/:queueId",
  isAuth,
  authorizeQueueAdmin,
  QueueController.remove
);

queueRoutes.post(
  "/queue/:queueId/media-upload",
  isAuth,
  authorizeQueueMedia(false),
  upload.array("file", 1),
  QueueController.mediaUpload
);

queueRoutes.delete(
  "/queue/:queueId/media-upload",
  isAuth,
  authorizeQueueAdmin,
  QueueController.deleteMedia
);

export default queueRoutes;
