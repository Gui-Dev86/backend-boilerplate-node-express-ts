import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { CreateTaskInput, ListTaskQuery, UpdateTaskInput } from "./task.schema";

interface Actor {
  userId: string;
  role: string;
}

// Un admin voit tout, un user ne voit que ses propres tasks.
// Ce pattern (filtre par ownerId sauf si admin) est celui a reprendre
// pour n'importe quelle nouvelle ressource du CRUD generique.
function ownershipFilter(actor: Actor) {
  return actor.role === "ADMIN" ? {} : { ownerId: actor.userId };
}

export async function listTasks(actor: Actor, query: ListTaskQuery) {
  const where = {
    ...ownershipFilter(actor),
    ...(query.done !== undefined ? { done: query.done } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getTaskById(actor: Actor, id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new AppError("Tache introuvable", 404);
  assertCanAccess(actor, task.ownerId);
  return task;
}

export async function createTask(actor: Actor, input: CreateTaskInput) {
  return prisma.task.create({
    data: { ...input, ownerId: actor.userId },
  });
}

export async function updateTask(actor: Actor, id: string, input: UpdateTaskInput) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new AppError("Tache introuvable", 404);
  assertCanAccess(actor, task.ownerId);

  return prisma.task.update({ where: { id }, data: input });
}

export async function deleteTask(actor: Actor, id: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw new AppError("Tache introuvable", 404);
  assertCanAccess(actor, task.ownerId);

  await prisma.task.delete({ where: { id } });
}

function assertCanAccess(actor: Actor, ownerId: string) {
  if (actor.role !== "ADMIN" && actor.userId !== ownerId) {
    throw new AppError("Acces refuse: cette ressource ne vous appartient pas", 403);
  }
}
