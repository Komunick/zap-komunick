import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import {
  authorizeQueueAdmin,
  authorizeQueueMedia
} from "../middleware/authorizeQueueMedia";
import { randomUUID } from "crypto";
import path from "path";

import * as QueueOptionController from "../controllers/QueueOptionController";
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

const queueOptionRoutes = Router();

queueOptionRoutes.get(
  "/queue-options",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.index
);

queueOptionRoutes.post(
  "/queue-options",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.store
);

queueOptionRoutes.get(
  "/queue-options/:queueOptionId",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.show
);

queueOptionRoutes.put(
  "/queue-options/:queueOptionId",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.update
);

queueOptionRoutes.delete(
  "/queue-options/:queueOptionId",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.remove
);

queueOptionRoutes.post(
  "/queue-options/:queueOptionId/media-upload",
  isAuth,
  authorizeQueueMedia(true),
  upload.array("file", 1),
  QueueOptionController.mediaUpload
);

queueOptionRoutes.delete(
  "/queue-options/:queueOptionId/media-upload",
  isAuth,
  authorizeQueueAdmin,
  QueueOptionController.deleteMedia
);
export default queueOptionRoutes;
