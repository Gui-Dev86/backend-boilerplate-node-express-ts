import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { AppError } from "./error.middleware";

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError("Token d'authentification manquant", 401);
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    throw new AppError("Token invalide ou expire", 401);
  }
}

// Usage: authorize("ADMIN") ou authorize("ADMIN", "USER")
export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError("Non authentifie", 401);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError("Acces refuse: permissions insuffisantes", 403);
    }
    next();
  };
}
