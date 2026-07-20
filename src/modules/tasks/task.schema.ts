import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  done: z.boolean().optional(),
});

export const listTaskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "done"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  done: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTaskQuery = z.infer<typeof listTaskQuerySchema>;
