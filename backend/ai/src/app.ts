import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import aiRoutes from "./routes/ai.js";

export const createApp = () => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use(cors());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "ai-service" });
  });
  app.use("/api/v1/ai", aiRoutes);

  const requestErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error?.status === 413 ? 413 : error?.status === 400 ? 400 : 500;
    res.status(status).json({
      message: status === 413 ? "Request body is too large." : status === 400 ? "Malformed JSON request." : "The AI service could not complete the request.",
    });
  };
  app.use(requestErrorHandler);

  return app;
};

export const app = createApp();
