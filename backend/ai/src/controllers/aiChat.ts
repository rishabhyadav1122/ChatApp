import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middlewares/isAuth.js";
import TryCatch from "../config/TryCatch.js";
import { AIChat } from "../models/AIChat.js";
import { AIMessage } from "../models/AIMessage.js";
import { AIMessageInput, getAIProvider } from "../config/aiProvider.js";

const MAX_CHAT_MESSAGE_LENGTH = 10_000;
const HISTORY_LIMIT = 20;

const validConversationId = (id: string): boolean => mongoose.isValidObjectId(id);

const createRequestAbortController = (res: Response) => {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.once("close", onClose);
  return {
    controller,
    cleanup: () => res.off("close", onClose),
  };
};

// Create an AI conversation
export const createAIChat = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title || title.length > 120) {
    res.status(400).json({ message: "Conversation name must be between 1 and 120 characters." });
    return;
  }

  const chat = await AIChat.create({ userId: userId.toString(), title });
  res.status(201).json(chat);
});

// List only the authenticated user's conversations
export const getAIChats = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const chats = await AIChat.find({ userId: userId.toString() }).sort({ updatedAt: -1 });
  res.json(chats);
});

// Retrieve a conversation and its messages only for its owner
export const getAIChatById = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (!validConversationId(id)) {
    res.status(400).json({ message: "Invalid conversation ID." });
    return;
  }

  const chat = await AIChat.findOne({ _id: id, userId: userId.toString() });
  if (!chat) {
    res.status(404).json({ message: "Conversation not found." });
    return;
  }
  const messages = await AIMessage.find({ chatId: id }).sort({ createdAt: 1 });
  res.json({ chat, messages });
});

// Delete only after verifying ownership, then remove the associated messages
export const deleteAIChat = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (!validConversationId(id)) {
    res.status(400).json({ message: "Invalid conversation ID." });
    return;
  }

  const deletedChat = await AIChat.findOneAndDelete({ _id: id, userId: userId.toString() });
  if (!deletedChat) {
    res.status(404).json({ message: "Conversation not found." });
    return;
  }

  await AIMessage.deleteMany({ chatId: id });
  res.json({ message: "Chat deleted" });
});

// Generate first, then persist both sides of the exchange. A failed provider
// call therefore leaves history unchanged and the user can retry safely.
export const sendAIMessage = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  const { chatId, text } = req.body ?? {};
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (typeof chatId !== "string" || !validConversationId(chatId)) {
    res.status(400).json({ message: "A valid conversation ID is required." });
    return;
  }
  if (typeof text !== "string" || !text.trim() || text.length > MAX_CHAT_MESSAGE_LENGTH) {
    res.status(400).json({ message: `Message must be a non-empty string of at most ${MAX_CHAT_MESSAGE_LENGTH} characters.` });
    return;
  }

  const ownerId = userId.toString();
  const chat = await AIChat.findOne({ _id: chatId, userId: ownerId });
  if (!chat) {
    res.status(404).json({ message: "Conversation not found." });
    return;
  }

  const history = await AIMessage.find({ chatId }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT);
  const messages: AIMessageInput[] = [
    { role: "system", content: "You are ChatApp's helpful AI assistant. Answer clearly and accurately. If you are unsure, say so." },
    ...history.reverse().map((message): AIMessageInput => ({
      role: message.sender === "AI" ? "assistant" : "user",
      content: message.text || "",
    })),
    { role: "user", content: text.trim() },
  ];

  const requestAbort = createRequestAbortController(res);
  let response;
  try {
    response = await getAIProvider().generateResponse(messages, requestAbort.controller.signal);
  } finally {
    requestAbort.cleanup();
  }
  if (requestAbort.controller.signal.aborted) return;

  const userMessage = await AIMessage.create({ chatId, sender: ownerId, text: text.trim() });
  let aiMessage;
  try {
    aiMessage = await AIMessage.create({ chatId, sender: "AI", text: response.text });
    if (chat.title === "New Chat") {
      chat.title = text.trim().replace(/\s+/g, " ").slice(0, 60) || "New Chat";
    }
    chat.updatedAt = new Date();
    await chat.save();
  } catch (error) {
    // Compensate if one of the follow-up writes fails, avoiding a dangling turn.
    await AIMessage.deleteMany({ _id: { $in: [userMessage._id, ...(aiMessage ? [aiMessage._id] : [])] } }).catch((cleanupError) => {
      console.error("Failed to clean up incomplete AI turn", cleanupError instanceof Error ? cleanupError.message : "Unknown error");
    });
    throw error;
  }

  res.json(aiMessage);
});

// Regenerate the latest assistant response from the most recent user turn.
export const retryAIMessage = TryCatch(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (!validConversationId(id)) {
    res.status(400).json({ message: "Invalid conversation ID." });
    return;
  }

  const chat = await AIChat.findOne({ _id: id, userId: userId.toString() });
  if (!chat) {
    res.status(404).json({ message: "Conversation not found." });
    return;
  }

  const recentMessages = await AIMessage.find({ chatId: id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT + 1);
  const history = recentMessages.reverse();
  let latestUserIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].sender !== "AI") {
      latestUserIndex = index;
      break;
    }
  }
  if (latestUserIndex < 0) {
    res.status(400).json({ message: "There is no user message to retry yet." });
    return;
  }

  const previousReplies = history
    .slice(latestUserIndex + 1)
    .filter((message) => message.sender === "AI");
  const context = history.slice(Math.max(0, latestUserIndex - HISTORY_LIMIT + 1), latestUserIndex + 1);
  const messages: AIMessageInput[] = [
    { role: "system", content: "You are ChatApp's helpful AI assistant. Answer clearly and accurately. If you are unsure, say so." },
    ...context.map((message): AIMessageInput => ({
      role: message.sender === "AI" ? "assistant" : "user",
      content: message.text || "",
    })),
  ];

  const requestAbort = createRequestAbortController(res);
  let response;
  try {
    response = await getAIProvider().generateResponse(messages, requestAbort.controller.signal);
  } finally {
    requestAbort.cleanup();
  }
  if (requestAbort.controller.signal.aborted) return;

  const replacement = await AIMessage.create({
    chatId: id,
    sender: "AI",
    text: response.text,
  });
  try {
    chat.updatedAt = new Date();
    await chat.save();
    if (previousReplies.length) {
      await AIMessage.deleteMany({ _id: { $in: previousReplies.map((message) => message._id) } });
    }
  } catch (error) {
    await AIMessage.deleteOne({ _id: replacement._id }).catch(() => undefined);
    throw error;
  }

  res.json(replacement);
});
