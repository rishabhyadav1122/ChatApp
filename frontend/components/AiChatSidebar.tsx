"use client";

import React, { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, LoaderCircle, MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import { AiChat } from "@/context/AppContext";

interface AiChatSidebarProps {
  aiChats: AiChat[] | null;
  aiChatsError: string | null;
  fetchAiChats: () => Promise<void>;
  selectedAiChatId: string | null;
  setSelectedAiChatId: (id: string | null) => void;
  createAiChat: (title: string) => Promise<boolean>;
  deleteAiChat: (id: string) => void;
  isCreating: boolean;
  open: boolean;
  onClose: () => void;
  newChatRequest: number;
}

const AiChatSidebar = ({
  aiChats,
  aiChatsError,
  fetchAiChats,
  selectedAiChatId,
  setSelectedAiChatId,
  createAiChat,
  deleteAiChat,
  isCreating,
  open,
  onClose,
  newChatRequest,
}: AiChatSidebarProps) => {
  const [isNaming, setIsNaming] = useState(false);
  const [dismissedRequest, setDismissedRequest] = useState(0);
  const [title, setTitle] = useState("");
  const showNameForm = isNaming || newChatRequest > dismissedRequest;

  const closeNameForm = () => {
    setIsNaming(false);
    setTitle("");
    setDismissedRequest(newChatRequest);
  };

  const submitNewChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || isCreating) return;
    const created = await createAiChat(cleanTitle);
    if (!created) return;
    closeNameForm();
  };

  return (
    <aside className={`ai-sidebar ${open ? "ai-sidebar-open" : ""}`} aria-label="AI conversations">
      <div className="ai-sidebar-top">
        <div className="flex items-center justify-between">
          <Link href="/chat" className="ai-back-link" onClick={onClose}>
            <ArrowLeft size={16} /> <span>All chats</span>
          </Link>
          <button type="button" onClick={onClose} className="ai-icon-button md:hidden" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="ai-brand-block">
          <div className="ai-brand-icon"><Bot size={22} /></div>
          <div>
            <p className="ai-eyebrow">CHATAPP</p>
            <h1>AI Assistant</h1>
          </div>
        </div>

        <button type="button" className="ai-new-chat-button" onClick={() => setIsNaming(true)}>
          <MessageSquarePlus size={17} /> <span>New conversation</span> <span className="ai-shortcut">+</span>
        </button>

        {showNameForm && (
          <form className="ai-name-form" onSubmit={submitNewChat}>
            <label htmlFor="ai-chat-title">Name this conversation</label>
            <input
              id="ai-chat-title"
              autoFocus
              maxLength={120}
              placeholder="e.g. Ideas for my portfolio"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="ai-small-button" onClick={closeNameForm}>Cancel</button>
              <button type="submit" className="ai-small-button ai-small-button-primary" disabled={!title.trim() || isCreating}>
                {isCreating ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                Create
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="ai-history-heading"><span>YOUR CONVERSATIONS</span><Sparkles size={14} /></div>
      <div className="ai-history-list">
        {aiChatsError ? (
          <div className="ai-history-empty ai-history-failure">
            <span>{aiChatsError}</span>
            <button type="button" onClick={() => void fetchAiChats()}>Try again</button>
          </div>
        ) : aiChats === null ? (
          <div className="ai-history-empty"><LoaderCircle size={18} className="animate-spin" /><span>Loading conversations…</span></div>
        ) : aiChats.length ? aiChats.map((chat) => (
          <div key={chat._id} className={`ai-history-item ${selectedAiChatId === chat._id ? "ai-history-item-active" : ""}`}>
            <button type="button" onClick={() => setSelectedAiChatId(chat._id)} className="ai-history-select" title={chat.title}>
              <span className="ai-history-dot" />
              <span className="truncate">{chat.title}</span>
            </button>
            <button type="button" onClick={() => deleteAiChat(chat._id)} className="ai-delete-button" aria-label={`Delete ${chat.title}`} title="Delete conversation">
              <Trash2 size={15} />
            </button>
          </div>
        )) : (
          <div className="ai-history-empty"><Bot size={18} /><span>Your conversations will appear here.</span></div>
        )}
      </div>
      <div className="ai-sidebar-footer">
        <div className="ai-status-dot" /> Ready when you are
      </div>
    </aside>
  );
};

export default AiChatSidebar;
