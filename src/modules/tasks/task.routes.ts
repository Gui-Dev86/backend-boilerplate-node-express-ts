import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { create, getOne, list, remove, update } from "./task.controller";

const router = Router();

router.use(authenticate);

router.get("/", asyncHandler(list));
router.get("/:id", asyncHandler(getOne));
router.post("/", asyncHandler(create));
router.patch("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

export default router;
