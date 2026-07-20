import { Router } from "express";
import {
  changeOwnPassword,
  login,
  logout,
  me,
  refresh,
  register,
} from "./auth.controller";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

router.post("/register", authRateLimiter, asyncHandler(register));
router.post("/login", authRateLimiter, asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));

router.get("/me", authenticate, asyncHandler(me));
router.post("/change-password", authenticate, asyncHandler(changeOwnPassword));

export default router;
