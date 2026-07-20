import { Response } from "express";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import {
  changePassword,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
} from "./auth.service";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "./auth.schema";

export async function register(req: AuthRequest, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
}

export async function login(req: AuthRequest, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json(result);
}

export async function refresh(req: AuthRequest, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await refreshAccessToken(refreshToken);
  res.status(200).json(result);
}

export async function logout(req: AuthRequest, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await logoutUser(refreshToken);
  res.status(204).send();
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const user = await getCurrentUser(req.user.userId);
  res.status(200).json(user);
}

export async function changeOwnPassword(req: AuthRequest, res: Response) {
  if (!req.user) throw new AppError("Non authentifie", 401);
  const input = changePasswordSchema.parse(req.body);
  await changePassword(req.user.userId, input);
  res.status(204).send();
}
