import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives, reessayez dans quelques minutes" },
  skip: () => env.nodeEnv === "test",
});
