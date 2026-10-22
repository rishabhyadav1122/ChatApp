export type AIMessageRole = "system" | "user" | "assistant";

export interface AIMessageInput {
  role: AIMessageRole;
  content: string;
}

export interface AIResponse {
  text: string;
  usage?: unknown;
}

export interface AIProvider {
  generateResponse(messages: AIMessageInput[], signal?: AbortSignal): Promise<AIResponse>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 502 | 503 | 504,
    public readonly code: "AI_PROVIDER_UNAVAILABLE" | "AI_PROVIDER_TIMEOUT" | "AI_PROVIDER_INVALID_RESPONSE" | "AI_PROVIDER_NOT_CONFIGURED"
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

interface HuggingFaceConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

interface GroqConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export class HuggingFaceProvider implements AIProvider {
  private readonly endpoint = "https://router.huggingface.co/v1/chat/completions";

  constructor(private readonly config: HuggingFaceConfig) {}

  async generateResponse(messages: AIMessageInput[], signal?: AbortSignal): Promise<AIResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        // Keep credentials and provider response bodies out of client-facing errors.
        console.error(`Hugging Face returned HTTP ${response.status}`);
        const detail = getProviderErrorMessage(body);
        if (detail && /not a chat model|not supported by any provider|model.*not found/i.test(detail)) {
          throw new AIProviderError(
            "The configured AI_MODEL is not available for chat completions. Choose a chat model enabled in your Hugging Face Inference Providers settings.",
            503,
            "AI_PROVIDER_UNAVAILABLE"
          );
        }
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError(
            "The Hugging Face key was rejected or does not have Inference Providers permission.",
            503,
            "AI_PROVIDER_NOT_CONFIGURED"
          );
        }
        if (response.status === 402 || response.status === 429) {
          throw new AIProviderError(
            "The AI provider has reached a usage limit. Check its credits and try again later.",
            503,
            "AI_PROVIDER_UNAVAILABLE"
          );
        }
        throw new AIProviderError(
          "The AI provider could not complete the request. Please try again.",
          response.status === 429 || response.status >= 500 ? 503 : 502,
          "AI_PROVIDER_UNAVAILABLE"
        );
      }

      const text = getCompletionText(body);
      if (!text) {
        throw new AIProviderError(
          "The AI provider returned an empty response. Please try again.",
          502,
          "AI_PROVIDER_INVALID_RESPONSE"
        );
      }

      return { text, usage: getUsage(body) };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (controller.signal.aborted) {
        throw new AIProviderError(
          "The AI request timed out. Please try again.",
          504,
          "AI_PROVIDER_TIMEOUT"
        );
      }
      console.error("Hugging Face request failed", error instanceof Error ? error.message : "Unknown error");
      throw new AIProviderError(
        "The AI provider is temporarily unavailable. Please try again.",
        503,
        "AI_PROVIDER_UNAVAILABLE"
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

export class GroqProvider implements AIProvider {
  private readonly endpoint = "https://api.groq.com/openai/v1/chat/completions";

  constructor(private readonly config: GroqConfig) {}

  async generateResponse(messages: AIMessageInput[], signal?: AbortSignal): Promise<AIResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const abortFromCaller = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        // Never log provider response bodies because they can contain sensitive details.
        console.error(`Groq returned HTTP ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError(
            "The Groq API key was rejected or does not have permission to use this model.",
            503,
            "AI_PROVIDER_NOT_CONFIGURED"
          );
        }
        if (response.status === 429 || response.status === 402) {
          throw new AIProviderError(
            "The AI provider has reached a usage limit. Check your Groq plan limits and try again later.",
            503,
            "AI_PROVIDER_UNAVAILABLE"
          );
        }
        throw new AIProviderError(
          "The AI provider could not complete the request. Please try again.",
          response.status >= 500 ? 503 : 502,
          "AI_PROVIDER_UNAVAILABLE"
        );
      }

      const text = getCompletionText(body);
      if (!text) {
        throw new AIProviderError(
          "The AI provider returned an empty response. Please try again.",
          502,
          "AI_PROVIDER_INVALID_RESPONSE"
        );
      }

      return { text, usage: getUsage(body) };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      if (controller.signal.aborted) {
        throw new AIProviderError(
          "The AI request timed out. Please try again.",
          504,
          "AI_PROVIDER_TIMEOUT"
        );
      }
      console.error("Groq request failed", error instanceof Error ? error.message : "Unknown error");
      throw new AIProviderError(
        "The AI provider is temporarily unavailable. Please try again.",
        503,
        "AI_PROVIDER_UNAVAILABLE"
      );
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

function getCompletionText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content.trim() || null;
  // Some compatible providers return content as an array of text blocks.
  if (Array.isArray(content)) {
    const text = content
      .filter((part): part is { text: string } => Boolean(part) && typeof part === "object" && typeof (part as { text?: unknown }).text === "string")
      .map((part) => part.text)
      .join("")
      .trim();
    return text || null;
  }
  return null;
}

function getUsage(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;
  return (body as { usage?: unknown }).usage;
}

let cachedProvider: AIProvider | null = null;

export const getAIProvider = (): AIProvider => {
  if (cachedProvider) return cachedProvider;

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "huggingface";
  const isGroq = provider === "groq";
  if (!isGroq && provider !== "huggingface") {
    throw new AIProviderError(
      "AI service is not configured. AI_PROVIDER must be 'groq' or 'huggingface'.",
      503,
      "AI_PROVIDER_NOT_CONFIGURED"
    );
  }

  const apiKey = (isGroq ? process.env.GROQ_API_KEY : process.env.HUGGINGFACE_API_KEY)?.trim();
  if (!apiKey) {
    throw new AIProviderError(
      `AI service is not configured. Set ${isGroq ? "GROQ_API_KEY" : "HUGGINGFACE_API_KEY"}.`,
      503,
      "AI_PROVIDER_NOT_CONFIGURED"
    );
  }

  const model = process.env.AI_MODEL?.trim() || (isGroq ? "openai/gpt-oss-20b" : "Qwen/Qwen2.5-7B-Instruct-1M:fastest");
  const configuredTimeout = Number(process.env.AI_TIMEOUT_MS) || 30_000;
  const timeoutMs = Math.max(1_000, configuredTimeout);
  cachedProvider = isGroq
    ? new GroqProvider({ apiKey, model, timeoutMs })
    : new HuggingFaceProvider({ apiKey, model, timeoutMs });
  return cachedProvider;
};

function getProviderErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export const setAIProviderForTests = (provider: AIProvider | null): void => {
  cachedProvider = provider;
};
