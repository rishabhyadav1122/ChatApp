"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import Cookies from "js-cookie";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

export const user_service = "http://3.7.127.214:5000";
export const chat_service = "http://3.7.127.214:5002";
export const ai_service = "http://3.7.127.214:5103";

export interface User {
  _id: string;
  name: string;
  email: string;
}

export interface Chat {
  _id: string;
  users: string[];
  latestMessage: {
    text: string;
    sender: string;
  };
  createdAt: string;
  updatedAt: string;
  unseenCount?: number;
}

export interface Chats {
  _id: string;
  user: User;
  chat: Chat;
}

export interface AiChat {
  _id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  user: User | null;
  loading: boolean;
  isAuth: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setIsAuth: React.Dispatch<React.SetStateAction<boolean>>;
  logoutUser: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchChats: () => Promise<void>;
  aiChats: AiChat[] | null;
  aiChatsError: string | null;
  setAiChats: React.Dispatch<React.SetStateAction<AiChat[] | null>>;
  fetchAiChats: () => Promise<void>;
  chats: Chats[] | null;
  users: User[] | null;
  setChats: React.Dispatch<React.SetStateAction<Chats[] | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chats[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [aiChats, setAiChats] = useState<AiChat[] | null>(null);
  const [aiChatsError, setAiChatsError] = useState<string | null>(null);

  async function fetchUser() {
    const token = Cookies.get("token");
    if (!token) {
      setLoading(false);
      setUser(null);
      setIsAuth(false);
      return;
    }

    try {
      const { data } = await axios.get(`${user_service}/api/v1/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
      setIsAuth(true);
    } catch {
      setUser(null);
      setIsAuth(false);
    } finally {
      setLoading(false);
    }
  }

  const fetchChats = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) {
      setChats([]);
      return;
    }
    try {
      const { data } = await axios.get(`${chat_service}/api/v1/chat/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChats(Array.isArray(data.chats) ? data.chats : []);
    } catch {
      setChats([]);
    }
  }, []);

  async function fetchUsers() {
    const token = Cookies.get("token");
    if (!token) {
      setUsers([]);
      return;
    }
    try {
      const { data } = await axios.get(`${user_service}/api/v1/user/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }

  async function fetchAiChats() {
    const token = Cookies.get("token");
    if (!token) {
      setAiChats([]);
      setAiChatsError(null);
      return;
    }

    setAiChatsError(null);
    try {
      const { data } = await axios.get(
        `${ai_service}/api/v1/ai/conversations`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!Array.isArray(data)) {
        throw new Error("The AI service returned an invalid conversation list.");
      }
      setAiChats(data);
    } catch (error) {
      setAiChats(null);
      setAiChatsError(
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : "Could not load AI conversations. Check the AI service and try again."
      );
    }
  }

  async function logoutUser() {
    Cookies.remove("token");
    setUser(null);
    setIsAuth(false);
    setChats([]);
    setUsers([]);
    setAiChats([]);
    setAiChatsError(null);
    toast.success("User Logged Out");
  }

  useEffect(() => {
    void fetchUser();
    void fetchChats();
    void fetchUsers();
    void fetchAiChats();
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        isAuth,
        setIsAuth,
        loading,
        logoutUser,
        fetchChats,
        fetchAiChats,
        aiChats,
        aiChatsError,
        setAiChats,
        fetchUsers,
        chats,
        users,
        setChats,
      }}
    >
      {children}
      <Toaster />
    </AppContext.Provider>
  );
};

export const useAppData = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useappdata must be used within AppProvider");
  }
  return context;
};
