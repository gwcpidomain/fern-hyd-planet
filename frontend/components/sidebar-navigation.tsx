"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider";
import { getApiBaseUrl } from "@/lib/api-url";
import { LayoutDashboard, X, LogOut, Cpu, Download } from "lucide-react"

interface SidebarNavigationProps {
  isOpen: boolean;
  onToggle: () => void;
  activeView: string;
  onNavigate: (view: string) => void;
}

export function SidebarNavigation({ isOpen, onToggle, activeView, onNavigate }: SidebarNavigationProps) {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { user, logout, token } = useAuth();

  // HYDRATION GUARD
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const menuItems = [
    {
      id: "dashboard",
      label: "My Dashboard",
      icon: LayoutDashboard,
      description: "Live Monitoring",
    },
    {
      id: "devices",
      label: "My Devices",
      icon: Cpu,
      description: "Manage Hardware",
    }
  ]

  const handleNavClick = (itemId: string) => {
    onNavigate(itemId)
    if (itemId === "dashboard" || itemId === "devices") onToggle()
  }

  const handleDownloadCSV = async () => {
    if (!token) return;
    try {
      const apiUrl = getApiBaseUrl();
      const exportUrl = `${apiUrl}/api/export/csv`;

      const res = await fetch(exportUrl, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `env_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (e) {
      console.error("CSV Download failed:", e);
      alert("Failed to download CSV. Ensure you are online.");
    }
  }

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`fixed inset-0 z-[150] bg-black/60 transition-all duration-300 ${isOpen ? "opacity-100 backdrop-blur-md" : "pointer-events-none opacity-0 backdrop-blur-none"
          }`}
        onClick={onToggle}
      />

      {/* Sidebar Panel */}
      <aside
        className={`fixed left-0 top-0 z-[200] flex h-screen w-[280px] sm:w-[340px] flex-col border-r border-primary/10 bg-gradient-to-b from-[#0a0f1a]/98 via-[#0d1425]/98 to-[#0a0f1a]/98 shadow-[0_0_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 ease-out ${isOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-6 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 animate-pulse rounded-full bg-emerald-500/30 blur-md" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500">
                <LayoutDashboard className="h-5 w-5 text-black" />
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-white">Environmental</h2>
              <p className="text-xs text-slate-400">Intelligence System</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Menu
          </div>
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavClick(item.id)}
                    className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-300 ${isActive
                      ? "bg-gradient-to-r from-primary/20 to-secondary/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-300 ${isActive ? "bg-primary/20 text-primary" : "bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{item.label}</div>
                    </div>
                  </button>
                </li>
              )
            })}
            {/* Download CSV Item */}
            <li>
              <button
                onClick={handleDownloadCSV}
                className="group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-400 hover:bg-white/5 hover:text-white transition-all duration-300"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white transition-all duration-300">
                  <Download className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Download CSV</div>
                </div>
              </button>
            </li>
          </ul>
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 p-4 dark:border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-xs font-bold text-slate-950 uppercase">
              {user?.full_name?.[0] || user?.email?.[0] || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{user?.full_name || "User"}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
            <button onClick={logout} className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-slate-500 transition-colors" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
