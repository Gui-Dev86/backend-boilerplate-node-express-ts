import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import openapiSpec from "./openapi.json";

export function mountSwagger(app: Express) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
}
