"use client";
import Loading from "@/components/Loading";
import { useAppData, user_service } from "@/context/AppContext";
import axios from "axios";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { redirect, useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

const LoginPage = () => {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const { isAuth, loading: userLoading } = useAppData();

  const handleSubmit = async (
    e: React.FormEvent<HTMLElement>
  ): Promise<void> => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setLoading(true);

    try {
      const { data } = await axios.post(
        `${user_service}/api/v1/login`,
        { email: normalizedEmail }
      );

      toast.success(data.message);
      router.push(`/verify?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (error: unknown) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      toast.error(message || "Could not send a verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) return <Loading />;
  if (isAuth) return redirect("/chat");
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="auth-card rounded-2xl p-8">
          <div className="text-center mb-8">
            <div className="auth-brand-icon mx-auto w-20 h-20 rounded-2xl flex items-center justify-center mb-6">
              <Mail size={36} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">
              Welcome To ChatApp
            </h1>
            <p className="text-gray-300 text-lg">
              Enter your email to continue your journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                className="auth-input w-full px-4 py-4 rounded-xl text-white placeholder-gray-400"
                placeholder="Enter Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="auth-submit w-full cursor-pointer text-white py-4 px-6 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !email.trim()}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5" />
                  Sending Otp to your mail...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Send Verification Code</span>
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
