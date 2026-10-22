"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Menu,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  UserRound,
} from "lucide-react";
import Cookies from "js-cookie";
import axios from "axios";
import { ai_service, useAppData } from "@/context/AppContext";

interface Message {
  _id: string;
  sender: string;
  text: string;
  createdAt?: string;
}

interface AiChatMessagesProps {
  chatId: string | null;
  chatTitle: string;
  onOpenSidebar: () => void;
  onStartNew: (title?: string) => void;
}

const suggestions = [
  { title: "Thoughtful message", prompt: "Help me write a thoughtful message" },
  { title: "Simple explanations", prompt: "Explain a tricky concept simply" },
  { title: "Project brainstorming", prompt: "Brainstorm ideas for a project" },
  { title: "Coding help", prompt: "Help me debug some code" },
];

const AiChatMessages = ({ chatId, chatTitle, onOpenSidebar, onStartNew }: AiChatMessagesProps) => {
  const { user } = useAppData();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [failedPrompt, setFailedPrompt] = useState("");
  const [retryingResponse, setRetryingResponse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestVersion = useRef(0);
  const generationController = useRef<AbortController | null>(null);

  useEffect(() => {
    const version = ++requestVersion.current;
    generationController.current?.abort();
    generationController.current = null;
    setLoading(false);
    setGenerationError("");
    setFailedPrompt("");
    setRetryingResponse(false);

    if (!chatId) {
      setMessages([]);
      setHistoryLoading(false);
      setHistoryError("");
      return;
    }

    setMessages([]);
    setHistoryLoading(true);
    setHistoryError("");
    const token = Cookies.get("token");
    axios.get(ai_service + "/api/v1/ai/conversations/" + chatId, {
      headers: { Authorization: "Bearer " + token },
    }).then(({ data }) => {
      if (requestVersion.current === version) {
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      }
    }).catch((error) => {
      if (requestVersion.current !== version) return;
      setHistoryError(
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Could not load this conversation. Check your connection and try again."
      );
    }).finally(() => {
      if (requestVersion.current === version) setHistoryLoading(false);
    });

    return () => {
      requestVersion.current += 1;
      generationController.current?.abort();
    };
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, generationError]);

  const runGeneration = async (retryResponse = false, retryText = "") => {
    if (!chatId || loading) return;
    const text = retryResponse ? "" : (retryText || input).trim();
    if (!retryResponse && !text) return;

    const controller = new AbortController();
    const version = requestVersion.current;
    generationController.current = controller;
    setLoading(true);
    setGenerationError("");
    setFailedPrompt(retryResponse ? "" : text);
    setRetryingResponse(retryResponse);

    try {
      const token = Cookies.get("token");
      const endpoint = retryResponse
        ? ai_service + "/api/v1/ai/conversations/" + chatId + "/retry"
        : ai_service + "/api/v1/ai/chat";
      const payload = retryResponse ? {} : { chatId, text };
      const { data } = await axios.post(endpoint, payload, {
        signal: controller.signal,
        headers: { Authorization: "Bearer " + token },
      });

      const assistantMessage: Message = {
        _id: data._id || "ai-" + Date.now(),
        sender: "AI",
        text: data.text,
        createdAt: data.createdAt,
      };

      if (retryResponse) {
        setMessages((previous) => {
          let lastUserIndex = -1;
          for (let index = previous.length - 1; index >= 0; index -= 1) {
            if (previous[index].sender !== "AI") {
              lastUserIndex = index;
              break;
            }
          }
          return lastUserIndex < 0
            ? [...previous, assistantMessage]
            : [...previous.slice(0, lastUserIndex + 1), assistantMessage];
        });
      } else {
        setMessages((previous) => [
          ...previous,
          { _id: "user-" + Date.now(), sender: user?._id || "user", text },
          assistantMessage,
        ]);
        setInput("");
      }
      setGenerationError("");
      setFailedPrompt("");
      setRetryingResponse(false);
    } catch (error) {
      if (version !== requestVersion.current) return;
      const wasCancelled = axios.isCancel(error) || (axios.isAxiosError(error) && error.code === "ERR_CANCELED");
      const message = wasCancelled
        ? "Generation stopped. You can try again."
        : axios.isAxiosError(error)
          ? error.response?.data?.message || "The AI could not respond. Please try again."
          : "The AI could not respond. Please try again.";
      setGenerationError(message);
      setFailedPrompt(retryResponse ? "" : text);
      setRetryingResponse(retryResponse);
    } finally {
      if (generationController.current === controller) {
        generationController.current = null;
        setLoading(false);
      }
    }
  };

  const sendMessage = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    void runGeneration();
  };

  const retryLastResponse = () => {
    if (!loading) void runGeneration(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const lastAssistantMessageId = [...messages].reverse().find((message) => message.sender === "AI")?._id;

  return (
    <section className="ai-main-panel">
      <header className="ai-topbar">
        <button type="button" onClick={onOpenSidebar} className="ai-icon-button md:hidden" aria-label="Open AI conversations">
          <Menu size={20} />
        </button>
        <Link href="/chat" className="ai-home-button" title="Back to all chats">
          <ArrowLeft size={17} /><span>All chats</span>
        </Link>
        <div className="ai-topbar-title">
          <span className="ai-live-icon"><Sparkles size={15} /></span>
          <span className="truncate">{chatId ? chatTitle : "AI Assistant"}</span>
        </div>
        <span className="ai-model-badge"><span />AI World</span>
      </header>

      {!chatId ? (
        <div className="ai-welcome-wrap">
          <div className="ai-welcome-card">
            <div className="ai-welcome-icon"><Sparkles size={28} /></div>
            <p className="ai-eyebrow">YOUR CREATIVE SIDEKICK</p>
            <h2>What can I help you with?</h2>
            <p className="ai-welcome-copy">Start a conversation for ideas, writing, coding, explanations, and everyday questions.</p>
            <div className="ai-suggestion-grid">
              {suggestions.map((suggestion) => (
                <button key={suggestion.title} type="button" onClick={() => onStartNew(suggestion.title)}>
                  <span>{suggestion.prompt}</span><ArrowLeft size={15} className="rotate-180" />
                </button>
              ))}
            </div>
            <button type="button" className="ai-welcome-new" onClick={() => onStartNew()}>
              <Bot size={17} /> Create a named conversation
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="ai-message-scroll" ref={scrollRef}>
            <div className="ai-message-column">
              {historyLoading ? (
                <div className="ai-loading-history"><span className="ai-spinner" /> Loading your conversation…</div>
              ) : historyError ? (
                <div className="ai-history-error" role="alert">
                  <p>{historyError}</p>
                  <button type="button" onClick={() => {
                    const version = ++requestVersion.current;
                    setHistoryError("");
                    setHistoryLoading(true);
                    const token = Cookies.get("token");
                    axios.get(ai_service + "/api/v1/ai/conversations/" + chatId, {
                      headers: { Authorization: "Bearer " + token },
                    }).then(({ data }) => {
                      if (version === requestVersion.current) setMessages(Array.isArray(data.messages) ? data.messages : []);
                    }).catch(() => {
                      if (version === requestVersion.current) setHistoryError("Could not load this conversation. Check your connection and try again.");
                    }).finally(() => {
                      if (version === requestVersion.current) setHistoryLoading(false);
                    });
                  }}>Try again</button>
                </div>
              ) : messages.length === 0 ? (
                <div className="ai-empty-conversation">
                  <div className="ai-empty-icon"><Bot size={21} /></div>
                  <h2>{chatTitle}</h2>
                  <p>Ask anything to get this conversation started.</p>
                </div>
              ) : messages.map((message) => {
                const isAssistant = message.sender === "AI";
                return (
                  <article key={message._id} className={"ai-message-row " + (isAssistant ? "ai-message-assistant" : "ai-message-user")}>
                    <div className={"ai-avatar " + (isAssistant ? "ai-avatar-bot" : "ai-avatar-user")}>
                      {isAssistant ? <Sparkles size={16} /> : <UserRound size={16} />}
                    </div>
                    <div className="ai-message-content">
                      <span className="ai-message-author">{isAssistant ? "ChatApp AI" : "You"}</span>
                      <p>{message.text}</p>
                      {isAssistant && message._id === lastAssistantMessageId && !loading && (
                        <button type="button" className="ai-retry-response" onClick={retryLastResponse}>
                          <RotateCcw size={13} /> Retry response
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {generationError && (
                <div className="ai-generation-error" role="alert">
                  <span>{generationError}</span>
                  <button type="button" disabled={loading} onClick={() => void runGeneration(retryingResponse, failedPrompt)}>
                    <RotateCcw size={14} /> Retry
                  </button>
                </div>
              )}
              {loading && (
                <article className="ai-message-row ai-message-assistant ai-entrance">
                  <div className="ai-avatar ai-avatar-bot"><Sparkles size={16} /></div>
                  <div className="ai-message-content"><span className="ai-message-author">ChatApp AI</span><div className="ai-thinking"><i /><i /><i /></div></div>
                </article>
              )}
            </div>
          </div>

          <div className="ai-composer-wrap">
            <form className="ai-composer" onSubmit={sendMessage}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message your AI assistant…"
                rows={1}
                maxLength={10000}
                aria-label="Message your AI assistant"
                disabled={historyLoading || loading}
              />
              <div className="ai-composer-bottom">
                <span>Enter to send · Shift + Enter for a new line</span>
                {loading ? (
                  <button type="button" className="ai-stop-button" onClick={() => generationController.current?.abort()} aria-label="Stop generation">
                    <Square size={14} fill="currentColor" /> Stop
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() || historyLoading} aria-label="Send message">
                    <Send size={17} />
                  </button>
                )}
              </div>
            </form>
            <p className="ai-disclaimer">AI can make mistakes. Review important information.</p>
          </div>
        </>
      )}
    </section>
  );
};

export default AiChatMessages;
