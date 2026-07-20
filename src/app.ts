import cors from "cors";
import express from "express";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import taskRoutes from "./modules/tasks/task.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { mountSwagger } from "./docs/swagger";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

mountSwagger(app);

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
