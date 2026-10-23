import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import fs from "fs";
import { head } from "lodash";
import CreateService, {
  CreateSchedulesService
} from "../services/ScheduleServices/CreateService";
import saveMediaToFile from "../helpers/saveMediaFile";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } =
    req.query as IndexQuery;
  const { companyId } = req.user;

  const { schedules, count, hasMore } = await ListService({
    searchParam,
    contactId,
    userId,
    pageNumber,
    companyId
  });

  return res.json({ schedules, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    body,
    sendAt,
    contactId,
    saveMessage,
    recurrence,
    recurrenceEndAt,
    contactIds,
    tagId,
    mediaPath,
    mediaName,
    businessDaysOnly
  } = req.body;
  const { companyId } = req.user;
  const userId = Number(req.user.id);

  // Zap Komunick: same message for several contacts or a tag
  if (Array.isArray(contactIds) || tagId) {
    const schedules = await CreateSchedulesService({
      body,
      sendAt,
      contactIds: Array.isArray(contactIds) ? contactIds : [],
      tagId,
      companyId,
      userId,
      saveMessage: !!saveMessage,
      recurrence,
      recurrenceEndAt,
      mediaPath,
      mediaName,
      businessDaysOnly: !!businessDaysOnly
    });
    const socket = getIO();
    schedules.forEach(created => {
      socket
        .to(`company-${companyId}-mainchannel`)
        .emit(`company-${companyId}-schedule`, {
          action: "create",
          schedule: created
        });
    });
    return res.status(200).json(schedules);
  }

  const schedule = await CreateService({
    body,
    sendAt,
    contactId,
    companyId,
    userId,
    saveMessage: !!saveMessage,
    recurrence,
    recurrenceEndAt,
    mediaPath,
    mediaName,
    businessDaysOnly: !!businessDaysOnly
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-schedule`,
    {
      action: "create",
      schedule
    }
  );

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData = req.body;
  const { companyId } = req.user;

  const schedule = await UpdateService({
    scheduleData,
    id: scheduleId,
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(
    `company-${companyId}-schedule`,
    {
      action: "update",
      schedule
    }
  );

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.emit("schedule", {
    action: "delete",
    scheduleId
  });

  return res.status(200).json({ message: "Schedule deleted" });
};

// Zap Komunick: stores an attachment once so several schedules can use it
export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const file = head(req.files as Express.Multer.File[]);

  if (!file) {
    throw new AppError("ERR_NO_FILE", 400);
  }

  try {
    const mediaPath = await saveMediaToFile(
      {
        data: fs.readFileSync(file.path),
        mimetype: file.mimetype,
        filename: file.originalname
      },
      { destination: companyId, persistant: true }
    );
    return res.status(200).json({ mediaPath, mediaName: file.originalname });
  } finally {
    fs.unlink(file.path, () => {});
  }
};
