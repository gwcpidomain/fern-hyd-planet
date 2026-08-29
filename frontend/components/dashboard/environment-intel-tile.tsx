"use client"

import { useEffect, useState, useCallback } from "react"
import { Activity, Wind, Droplets, Thermometer } from "lucide-react"

interface WeatherData {
  temp_c?: number | null
  humidity?: number | null
  wind_kph?: number | null
  wind_degree?: number | null
  gust_kph?: number | null
  aqi_pm25?: number | null
  aqi_co?: number | null
}

interface WaterData {
  level?: number | null
  ph?: number | null
  tds?: number | null
  turbidity?: number | null
}

interface EnvironmentIntelTileProps {
  weather?: WeatherData | null
  water?: WaterData | null
}

function computeComfortScore(temp?: number | null, humidity?: number | null, pm25?: number | null): number {
  let score = 100
  if (temp != null) {
    if (temp > 38) score -= 30
    else if (temp > 32) score -= 15
    else if (temp > 28) score -= 5
    else if (temp < 10) score -= 20
    else if (temp < 15) score -= 8
  }
  if (humidity != null) {
    if (humidity > 80) score -= 20
    else if (humidity > 65) score -= 8
    else if (humidity < 20) score -= 10
  }
  if (pm25 != null) {
    if (pm25 > 150) score -= 30
    else if (pm25 > 75) score -= 18
    else if (pm25 > 35) score -= 8
  }
  return Math.max(0, Math.min(100, score))
}

function comfortLabel(score: number): { label: string; color: string; ring: string } {
  if (score >= 85) return { label: "Excellent",     color: "text-emerald-400", ring: "stroke-emerald-400" }
  if (score >= 70) return { label: "Comfortable",   color: "text-cyan-400",    ring: "stroke-cyan-400"    }
  if (score >= 50) return { label: "Moderate",      color: "text-amber-400",   ring: "stroke-amber-400"   }
  if (score >= 30) return { label: "Uncomfortable", color: "text-orange-400",  ring: "stroke-orange-400"  }
  return               { label: "Hazardous",      color: "text-red-400",     ring: "stroke-red-500"     }
}

function degToCardinal(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
  return dirs[Math.round(deg / 22.5) % 16]
}

function windScale(kph: number): string {
  if (kph < 1)  return "Calm"
  if (kph < 12) return "Light Breeze"
  if (kph < 29) return "Gentle Breeze"
  if (kph < 50) return "Moderate Wind"
  if (kph < 75) return "Strong Wind"
  return "Gale"
}

function computeGroundwaterScore(level?: number | null, ph?: number | null, tds?: number | null, turbidity?: number | null): number {
  let score = 100
  if (ph != null) {
    const phDist = Math.abs(ph - 7.0)
    if (phDist > 2) score -= 30
    else if (phDist > 1) score -= 15
    else if (phDist > 0.5) score -= 5
  }
  if (tds != null) {
    if (tds > 1000) score -= 35
    else if (tds > 500) score -= 20
    else if (tds > 300) score -= 10
  }
  if (turbidity != null) {
    if (turbidity > 200) score -= 25
    else if (turbidity > 50) score -= 10
    else if (turbidity > 10) score -= 4
  }
  if (level != null && level < 20) score -= 10
  return Math.max(0, Math.min(100, score))
}

function groundwaterLabel(score: number): { label: string; color: string; ring: string } {
  if (score >= 80) return { label: "Healthy",  color: "text-emerald-400", ring: "stroke-emerald-400" }
  if (score >= 60) return { label: "Stable",   color: "text-cyan-400",    ring: "stroke-cyan-400"    }
  if (score >= 40) return { label: "Watch",    color: "text-amber-400",   ring: "stroke-amber-400"   }
  return               { label: "Critical",  color: "text-red-400",     ring: "stroke-red-500"     }
}

function ScoreRing({ score, strokeClass, size = 100 }: { score: number; strokeClass: string; size?: number }) {
  const r = size * 0.38
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.07} />
      <circle cx={cx} cy={cy} r={r} fill="none" className={`${strokeClass} transition-all duration-1000`}
        strokeWidth={size * 0.07} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  )
}

function PanelDots({ active, total, onSelect }: { active: number; total: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <button key={i} onClick={() => onSelect(i)}
          className={`rounded-full transition-all duration-300 ${i === active ? "w-4 h-1.5 bg-cyan-400" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"}`}
          aria-label={`Switch to panel ${i + 1}`} />
      ))}
    </div>
  )
}

export function EnvironmentIntelTile({ weather, water }: EnvironmentIntelTileProps) {
  const [activePanel, setActivePanel] = useState(0)
  const [isManual, setIsManual] = useState(false)
  const TOTAL_PANELS = 3

  const advance = useCallback(() => setActivePanel(p => (p + 1) % TOTAL_PANELS), [])

  useEffect(() => {
    if (isManual) return
    const timer = setInterval(advance, 6000)
    return () => clearInterval(timer)
  }, [isManual, advance])

  const handleDotSelect = (i: number) => {
    setActivePanel(i)
    setIsManual(true)
    setTimeout(() => setIsManual(false), 20000)
  }

  const temp     = weather?.temp_c
  const humidity = weather?.humidity
  const pm25     = weather?.aqi_pm25
  const windKph  = weather?.wind_kph ?? 0
  const windDeg  = weather?.wind_degree ?? 0
  const gustKph  = weather?.gust_kph

  const comfortScore = computeComfortScore(temp, humidity, pm25)
  const comfort      = comfortLabel(comfortScore)
  const gScore       = computeGroundwaterScore(water?.level, water?.ph, water?.tds, water?.turbidity)
  const groundwater  = groundwaterLabel(gScore)

  const PANEL_TITLES = ["Ambient Comfort", "Wind Compass", "Groundwater Health"]
  const PANEL_ICONS  = [Thermometer, Wind, Droplets]
  const PanelIcon    = PANEL_ICONS[activePanel]

  const needleStyle: React.CSSProperties = {
    transform: `rotate(${windDeg}deg)`,
    transition: "transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
  }

  return (
    <div className="dash-tile relative h-full flex flex-col overflow-hidden rounded-2xl bg-[rgba(8,15,38,0.45)] border border-white/[0.11] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]">
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[70px] bg-cyan-500/10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <PanelIcon className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.20em] text-cyan-400">
            {PANEL_TITLES[activePanel]}
          </h3>
        </div>
        <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Env Intel</span>
      </div>

      {/* Panels */}
      <div className="flex-1 relative min-h-0 overflow-hidden">

        {/* Panel 1 — Ambient Comfort */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-3 py-2 transition-all duration-500 ${activePanel === 0 ? "opacity-100 translate-x-0" : activePanel > 0 ? "opacity-0 -translate-x-full" : "opacity-0 translate-x-full"}`} aria-hidden={activePanel !== 0}>
          <div className="relative flex items-center justify-center mb-1">
            <ScoreRing score={comfortScore} strokeClass={comfort.ring} size={90} />
            <div className="absolute flex flex-col items-center">
              <span className={`text-xl font-black leading-none ${comfort.color}`}>{comfortScore}</span>
              <span className="text-[7px] text-slate-500 uppercase tracking-widest">/ 100</span>
            </div>
          </div>
          <div className={`text-[13px] font-black uppercase tracking-wider mb-2 ${comfort.color}`}>{comfort.label}</div>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            {[
              { icon: "🌡️", label: "Temp",    value: temp     != null ? `${temp.toFixed(1)}°C`     : "—" },
              { icon: "💧", label: "Humidity", value: humidity != null ? `${humidity}%`               : "—" },
              { icon: "🌬️", label: "PM2.5",   value: pm25     != null ? `${pm25.toFixed(0)} µg/m³`  : "—" },
              { icon: "☁️", label: "CO₂",     value: weather?.aqi_co != null ? `${weather.aqi_co.toFixed(0)} ppm` : "—" },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2 py-1">
                <span className="text-[10px]">{m.icon}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[7px] text-slate-500 uppercase tracking-wider">{m.label}</span>
                  <span className="text-[10px] font-bold text-white leading-tight truncate">{m.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2 — Wind Compass */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-3 py-2 transition-all duration-500 ${activePanel === 1 ? "opacity-100 translate-x-0" : activePanel < 1 ? "opacity-0 translate-x-full" : "opacity-0 -translate-x-full"}`} aria-hidden={activePanel !== 1}>
          <div className="relative flex items-center justify-center mb-2">
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="38" fill="rgba(8,15,38,0.4)" />
              {["N","E","S","W"].map((dir, i) => {
                const angle = i * 90
                const rad = (angle - 90) * (Math.PI / 180)
                const x = 50 + 42 * Math.cos(rad)
                const y = 50 + 42 * Math.sin(rad)
                return <text key={dir} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill={dir === "N" ? "#22d3ee" : "rgba(148,163,184,0.7)"} fontWeight="700">{dir}</text>
              })}
              {Array.from({ length: 8 }).map((_, i) => {
                const angle = i * 45
                const rad = (angle - 90) * (Math.PI / 180)
                const inner = i % 2 === 0 ? 32 : 35
                return <line key={i} x1={50 + inner * Math.cos(rad)} y1={50 + inner * Math.sin(rad)} x2={50 + 38 * Math.cos(rad)} y2={50 + 38 * Math.sin(rad)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              })}
              <g transform="translate(50,50)" style={needleStyle}>
                <polygon points="0,-28 3,-8 0,-14 -3,-8" fill="#22d3ee" />
                <polygon points="0,28 3,8 0,14 -3,8" fill="rgba(148,163,184,0.4)" />
                <circle r="3.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
              </g>
            </svg>
          </div>
          <div className="flex items-baseline gap-1 mb-0.5">
            <span className="text-2xl font-black text-white tracking-tighter">{windKph.toFixed(0)}</span>
            <span className="text-[9px] text-slate-400 font-semibold">km/h</span>
            <span className="text-[10px] font-black text-cyan-400 ml-1">{degToCardinal(windDeg)}</span>
          </div>
          <div className="text-[9px] text-slate-400 mb-1">{windScale(windKph)}</div>
          {gustKph != null && <div className="text-[8px] text-slate-500">Gusts up to <span className="text-slate-300 font-bold">{gustKph.toFixed(0)} km/h</span></div>}
          <div className="mt-1 text-[8px] text-slate-600">Bearing {windDeg.toFixed(0)}°</div>
        </div>

        {/* Panel 3 — Groundwater Health */}
        <div className={`absolute inset-0 flex flex-col items-center justify-center px-3 py-2 transition-all duration-500 ${activePanel === 2 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full"}`} aria-hidden={activePanel !== 2}>
          <div className="relative flex items-center justify-center mb-1">
            <ScoreRing score={gScore} strokeClass={groundwater.ring} size={90} />
            <div className="absolute flex flex-col items-center">
              <span className={`text-xl font-black leading-none ${groundwater.color}`}>{gScore}</span>
              <span className="text-[7px] text-slate-500 uppercase tracking-widest">/ 100</span>
            </div>
          </div>
          <div className={`text-[13px] font-black uppercase tracking-wider mb-2 ${groundwater.color}`}>{groundwater.label}</div>
          <div className="grid grid-cols-2 gap-1.5 w-full">
            {[
              { label: "Level",     value: water?.level     != null ? `${water.level.toFixed(1)} ft`      : "—", safe: (water?.level ?? 25) >= 20 },
              { label: "pH",        value: water?.ph        != null ? water.ph.toFixed(1)                  : "—", safe: water?.ph != null && water.ph >= 6.5 && water.ph <= 8.5 },
              { label: "TDS",       value: water?.tds       != null ? `${water.tds.toFixed(0)} ppm`       : "—", safe: (water?.tds ?? 0) < 300 },
              { label: "Turbidity", value: water?.turbidity != null ? `${water.turbidity.toFixed(1)} NTU` : "—", safe: (water?.turbidity ?? 0) < 200 },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-1.5 bg-white/[0.04] rounded-lg px-2 py-1">
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${m.safe ? "bg-emerald-400" : "bg-red-400"}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-[7px] text-slate-500 uppercase tracking-wider">{m.label}</span>
                  <span className="text-[10px] font-bold text-white leading-tight truncate">{m.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel dots */}
      <div className="shrink-0 border-t border-white/[0.04]">
        <PanelDots active={activePanel} total={TOTAL_PANELS} onSelect={handleDotSelect} />
      </div>
    </div>
  )
}
