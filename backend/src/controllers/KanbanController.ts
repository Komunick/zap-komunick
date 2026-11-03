import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  ListKanbanService,
  MoveKanbanTicketService
} from "../services/KanbanServices/KanbanService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const board = await ListKanbanService({
    userId: req.user.id,
    companyId: req.user.companyId
  });
  return res.status(200).json(board);
};

export const move = async (req: Request, res: Response): Promise<Response> => {
  const ticketId = Number(req.params.ticketId);
  const tagId = Number(req.body?.tagId ?? 0);

  if (
    !Number.isSafeInteger(ticketId) ||
    ticketId <= 0 ||
    !Number.isSafeInteger(tagId) ||
    tagId < 0
  ) {
    throw new AppError("ERR_INVALID_KANBAN_MOVE", 400);
  }

  const ticket = await MoveKanbanTicketService({
    ticketId,
    tagId,
    userId: req.user.id,
    companyId: req.user.companyId
  });

  return res.status(200).json(ticket);
};
