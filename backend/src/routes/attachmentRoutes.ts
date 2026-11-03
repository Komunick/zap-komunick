import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isCompliant from "../middleware/isCompliant";
import * as AttachmentController from "../controllers/AttachmentController";

const attachmentRoutes = Router();
const base = "/tickets/:ticketId/attachments";
attachmentRoutes.get(base, isAuth, isCompliant, AttachmentController.list);
attachmentRoutes.get(
  `${base}/:sourceTicketId/:messageId`,
  isAuth,
  isCompliant,
  AttachmentController.show
);
attachmentRoutes.head(
  `${base}/:sourceTicketId/:messageId/content`,
  isAuth,
  isCompliant,
  AttachmentController.content
);
attachmentRoutes.get(
  `${base}/:sourceTicketId/:messageId/content`,
  isAuth,
  isCompliant,
  AttachmentController.content
);
export default attachmentRoutes;
