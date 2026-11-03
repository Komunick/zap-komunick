import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as ScheduleController from "../controllers/ScheduleController";

const scheduleRoutes = express.Router();
const upload = multer(uploadConfig);

scheduleRoutes.get("/schedules", isAuth, ScheduleController.index);

scheduleRoutes.post("/schedules", isAuth, ScheduleController.store);

scheduleRoutes.post(
  "/schedules/media",
  isAuth,
  upload.array("file"),
  ScheduleController.mediaUpload
);

scheduleRoutes.put("/schedules/:scheduleId", isAuth, ScheduleController.update);

scheduleRoutes.get("/schedules/:scheduleId", isAuth, ScheduleController.show);

scheduleRoutes.delete(
  "/schedules/:scheduleId",
  isAuth,
  ScheduleController.remove
);

export default scheduleRoutes;
