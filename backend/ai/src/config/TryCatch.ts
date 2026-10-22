import { NextFunction, Request, RequestHandler, Response } from "express";
import { AIProviderError } from "./aiProvider.js";

const TryCatch = (handler: RequestHandler): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error: any) {
      if (res.destroyed || res.writableEnded) return;
      if (error instanceof AIProviderError) {
        res.status(error.statusCode).json({ message: error.message, code: error.code });
        return;
      }
      console.error("AI request failed", error instanceof Error ? error.message : "Unknown error");
      res.status(500).json({ message: "The AI service could not complete the request." });
    }
  };
};

export default TryCatch;
