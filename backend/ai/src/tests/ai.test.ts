import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { AIProviderError, GroqProvider, HuggingFaceProvider, setAIProviderForTests } from "../config/aiProvider.js";
import { AIChat } from "../models/AIChat.js";
import { AIMessage } from "../models/AIMessage.js";

const JWT_SECRET = "test-only-ai-jwt-secret";
const token = jwt.sign(
  { user: { _id: "507f1f77bcf86cd799439011", name: "Test", email: "test@example.com" } },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  setAIProviderForTests(null);
  jest.restoreAllMocks();
});

describe("Hugging Face provider", () => {
  it("sends chat-completion messages and returns the generated text", async () => {
    let requestBody: Record<string, unknown> | undefined;
    let authorization: string | null = null;
    global.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authorization = new Headers(init?.headers).get("Authorization");
      return new Response(JSON.stringify({
        choices: [{ message: { content: "Hello from the model." } }],
        usage: { total_tokens: 12 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const provider = new HuggingFaceProvider({ apiKey: "test-token", model: "test/model", timeoutMs: 1_000 });
    const result = await provider.generateResponse([{ role: "user", content: "Hello" }]);

    expect(result.text).toBe("Hello from the model.");
    expect(result.usage).toEqual({ total_tokens: 12 });
    expect(authorization).toBe("Bearer test-token");
    expect(requestBody).toMatchObject({ model: "test/model", messages: [{ role: "user", content: "Hello" }] });
  });

  it("returns a safe provider error for failed HTTP responses", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    global.fetch = (async () => new Response("provider detail", { status: 503 })) as typeof fetch;
    const provider = new HuggingFaceProvider({ apiKey: "test-token", model: "test/model", timeoutMs: 1_000 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      message: "The AI provider could not complete the request. Please try again.",
    });
  });

  it("reports Hugging Face key permission failures without exposing credentials", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    global.fetch = (async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })) as typeof fetch;
    const provider = new HuggingFaceProvider({ apiKey: "must-not-leak", model: "test/model", timeoutMs: 1_000 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_PROVIDER_NOT_CONFIGURED",
      message: expect.stringContaining("Inference Providers permission"),
    });
  });

  it("explains when Hugging Face rejects a non-chat or unavailable model", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    global.fetch = (async () => new Response(JSON.stringify({
      error: { message: "The requested model is not a chat model." },
    }), { status: 400 })) as typeof fetch;
    const provider = new HuggingFaceProvider({ apiKey: "test-token", model: "test/model", timeoutMs: 1_000 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      message: expect.stringContaining("chat model enabled"),
    });
  });

  it("rejects successful responses that contain no generated text", async () => {
    global.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "  " } }] }), { status: 200 })) as typeof fetch;
    const provider = new HuggingFaceProvider({ apiKey: "test-token", model: "test/model", timeoutMs: 1_000 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toBeInstanceOf(AIProviderError);
  });

  it("times out slow provider calls", async () => {
    global.fetch = ((_input: URL | RequestInfo, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })) as typeof fetch;
    const provider = new HuggingFaceProvider({ apiKey: "test-token", model: "test/model", timeoutMs: 5 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toMatchObject({
      statusCode: 504,
      code: "AI_PROVIDER_TIMEOUT",
    });
  });
});

describe("Groq provider", () => {
  it("sends chat-completion messages and returns generated text", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> | undefined;
    let authorization: string | null = null;
    global.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      authorization = new Headers(init?.headers).get("Authorization");
      return new Response(JSON.stringify({
        choices: [{ message: { content: "A polished response." } }],
        usage: { total_tokens: 10 },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const provider = new GroqProvider({ apiKey: "test-groq-key", model: "openai/gpt-oss-20b", timeoutMs: 1_000 });
    const result = await provider.generateResponse([{ role: "user", content: "Fix this sentence." }]);

    expect(requestUrl).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(authorization).toBe("Bearer test-groq-key");
    expect(requestBody).toMatchObject({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: "Fix this sentence." }],
    });
    expect(result).toEqual({ text: "A polished response.", usage: { total_tokens: 10 } });
  });

  it("maps rate-limit errors to a safe provider error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    global.fetch = (async () => new Response("rate limited", { status: 429 })) as typeof fetch;
    const provider = new GroqProvider({ apiKey: "test-groq-key", model: "openai/gpt-oss-20b", timeoutMs: 1_000 });

    await expect(provider.generateResponse([{ role: "user", content: "Hello" }])).rejects.toMatchObject({
      statusCode: 503,
      code: "AI_PROVIDER_UNAVAILABLE",
      message: expect.stringContaining("usage limit"),
    });
  });
});

describe("AI routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("keeps health checks independent of the database", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", service: "ai-service" });
  });

  it("requires authentication", async () => {
    const response = await request(app).post("/api/v1/ai/rewrite").send({ text: "Hello", operation: "grammar" });
    expect(response.status).toBe(401);
  });

  it("validates rewrite inputs before contacting the provider", async () => {
    const response = await request(app)
      .post("/api/v1/ai/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "Hello", operation: "tone", tone: "rude" });
    expect(response.status).toBe(400);
  });

  it("validates chat inputs before accessing the database", async () => {
    const response = await request(app)
      .post("/api/v1/ai/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ chatId: "507f1f77bcf86cd799439011", text: "   " });
    expect(response.status).toBe(400);
  });

  it("validates retry conversation IDs before accessing the database", async () => {
    const findOneSpy = jest.spyOn(AIChat, "findOne");
    const response = await request(app)
      .post("/api/v1/ai/conversations/not-a-valid-id/retry")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid conversation ID");
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it("requires authentication to retry a response", async () => {
    const response = await request(app)
      .post("/api/v1/ai/conversations/507f1f77bcf86cd799439012/retry");

    expect(response.status).toBe(401);
  });

  it("requires a conversation name and does not create unnamed chats", async () => {
    const createSpy = jest.spyOn(AIChat, "create");
    const response = await request(app)
      .post("/api/v1/ai/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "   " });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Conversation name");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("persists the requested title and returns the created conversation", async () => {
    const chatId = "507f1f77bcf86cd799439012";
    const createdAt = new Date("2026-10-20T12:00:00.000Z");
    const chat = { _id: chatId, userId: "507f1f77bcf86cd799439011", title: "Project notes", createdAt, updatedAt: createdAt };
    const createSpy = jest.spyOn(AIChat, "create").mockResolvedValue(chat as never);

    const response = await request(app)
      .post("/api/v1/ai/conversations")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "  Project notes  " });

    expect(response.status).toBe(201);
    expect(createSpy).toHaveBeenCalledWith({ userId: "507f1f77bcf86cd799439011", title: "Project notes" });
    expect(response.body).toMatchObject({ _id: chatId, title: "Project notes" });
  });

  it("reopens the named conversation with its persisted message history", async () => {
    const chatId = "507f1f77bcf86cd799439012";
    const chat = { _id: chatId, userId: "507f1f77bcf86cd799439011", title: "Project notes" };
    const history = [{ _id: "message-1", chatId, sender: "AI", text: "Saved answer" }];
    jest.spyOn(AIChat, "findOne").mockResolvedValue(chat as never);
    jest.spyOn(AIMessage, "find").mockReturnValue({ sort: () => Promise.resolve(history) } as never);

    const response = await request(app)
      .get(`/api/v1/ai/conversations/${chatId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.chat.title).toBe("Project notes");
    expect(response.body.messages).toEqual(history);
  });

  it("retries the latest answer without duplicating the user message", async () => {
    const ownerId = "507f1f77bcf86cd799439011";
    const chatId = "507f1f77bcf86cd799439012";
    const chat = { _id: chatId, userId: ownerId, updatedAt: new Date(), save: jest.fn() };
    const history = [
      { _id: "old-reply", sender: "AI", text: "Previous answer." },
      { _id: "user-turn", sender: ownerId, text: "Explain photosynthesis." },
    ];
    const replacement = { _id: "new-reply", chatId, sender: "AI", text: "A clearer answer." };
    const provider = {
      generateResponse: jest.fn(async (messages: Array<{ role: string; content: string }>) => {
        expect(messages.map((message) => message.content)).toEqual([
          expect.stringContaining("helpful AI assistant"),
          "Explain photosynthesis.",
        ]);
        return { text: "A clearer answer." };
      }),
    };
    setAIProviderForTests(provider);
    jest.spyOn(AIChat, "findOne").mockResolvedValue(chat as never);
    jest.spyOn(AIMessage, "find").mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve(history) }),
    } as never);
    jest.spyOn(AIMessage, "create").mockResolvedValue(replacement as never);
    const deleteSpy = jest.spyOn(AIMessage, "deleteMany").mockResolvedValue({ deletedCount: 1 } as never);

    const response = await request(app)
      .post(`/api/v1/ai/conversations/${chatId}/retry`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.text).toBe("A clearer answer.");
    expect(provider.generateResponse).toHaveBeenCalledTimes(1);
    expect(AIMessage.create).toHaveBeenCalledWith({
      chatId,
      sender: "AI",
      text: "A clearer answer.",
    });
    expect(deleteSpy).toHaveBeenCalledWith({ _id: { $in: ["old-reply"] } } as never);
    expect(chat.save).toHaveBeenCalledTimes(1);
  });
});
