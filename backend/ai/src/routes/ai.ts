import express from "express";
import { isAuth } from "../middlewares/isAuth.js";
import { rewriteMessage } from "../controllers/ai.js";
import { createAIChat, getAIChats, getAIChatById, deleteAIChat, retryAIMessage, sendAIMessage } from "../controllers/aiChat.js";
import { aiRateLimit } from "../middlewares/aiRateLimit.js";

const router = express.Router();

// Existing AI routes
router.post("/rewrite", isAuth, aiRateLimit, rewriteMessage);

// New AI Chat routes
router.post("/conversations", isAuth, createAIChat);
router.get("/conversations", isAuth, getAIChats);
router.get("/conversations/:id", isAuth, getAIChatById);
router.delete("/conversations/:id", isAuth, deleteAIChat);
router.post("/conversations/:id/retry", isAuth, aiRateLimit, retryAIMessage);
router.post("/chat", isAuth, aiRateLimit, sendAIMessage);

export default router;
