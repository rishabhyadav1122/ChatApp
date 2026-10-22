"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, RefreshCcw, X } from "lucide-react";
import Cookies from "js-cookie";
import axios from "axios";
import { ai_service } from "@/context/AppContext";

interface AiModalProps {
  onClose: () => void;
  onApply: (text: string) => void;
  currentText: string;
}

const tones = ["Professional", "Friendly", "Casual", "Formal", "Concise", "Empathetic", "Confident"];
const languages = [
  "Arabic", "Bengali", "Chinese", "Dutch", "English", "French", "German",
  "Hindi", "Indonesian", "Italian", "Japanese", "Korean", "Portuguese",
  "Russian", "Spanish", "Tamil", "Telugu", "Turkish", "Urdu",
];

const AiModal = ({ onClose, onApply, currentText }: AiModalProps) => {
  const [operation, setOperation] = useState<"grammar" | "tone" | "translate">("grammar");
  const [tone, setTone] = useState("Professional");
  const [targetLanguage, setTargetLanguage] = useState("Hindi");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const selectOperation = (next: typeof operation) => {
    setOperation(next);
    setResult("");
    setError("");
  };

  const handleRewrite = async () => {
    if (!currentText.trim() || loading) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    setResult("");

    try {
      const token = Cookies.get("token");
      const payload: Record<string, string> = { text: currentText, operation };
      if (operation === "tone") payload.tone = tone;
      if (operation === "translate") payload.targetLanguage = targetLanguage;
      const response = await axios.post(
        ai_service + "/api/v1/ai/rewrite",
        payload,
        {
          signal: controller.signal,
          headers: { Authorization: "Bearer " + token },
        }
      );
      if (typeof response.data.result !== "string" || !response.data.result.trim()) {
        throw new Error("The AI returned an empty result. Please try again.");
      }
      setResult(response.data.result);
      requestAnimationFrame(() => previewRef.current?.focus());
    } catch (requestError) {
      if (axios.isCancel(requestError)) return;
      const message = axios.isAxiosError(requestError)
        ? requestError.response?.data?.message
        : requestError instanceof Error
          ? requestError.message
          : null;
      setError(message || "Could not improve this message. Please try again.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <div className="ai-modal-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose();
    }}>
      <section className="ai-modal-panel" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
        <header className="ai-modal-header">
          <div className="ai-modal-heading">
            <span className="ai-modal-icon"><Bot size={20} /></span>
            <div>
              <p className="ai-eyebrow">MESSAGE ASSISTANT</p>
              <h2 id="ai-modal-title">Polish your message</h2>
            </div>
          </div>
          <button type="button" className="ai-icon-button" aria-label="Close AI assistant" onClick={onClose} disabled={loading}>
            <X size={18} />
          </button>
        </header>

        <p className="ai-modal-description">Choose a transformation. Your original draft stays in the composer until you apply a result.</p>
        {currentText.length > 2000 && <p className="ai-modal-error">The message assistant supports drafts up to 2,000 characters.</p>}

        <div className="ai-modal-tabs" role="tablist" aria-label="Message improvement">
          {([
            ["grammar", "Grammar"],
            ["tone", "Change tone"],
            ["translate", "Translate"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={operation === value}
              className={operation === value ? "ai-modal-tab ai-modal-tab-active" : "ai-modal-tab"}
              onClick={() => selectOperation(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {operation === "tone" && (
          <label className="ai-modal-field">
            <span>Write in this tone</span>
            <select value={tone} onChange={(event) => { setTone(event.target.value); setResult(""); }}>
              {tones.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        )}
        {operation === "translate" && (
          <label className="ai-modal-field">
            <span>Translate into</span>
            <select value={targetLanguage} onChange={(event) => { setTargetLanguage(event.target.value); setResult(""); }}>
              {languages.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        )}

        <button type="button" className="ai-modal-generate" onClick={() => void handleRewrite()} disabled={loading || !currentText.trim() || currentText.length > 2000}>
          {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={16} />}
          {loading ? "Working on it…" : result ? "Generate again" : "Improve message"}
        </button>

        {error && <p role="alert" className="ai-modal-error">{error}</p>}

        {result ? (
          <label className="ai-modal-field ai-modal-preview-field">
            <span>Review and edit the result</span>
            <textarea ref={previewRef} value={result} onChange={(event) => setResult(event.target.value)} rows={5} maxLength={2000} />
          </label>
        ) : (
          <div className="ai-modal-original">
            <span>Your draft</span>
            <p>{currentText}</p>
          </div>
        )}

        <footer className="ai-modal-footer">
          <button type="button" className="ai-modal-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="ai-modal-apply" disabled={!result.trim() || loading} onClick={() => onApply(result.trim())}>
            <Check size={16} /> Apply to draft
          </button>
        </footer>
      </section>
    </div>
  );
};

export default AiModal;
