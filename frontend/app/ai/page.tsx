"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { ai_service, useAppData } from "@/context/AppContext";
import AiChatSidebar from "@/components/AiChatSidebar";
import AiChatMessages from "@/components/AiChatMessages";

const AiChatPage = () => {
  const { aiChats, aiChatsError, fetchAiChats, setAiChats, isAuth, loading } = useAppData();
  const [selectedAiChatId, setSelectedAiChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newChatRequest, setNewChatRequest] = useState(0);
  const handledEntryPrompt = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!isAuth && !loading) router.replace("/login");
  }, [isAuth, loading, router]);

  useEffect(() => {
    if (loading || !isAuth || handledEntryPrompt.current) return;
    if (new URLSearchParams(window.location.search).get("new") !== "1") return;

    handledEntryPrompt.current = true;
    setSidebarOpen(true);
    setNewChatRequest((count) => count + 1);
    router.replace("/ai", { scroll: false });
  }, [isAuth, loading, router]);

  const createAiChat = async (title: string): Promise<boolean> => {
    if (isCreating) return false;
    setIsCreating(true);
    try {
      const token = Cookies.get("token");
      const { data } = await axios.post(
        `${ai_service}/api/v1/ai/conversations`,
        { title: title.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiChats((previous) => [data, ...(previous ?? []).filter((chat) => chat._id !== data._id)]);
      setSelectedAiChatId(data._id);
      setSidebarOpen(false);
      return true;
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      toast.error(message || "Could not create your AI chat. Please try again.");
      return false;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteAiChat = async (id: string) => {
    const chatToDelete = aiChats?.find((chat) => chat._id === id);
    if (!window.confirm("Delete “" + (chatToDelete?.title || "this AI chat") + "” and its message history?")) return;
    try {
      const token = Cookies.get("token");
      await axios.delete(`${ai_service}/api/v1/ai/conversations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAiChats((previous) => (previous ?? []).filter((chat) => chat._id !== id));
      if (selectedAiChatId === id) setSelectedAiChatId(null);
      toast.success("AI chat deleted");
    } catch {
      toast.error("Could not delete this AI chat. Please try again.");
    }
  };

  return (
    <main className="ai-shell flex h-[100dvh] overflow-hidden text-slate-100">
      <div className="ai-ambient" aria-hidden="true">
        <span className="ai-orb ai-orb-one" />
        <span className="ai-orb ai-orb-two" />
        <span className="ai-grid" />
      </div>
      <AiChatSidebar
        aiChats={aiChats}
        aiChatsError={aiChatsError}
        fetchAiChats={fetchAiChats}
        selectedAiChatId={selectedAiChatId}
        setSelectedAiChatId={(id) => { setSelectedAiChatId(id); setSidebarOpen(false); }}
        createAiChat={createAiChat}
        deleteAiChat={deleteAiChat}
        isCreating={isCreating}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        newChatRequest={newChatRequest}
      />
      {sidebarOpen && <button aria-label="Close conversation menu" className="ai-sidebar-scrim md:hidden" onClick={() => setSidebarOpen(false)} />}
      <AiChatMessages
        chatId={selectedAiChatId}
        chatTitle={aiChats?.find((chat) => chat._id === selectedAiChatId)?.title ?? "AI Assistant"}
        onOpenSidebar={() => setSidebarOpen(true)}
        onStartNew={(title) => {
          if (title) {
            void createAiChat(title);
            return;
          }
          setSidebarOpen(true);
          setNewChatRequest((count) => count + 1);
        }}
      />
    </main>
  );
};

export default AiChatPage;
