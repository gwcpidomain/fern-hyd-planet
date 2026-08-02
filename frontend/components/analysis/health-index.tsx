"use client"

import { ShieldCheck, Wrench, Timer, Droplets, Zap, FlaskConical } from 'lucide-react'
import { useMemo } from 'react'

// ── Health Pillars ──────────────────────────────────────────────
interface HealthPillar {
  label: string
  score: number        // 0-100
  icon: React.ReactNode
  color: string
  glowColor: string
  status: string       // "NOMINAL" | "CAUTION" | "CRITICAL"
}

// ── Maintenance Prediction ──────────────────────────────────────
interface MaintenanceItem {
  label: string
  daysLeft?: number
  icon: React.ReactNode
  urgency: 'low' | 'medium' | 'high'
  value?: string
}

interface BorewellHealthIndexProps {
  waterData?: {
    level: number
    ph: number
    tds: number
    irms?: number
    flowRate?: number
    efficiency?: number
    turbidity?: number
  }
  isMotorOn?: boolean
  leakStatus?: string
  isOffline?: boolean
}

export function BorewellHealthIndex({ 
  waterData, 
  isMotorOn = false, 
  leakStatus = "Nominal",
  isOffline = false
}: BorewellHealthIndexProps) {

  // Extract variables safely
  const level = waterData?.level ?? 4.5;
  const ph = waterData?.ph ?? 7.2;
  const tds = waterData?.tds ?? 250;
  const flowRate = waterData?.flowRate ?? 0;
  const efficiency = waterData?.efficiency ?? 75;
  const turbidity = waterData?.turbidity ?? 1.2;

  // ── Health Pillars Calculations ──────────────────────────────
  const pillars: HealthPillar[] = useMemo(() => {
    // 1. Mechanical Health: Based on motor status, current efficiency and active state
    // Normal efficiency target is 65-90%. If motor is off, we default to 95 (nominal standby status).
    const mechanicalScore = isMotorOn 
      ? (efficiency > 0 ? Math.min(100, Math.max(30, Math.round(efficiency))) : 85)
      : 95;
    
    const mechanicalStatus = mechanicalScore >= 75 ? "NOMINAL" : "GOOD";
    const mechanicalColor = mechanicalStatus === "NOMINAL" ? "#10b981" : "#f59e0b";
    const mechanicalGlow = mechanicalStatus === "NOMINAL" ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)";

    // 2. Hydrological Health: Water Level (optimal > 3.5ft) and Flow rate stability
    const levelScore = Math.min(100, Math.max(10, (level / 6.0) * 100));
    const flowScore = isMotorOn ? Math.min(100, Math.max(10, (flowRate / 45.0) * 100)) : 90;
    const hydrologicalScore = Math.round((levelScore + flowScore) / 2);
    
    const hydrologicalStatus = hydrologicalScore >= 75 ? "NOMINAL" : "GOOD";
    const hydrologicalColor = hydrologicalStatus === "NOMINAL" ? "#10b981" : "#f59e0b";
    const hydrologicalGlow = hydrologicalStatus === "NOMINAL" ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)";

    // 3. Hydro phonic parameters: pH balance (ideal 7.2), TDS levels (ideal < 300), Turbidity (ideal < 2.0 NTU)
    const phScore = Math.max(0, 100 - Math.abs(7.2 - ph) * 45);
    const tdsScore = Math.max(0, 100 - Math.max(0, tds - 300) * 0.15);
    const turbidityScore = Math.max(0, 100 - turbidity * 8);
    const biochemicalScore = Math.round((phScore + tdsScore + turbidityScore) / 3);

    const biochemicalStatus = biochemicalScore >= 75 ? "NOMINAL" : "GOOD";
    const biochemicalColor = biochemicalStatus === "NOMINAL" ? "#10b981" : "#f59e0b";
    const biochemicalGlow = biochemicalStatus === "NOMINAL" ? "rgba(16, 185, 129, 0.4)" : "rgba(245, 158, 11, 0.4)";

    return [
      {
        label: "Pump & Motor Health",
        score: mechanicalScore,
        icon: <Zap className="h-3 w-3" />,
        color: mechanicalColor,
        glowColor: mechanicalGlow,
        status: mechanicalStatus,
      },
      {
        label: "Aquifer Yield & Flow",
        score: hydrologicalScore,
        icon: <Droplets className="h-3 w-3" />,
        color: hydrologicalColor,
        glowColor: hydrologicalGlow,
        status: hydrologicalStatus,
      },
      {
        label: "Water Quality",
        score: biochemicalScore,
        icon: <FlaskConical className="h-3 w-3" />,
        color: biochemicalColor,
        glowColor: biochemicalGlow,
        status: biochemicalStatus,
      },
    ];
  }, [level, ph, tds, flowRate, efficiency, turbidity, isMotorOn]);

  const overallScore = useMemo(() => {
    return Math.round(pillars[0].score * 0.35 + pillars[1].score * 0.35 + pillars[2].score * 0.30)
  }, [pillars])

  const verdictLabel = overallScore >= 75 ? "OPTIMAL" : "GOOD"
  const verdictColor = overallScore >= 75 ? "text-emerald-400" : "text-amber-400"
  const verdictBg = overallScore >= 75 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"

  // ── Maintenance Predictions ───────────────────────────────
  const maintenance: MaintenanceItem[] = useMemo(() => {
    // Estimate pump service days left based on mechanical health
    const pumpServiceDays = Math.max(5, Math.round((pillars[0].score / 100) * 50));
    // Estimate filter change days based on turbidity/tds chemical health
    const filterChangeDays = Math.max(2, Math.round((pillars[2].score / 100) * 15));

    return [
      {
        label: "Pump Service",
        daysLeft: pumpServiceDays,
        icon: <Wrench className="h-3 w-3 text-slate-400" />,
        urgency: pumpServiceDays < 15 ? 'high' : pumpServiceDays < 30 ? 'medium' : 'low',
      },
      {
        label: "Filter Change",
        daysLeft: filterChangeDays,
        icon: <Timer className="h-3 w-3 text-amber-400" />,
        urgency: filterChangeDays < 5 ? 'high' : filterChangeDays < 10 ? 'medium' : 'low',
      },
      {
        label: "Leak Detection",
        value: leakStatus,
        icon: <Droplets className={`h-3 w-3 ${leakStatus === 'Nominal' ? 'text-emerald-400' : 'text-slate-400'}`} />,
        urgency: (leakStatus === 'Nominal' ? 'low' : 'medium') as any,
      },
    ];
  }, [pillars, leakStatus]);

  // ── Helper: Get bar color based on score ──────────────────
  const getBarGradient = (score: number) => {
    if (score >= 75) return "from-emerald-500 to-emerald-400"
    return "from-amber-500 to-amber-400"
  }

  // Generate diagnostic description dynamically
  const diagnosticText = useMemo(() => {
    if (verdictLabel === "OPTIMAL") {
      return "Hydraulic stable. Aquifer recharge within normal parameters. Chemical draw nominal.";
    } else {
      const issues = [];
      if (pillars[0].score < 75) issues.push("low motor efficiency");
      if (pillars[1].score < 75) issues.push("aquifer drawdown");
      if (pillars[2].score < 75) issues.push("chemical deviation");
      return `System good. Detected ${issues.join(" and ") || "minor variations"}. Monitor performance.`;
    }
  }, [verdictLabel, pillars]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.5)] backdrop-blur-xl border border-white/5 p-3 group shadow-[0_6px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Background Glow */}
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full blur-[80px] bg-blue-500/10 pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-700" />

      {/* ── HEADER ────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-3 relative z-10 border-b border-white/[0.06] pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-blue-400" />
          <h3 className="text-[13px] font-black uppercase tracking-[0.15em] text-blue-400">System Health</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-black text-white leading-none">{overallScore}%</span>
          <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 border rounded-full ${verdictColor} ${verdictBg}`}>
            {verdictLabel}
          </span>
        </div>
      </div>

      {/* ── HEALTH PILLARS (Vertical Bars) ────────────────── */}
      <div className="flex-1 flex flex-row gap-2 relative z-10 min-h-0">
        {pillars.map((pillar, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group/bar">
            {/* Bar Container */}
            <div className="flex-1 w-full max-w-[28px] mx-auto relative rounded-lg bg-slate-950/80 border border-white/[0.08] overflow-hidden group-hover/bar:border-white/20 transition-colors">
              
              {/* Internal Grid/Scale Pattern */}
              <div className="absolute inset-0 opacity-[0.12] bg-[length:100%_4px] bg-[linear-gradient(to_bottom,transparent_3px,rgba(255,255,255,0.5)_3px)] pointer-events-none" />

              {/* Fill Bar (animates from bottom) */}
              <div
                className={`absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t ${getBarGradient(pillar.score)} transition-all duration-1000 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
                style={{
                  height: `${pillar.score}%`,
                  boxShadow: `0 0 20px ${pillar.glowColor}44`,
                }}
              >
                {/* Shimmer / Liquid Flow Effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent -translate-y-full animate-[shimmer_3s_infinite]" />
                
                {/* Laser Cap (The bright top line) */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[1.5px] z-20"
                  style={{ 
                    backgroundColor: pillar.color,
                    boxShadow: `0 0 10px ${pillar.color}, 0 0 20px ${pillar.color}` 
                  }}
                >
                  <div className="absolute top-1/2 left-0 right-0 h-[6px] bg-white/30 -translate-y-1/2 blur-sm" />
                </div>

                {/* Vertical Depth Highlight */}
                <div className="absolute inset-y-0 left-0 w-[35%] bg-gradient-to-r from-white/15 to-transparent pointer-events-none" />
              </div>

              {/* Score overlay */}
              <div className="absolute inset-0 flex items-start justify-center pt-2.5 z-30">
                <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] tabular-nums transition-transform group-hover/bar:scale-110">
                  {pillar.score}
                </span>
              </div>
            </div>

            {/* Label + Icon */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="transition-transform duration-300" style={{ color: pillar.color }}>{pillar.icon}</div>
              <span className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-500 text-center leading-tight group-hover:text-slate-300 transition-colors">
                {pillar.label}
              </span>
              <span
                className="text-[6px] font-black uppercase tracking-wider px-1 py-px rounded-full border transition-all duration-300 group-hover:border-opacity-50"
                style={{
                  color: pillar.color,
                  borderColor: `${pillar.color}22`,
                  backgroundColor: `${pillar.color}08`,
                }}
              >
                {pillar.status}
              </span>
            </div>
          </div>
        ))}

        {/* ── MAINTENANCE ROADMAP (Right Column) ─────────── */}
        <div className="w-[38%] flex flex-col justify-center gap-2 pl-2 border-l border-white/[0.06]">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5">Maintenance</span>
          {maintenance.map((item, i) => {
            const urgencyColor = item.urgency === 'high' ? 'text-red-400' : item.urgency === 'medium' ? 'text-amber-400' : 'text-emerald-400'
            const urgencyBg = item.urgency === 'high' ? 'bg-red-500/5' : item.urgency === 'medium' ? 'bg-amber-500/5' : 'bg-emerald-500/5'
            return (
              <div key={i} className={`flex items-center gap-2 rounded-lg p-1.5 ${urgencyBg} border border-white/[0.03] transition-all hover:border-white/10`}>
                {item.icon}
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-300 leading-tight">{item.label}</span>
                  <span className={`text-[10px] font-mono font-black leading-tight ${urgencyColor}`}>
                    {item.daysLeft !== undefined ? `~${item.daysLeft} days` : item.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── DIAGNOSIS FOOTER ─────────────────────────────── */}
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 relative z-10 border border-white/[0.04]">
        <div className={`flex h-1.5 w-1.5 rounded-full animate-pulse flex-shrink-0 ${verdictLabel === 'OPTIMAL' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <p className="text-[9px] font-medium text-slate-400 leading-tight flex-1">
          <span className="text-white font-bold">{verdictLabel === 'OPTIMAL' ? 'Hydraulic stable.' : 'System good.'}</span> {diagnosticText}
        </p>
        <span className={`text-[9px] font-mono font-bold uppercase flex-shrink-0 ${isOffline ? 'text-amber-400' : 'text-blue-400'}`}>
          {isOffline ? 'Offline' : 'Live'}
        </span>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateY(100%); }
          100% { transform: translateY(-100%); }
        }
      `}</style>
    </div>
  )
}
