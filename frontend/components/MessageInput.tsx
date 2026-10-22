import { Bot, Loader2, Paperclip, Send, X } from "lucide-react";
import React, { FormEvent, useState } from "react";
import AiModal from "@/components/AiModal";

interface MessageInputProps {
  selectedUser: string | null;
  message: string;
  setMessage: (message: string) => void;
  handleMessageSend: (e: FormEvent<HTMLFormElement>, imageFile?: File | null) => Promise<boolean>;
}
 
const MessageInput = ({
  selectedUser,
  message,
  setMessage,
  handleMessageSend,
}: MessageInputProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!message.trim() && !imageFile) return;

    setIsUploading(true);
    try {
      const sent = await handleMessageSend(e, imageFile);
      if (sent) setImageFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  if (!selectedUser) return null;
  return (
    <form
      onSubmit={handleSubmit}
      className="message-composer flex flex-col gap-2 border-t border-gray-700 pt-3"
    >
      {assistantOpen && (
        <AiModal
          currentText={message}
          onClose={() => setAssistantOpen(false)}
          onApply={(text) => {
            setMessage(text);
            setAssistantOpen(false);
          }}
        />
      )}
      {imageFile && (
        <div className="relative w-fit">
          <img
            src={URL.createObjectURL(imageFile)}
            alt="preview"
            className="w-24 h-24 object-cover rounded-lg border border-gray-600"
          />
          <button
            type="button"
            className="cursor-pointer absolute -top-2 -right-2 bg-black rounded-full p-1"
            onClick={() => setImageFile(null)}
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 rounded-lg px-3 py-2 transition-colors">
          <Paperclip size={18} className="text-gray-300" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && file.type.startsWith("image/")) {
                setImageFile(file);
              }
            }}
          />
        </label>

        <input
          type="text"
          className="message-composer-input flex-1 rounded-xl px-4 py-3 text-white placeholder-gray-400"
          placeholder={imageFile ? "Add a caption..." : "Type a message..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          disabled={!message.trim() || isUploading}
          aria-label="Improve message with AI"
          title="Improve message with AI"
          className="ai-composer-assist"
        >
          <Bot size={18} />
          <span>AI</span>
        </button>

        <button
          type="submit"
          disabled={(!imageFile && !message) || isUploading}
          className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-white"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </form>
  );
};

export default MessageInput;
