"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { User, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login, token } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (token) {
      router.push("/");
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden font-sans select-none">
      
      {/* --- ROTATING COSMIC EARTH BACKGROUND --- */}
      <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <div 
          className="w-[260vh] h-[260vh] md:w-[220vh] md:h-[220vh] rounded-full bg-cover bg-center opacity-[0.45] animate-[spin_240s_linear_infinite] filter brightness-[0.75] contrast-[1.05]"
          style={{ backgroundImage: "url('/cosmic-earth.png')" }}
        />
        {/* Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950/90" />
      </div>

      {/* Auth Card Container */}
      <div className="relative z-10 w-full max-w-[390px] mx-4 animate-in fade-in zoom-in duration-500">
        
        {/* Glassmorphic Form Card */}
        <div className="bg-slate-950/80 border border-emerald-500/20 backdrop-blur-2xl rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
          
          {/* Top Pulsing Green Dot */}
          <div className="flex justify-center mb-6">
            <div className="relative flex h-4 w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_15px_#10b981]"></span>
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold tracking-wide text-white">
              Planet Insights
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-extrabold mt-1">
              Environmental Monitoring
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* User ID Field */}
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-900/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-slate-900/50 transition-all font-medium"
                placeholder="User ID"
              />
            </div>

            {/* Security Key Field */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-900/30 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 focus:bg-slate-900/50 transition-all font-medium"
                placeholder="Security Key"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>{isSubmitting ? "Signing in..." : "Sign In"}</span>
              <span className="text-[12px] font-normal">&rarr;</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/signup" className="text-[10px] text-slate-400 hover:text-emerald-400 transition-colors font-medium">
              Need access? Contact your admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
