import { useState, useMemo } from "react"
import { Activity, Droplets, Zap, AlertTriangle, ArrowUpRight, TrendingDown, Clock } from "lucide-react"

interface BorewellMonitorProps {
  isMotorOn?: boolean
  onMotorToggle?: () => void
  activeBorewellIndex: number
  onBorewellChange: (index: number) => void
  // PHASE 3: Optional borewells list; hides tabs when only 1 borewell installed
  borewells?: Array<{ id: string; name?: string }>
  data?: {
    flowRate: number | string
    efficiency: number | string
    voltage: number | string
    current: number | string
    runTime: string
    runTimeUnit?: string
    liters: string
  }
}

export function BorewellMonitorCard({ 
  isMotorOn = true, 
  onMotorToggle, 
  data,
  activeBorewellIndex,
  onBorewellChange,
  borewells
}: BorewellMonitorProps) {
  const displayData = data || {
    flowRate: 42.5,
    efficiency: 72,
    voltage: 232,
    current: 8.4,
    runTime: "4.5",
    liters: "850"
  };

  // PHASE 3 FIX: Dynamic tabs — hide entirely when only 1 borewell installed.
  // Parent passes `borewells` from DB; default to single borewell if not provided.
  const tabs = (borewells && borewells.length > 0)
    ? borewells.map((bw, i) => ({ id: i, label: bw.name || `Borewell ${i + 1}` }))
    : [{ id: 0, label: "Borewell 1" }];
  const showTabs = tabs.length > 1;

  return (
    <div className="dash-tile relative flex h-full flex-col overflow-hidden rounded-2xl p-4 bg-[rgba(8,15,38,0.45)] ring-1 ring-inset ring-white/[0.11] shadow-[inset_0_1px_1px_rgba(255,255,255,0.14)] transition-all duration-200">
      {/* Background Glow */}
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full blur-[80px] bg-cyan-500/10 pointer-events-none transition-colors duration-700" />

      {/* HEADER */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#00e5ff] flex items-center gap-2">
          <Activity className="h-4 w-4" strokeWidth={2.5} />
          {showTabs ? `Aquifer Monitor ${activeBorewellIndex + 1}` : "Aquifer Monitor"}
        </h3>

        {/* Real-time Motor Status Indicator Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider select-none transition-all duration-300 ${
            isMotorOn
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
              : "bg-slate-800/80 text-slate-400 border-slate-700/80"
          }`}
        >
          <div
            className={`h-1.5 w-1.5 rounded-full ${
              isMotorOn ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
            }`}
          />
          {isMotorOn ? "RUNNING" : "STANDBY · COMMAND AWAITED"}
        </div>
      </div>

      {/* MAIN CONTENT AREA WITH PERMANENT 4-BOX GRID */}
      <div className="flex-1 relative mt-1 min-h-0 flex flex-col justify-center">
        <div 
          className="w-full my-auto transition-all duration-500 ease-in-out"
          key={activeBorewellIndex}
          style={{ 
            animation: 'slideIn 0.5s ease-out forwards' 
          }}
        >
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 w-full transition-all duration-500 ${isMotorOn ? "opacity-100" : "opacity-45"}`}>
            {/* BOX 1: FLOW */}
            <div className={`flex flex-col justify-between h-[104px] rounded-[18px] bg-[#0f1522] border p-3 relative overflow-hidden transition-all duration-300 ${isMotorOn ? "border-white/5" : "border-white/[0.03]"}`}>
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-medium uppercase tracking-widest mt-0.5 ${isMotorOn ? "text-[#94a3b8]" : "text-slate-500"}`}>Flow</span>
                <div className={`rounded-lg border p-1 ${isMotorOn ? "border-[#00e5ff]/20 bg-[#00e5ff]/5 text-[#00e5ff]" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
                  <Droplets className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[20px] font-bold tracking-tighter leading-none ${isMotorOn ? "text-white" : "text-slate-400"}`}>
                  {isMotorOn ? displayData.flowRate : "0.0"}
                </span>
                <span className="text-[9px] font-medium text-[#64748b] uppercase tracking-widest">LPM</span>
              </div>
            </div>

            {/* BOX 2: EFF. */}
            <div className={`flex flex-col justify-between h-[104px] rounded-[18px] bg-[#0f1522] border p-3 relative overflow-hidden transition-all duration-300 ${isMotorOn ? "border-white/5" : "border-white/[0.03]"}`}>
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-medium uppercase tracking-widest mt-0.5 ${isMotorOn ? "text-[#00e5ff]" : "text-slate-500"}`}>Eff.</span>
                <ArrowUpRight className={`h-4 w-4 ${isMotorOn ? "text-[#00e5ff]" : "text-slate-600"}`} strokeWidth={2.5} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[20px] font-bold tracking-tighter leading-none ${isMotorOn ? "text-[#00e5ff]" : "text-slate-400"}`}>
                  {isMotorOn ? `${displayData.efficiency}%` : "0%"}
                </span>
                <span className={`text-[9px] font-medium uppercase tracking-widest ${isMotorOn ? "text-[#00e5ff]/60" : "text-slate-600"}`}>
                  {isMotorOn ? "(85)" : "(0)"}
                </span>
              </div>
            </div>

            {/* BOX 3: POWER */}
            <div className={`flex flex-col justify-between h-[104px] rounded-[18px] bg-[#0f1522] border p-3 relative overflow-hidden transition-all duration-300 ${isMotorOn ? "border-white/5" : "border-white/[0.03]"}`}>
              <div className="flex items-start justify-between">
                <span className={`text-[11px] font-medium uppercase tracking-widest mt-0.5 ${isMotorOn ? "text-[#94a3b8]" : "text-slate-500"}`}>Power</span>
                <div className={`rounded-lg border p-1 ${isMotorOn ? "border-[#fbbf24]/20 bg-[#fbbf24]/5 text-[#fbbf24] shadow-[0_0_8px_rgba(251,191,36,0.1)]" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
                  <Zap className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[20px] font-bold tracking-tighter leading-none ${isMotorOn ? "text-[#fbbf24]" : "text-slate-400"}`}>
                  {isMotorOn ? `${displayData.voltage}V` : "0V"}
                </span>
                <span className={`text-[9px] font-medium ${isMotorOn ? "text-[#fbbf24]/70" : "text-slate-600"}`}>
                  {isMotorOn ? `${displayData.current}A` : "0.0A"}
                </span>
              </div>
            </div>

            {/* BOX 4: RUN TIME */}
            <div className={`flex flex-col justify-between h-[104px] rounded-[18px] bg-[#0f1522] border p-3 relative overflow-hidden transition-all duration-300 ${isMotorOn ? "border-white/5" : "border-white/[0.03]"}`}>
              <div className="flex items-start justify-between">
                <span className={`text-[10px] font-medium uppercase tracking-widest mt-0.5 ${isMotorOn ? "text-[#94a3b8]" : "text-slate-500"}`}>Run Time</span>
                <div className={`rounded-lg border p-1 ${isMotorOn ? "border-[#3b82f6]/20 bg-[#3b82f6]/5 text-[#3b82f6]" : "border-white/5 bg-white/[0.02] text-slate-500"}`}>
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-[20px] font-bold tracking-tighter leading-none ${isMotorOn ? "text-[#3b82f6]" : "text-slate-400"}`}>
                  {isMotorOn ? displayData.runTime : "0.0"}
                </span>
                <span className="text-[8px] font-medium text-[#64748b] uppercase tracking-widest">
                  {isMotorOn ? (displayData.runTimeUnit || "HRS") : "HRS"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOREWELL SELECTOR TABS - SLEEK VERSION (hidden when only 1 borewell) */}
      {showTabs && (
      <div className="mt-auto pt-4 px-1">
        <div className="relative h-[22px] w-full rounded-full bg-white/[0.03] border border-white/[0.05] p-1 flex items-center overflow-x-auto scrollbar-none backdrop-blur-sm group/nav">
          {/* Sliding Glow Indicator */}
          <div 
            className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
            style={{ 
              width: `calc(${100 / tabs.length}% - 4px)`,
              left: `calc(${activeBorewellIndex * (100 / tabs.length)}% + 2px)`,
            }}
          >
            <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse" />
          </div>

          {/* Tab Buttons */}
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onBorewellChange(tab.id)}
              className={`relative z-10 flex-1 h-full flex items-center justify-center transition-all duration-300 text-[9px] font-semibold uppercase tracking-[0.1em] ${
                activeBorewellIndex === tab.id 
                ? "text-black" 
                : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Subtle status indicator dot below active tab */}
        <div className="flex justify-around mt-1.5 px-1">
            {tabs.map((tab) => (
                <div 
                    key={tab.id}
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                        activeBorewellIndex === tab.id 
                        ? "w-4 bg-cyan-400 opacity-100" 
                        : "w-1 bg-white/10 opacity-30"
                    }`}
                />
            ))}
        </div>
      </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(10px);
            opacity: 0;
            filter: blur(4px);
          }
          to {
            transform: translateX(0);
            opacity: 1;
            filter: blur(0px);
          }
        }
      `}</style>
    </div>
  )
}


