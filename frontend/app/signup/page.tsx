"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { ShieldCheck, User, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const { register, token } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      router.push("/");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!username || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register(username, password, username);
      setSuccessMsg("Identity registered successfully! Redirecting...");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register. User ID might be taken.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden font-sans select-none">
      
      {/* --- ROTATING COSMIC EARTH BACKGROUND --- */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div 
          className="w-[180vh] h-[180vh] md:w-[150vh] md:h-[150vh] rounded-full bg-cover bg-center opacity-30 animate-[spin_240s_linear_infinite] filter brightness-[0.75] contrast-[1.05]"
          style={{ backgroundImage: "url('/cosmic-earth.png')" }}
        />
        {/* Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/90" />
      </div>

      {/* Auth Card Container */}
      <div className="relative z-10 w-full max-w-[390px] mx-4 animate-in fade-in zoom-in duration-500">
        
        {/* Glassmorphic Form Card */}
        <div className="bg-slate-950/80 border border-purple-500/20 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_0_50px_rgba(168,85,247,0.1)]">
          
          {/* Top Shield Check Icon */}
          <div className="flex justify-center mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold tracking-wide text-white">
              Join The Network
            </h1>
            <p className="text-[10px] uppercase tracking-[0.1em] text-purple-400 font-extrabold mt-1">
              Private Ecosphere Node Setup
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* User ID */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 focus:bg-slate-900/50 transition-all font-medium"
                placeholder="User ID"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-900/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 focus:bg-slate-900/50 transition-all font-medium"
                placeholder="Create Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Confirm Password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 focus:bg-slate-900/50 transition-all font-medium"
                placeholder="Confirm Password"
              />
            </div>

            {/* Submit Register Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>{isSubmitting ? "Registering..." : "Create Identity"}</span>
              <span className="text-[12px] font-normal">&rarr;</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-[10px] text-slate-400 hover:text-purple-400 transition-colors font-medium">
              Already initialized? Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
