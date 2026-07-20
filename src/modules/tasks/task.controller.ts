import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import {
  createTaskSchema,
  listTaskQuerySchema,
  updateTaskSchema,
} from "./task.schema";
import {
  createTask,
  deleteTask,
  getTaskById,
  listTasks,
  updateTask,
} from "./task.service";

function requireActor(req: AuthRequest) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  return req.user;
}

export async function list(req: AuthRequest, res: Response) {
  const actor = requireActor(req);
  const query = listTaskQuerySchema.parse(req.query);
  const result = await listTasks(actor, query);
  res.status(200).json(result);
}

export async function getOne(req: AuthRequest, res: Response) {
  const actor = requireActor(req);
  const task = await getTaskById(actor, req.params.id);
  res.status(200).json(task);
}

export async function create(req: AuthRequest, res: Response) {
  const actor = requireActor(req);
  const input = createTaskSchema.parse(req.body);
  const task = await createTask(actor, input);
  res.status(201).json(task);
}

export async function update(req: AuthRequest, res: Response) {
  const actor = requireActor(req);
  const input = updateTaskSchema.parse(req.body);
  const task = await updateTask(actor, req.params.id, input);
  res.status(200).json(task);
}

export async function remove(req: AuthRequest, res: Response) {
  const actor = requireActor(req);
  await deleteTask(actor, req.params.id);
  res.status(204).send();
}
