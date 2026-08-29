"use client"

import { useEffect, useState } from "react"
import { Wind, Thermometer, Droplets, Activity } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeatherData {
  temp_c?: number | null
  humidity?: number | null
  wind_kph?: number | null
  wind_degree?: number | null
  gust_kph?: number | null
  aqi_pm25?: number | null
  aqi_co?: number | null
}

interface EnvironmentIntelTileProps {
  weather?: WeatherData | null
  water?: { level?: number | null; ph?: number | null; tds?: number | null; turbidity?: number | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

function comfortMeta(score: number): { label: string; color: string; ring: string; bg: string } {
  if (score >= 85) return { label: "Excellent",     color: "#34d399", ring: "#34d399", bg: "rgba(52,211,153,0.08)"  }
  if (score >= 70) return { label: "Comfortable",   color: "#22d3ee", ring: "#22d3ee", bg: "rgba(34,211,238,0.08)"  }
  if (score >= 50) return { label: "Moderate",      color: "#fbbf24", ring: "#fbbf24", bg: "rgba(251,191,36,0.08)"  }
  if (score >= 30) return { label: "Uncomfortable", color: "#fb923c", ring: "#fb923c", bg: "rgba(251,146,60,0.08)"  }
  return               { label: "Hazardous",      color: "#f87171", ring: "#f87171", bg: "rgba(248,113,113,0.08)" }
}

function degToCardinal(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
  return dirs[Math.round(deg / 22.5) % 16]
}

function windScale(kph: number): string {
  if (kph < 2)  return "Calm"
  if (kph < 12) return "Light Breeze"
  if (kph < 20) return "Gentle Breeze"
  if (kph < 29) return "Moderate Breeze"
  if (kph < 39) return "Fresh Breeze"
  if (kph < 50) return "Strong Breeze"
  if (kph < 62) return "Near Gale"
  return "Gale"
}

const TILE_CLS = `
  dash-tile absolute inset-0 flex flex-col overflow-hidden rounded-2xl
  border border-white/[0.11] bg-[rgba(8,15,38,0.45)]
  text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]
  transition-opacity duration-500
`

// ── Panel Dots ────────────────────────────────────────────────────────────────
function PanelDots({ active, count, onSelect }: { active: number; count: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          aria-label={`Panel ${i + 1}`}
          className={`rounded-full transition-all duration-300 ${i === active ? "w-4 h-1.5 bg-cyan-400" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"}`}
        />
      ))}
    </div>
  )
}

// ── Panel 1: Ambient Comfort ──────────────────────────────────────────────────
function AmbientComfortPanel({ weather }: { weather?: WeatherData | null }) {
  const score  = computeComfortScore(weather?.temp_c, weather?.humidity, weather?.aqi_pm25)
  const meta   = comfortMeta(score)
  const radius = 44
  const circ   = 2 * Math.PI * radius
  const dash   = (score / 100) * circ

  const metrics = [
    { icon: <Thermometer className="h-3 w-3" />, label: "Temp",     value: weather?.temp_c     != null ? `${weather.temp_c.toFixed(1)}°C` : "—" },
    { icon: <Droplets    className="h-3 w-3" />, label: "Humidity", value: weather?.humidity   != null ? `${weather.humidity}%`           : "—" },
    { icon: <Activity    className="h-3 w-3" />, label: "PM2.5",    value: weather?.aqi_pm25   != null ? `${weather.aqi_pm25.toFixed(1)} µg` : "—" },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Ambient Comfort</span>
        </div>
        <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">Index</span>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 items-center gap-4 px-4 py-3">
        {/* Score ring */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 104, height: 104 }}>
          <svg width="104" height="104" className="absolute inset-0 -rotate-90" viewBox="0 0 104 104">
            <circle cx="52" cy="52" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="52" cy="52" r={radius} fill="none"
              stroke={meta.ring} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${meta.ring}88)` }}
            />
          </svg>
          <div className="relative flex flex-col items-center">
            <span className="text-[32px] font-black leading-none text-white">{score}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: meta.color }}>{meta.label}</span>
          </div>
        </div>

        {/* Metrics column */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {metrics.map(m => (
            <div key={m.label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                {m.icon}
                <span className="text-[9px] font-semibold uppercase tracking-wider">{m.label}</span>
              </div>
              <span className="text-[12px] font-black text-white">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Panel 2: Wind Compass ─────────────────────────────────────────────────────
function WindCompassPanel({ weather }: { weather?: WeatherData | null }) {
  const deg     = weather?.wind_degree ?? 0
  const kph     = weather?.wind_kph   ?? 0
  const gust    = weather?.gust_kph
  const dir     = degToCardinal(deg)
  const scale   = windScale(kph)
  const maxKph  = 80
  const pct     = Math.min(kph / maxKph, 1)

  // Compass arrow points from center toward wind direction
  const arrowRad = ((deg - 90) * Math.PI) / 180
  const cx = 52; const cy = 52; const r = 36
  const ax = cx + r * Math.cos(arrowRad)
  const ay = cy + r * Math.sin(arrowRad)

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">Wind Compass</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Live
        </span>
      </div>

      {/* Body: compass left, details right */}
      <div className="flex flex-1 min-h-0 items-center gap-2 px-3 py-2">

        {/* Compass SVG — left 45% */}
        <div className="flex items-center justify-center shrink-0" style={{ width: "45%" }}>
          <svg viewBox="0 0 104 104" width="100" height="100">
            {/* Outer ring */}
            <circle cx="52" cy="52" r="48" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
            {/* Tick marks */}
            {Array.from({ length: 16 }).map((_, i) => {
              const a = (i * 360 / 16 - 90) * Math.PI / 180
              const isMajor = i % 4 === 0
              const r1 = isMajor ? 38 : 41
              const r2 = 46
              return (
                <line key={i}
                  x1={52 + r1 * Math.cos(a)} y1={52 + r1 * Math.sin(a)}
                  x2={52 + r2 * Math.cos(a)} y2={52 + r2 * Math.sin(a)}
                  stroke={isMajor ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isMajor ? 1.5 : 0.8}
                />
              )
            })}
            {/* N E S W labels */}
            {[["N",52,10],["E",94,55],["S",52,98],["W",10,55]].map(([lbl, lx, ly]) => (
              <text key={lbl as string} x={lx as number} y={ly as number} textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontWeight="700" fill={lbl === "N" ? "#22d3ee" : "rgba(255,255,255,0.45)"} letterSpacing="0.05em">
                {lbl}
              </text>
            ))}
            {/* Centre dot */}
            <circle cx="52" cy="52" r="3" fill="rgba(255,255,255,0.15)" />
            {/* Wind direction arrow with cyan glow */}
            <line
              x1="52" y1="52"
              x2={ax} y2={ay}
              stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 4px #22d3ee)" }}
            />
            <circle cx={ax} cy={ay} r="3.5" fill="#22d3ee" style={{ filter: "drop-shadow(0 0 6px #22d3ee)" }} />
          </svg>
        </div>

        {/* Details — right 55% */}
        <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
          {/* Primary: speed + direction */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-black leading-none text-white">{Math.round(kph)}</span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-400">km/h</span>
              <span className="text-[14px] font-bold leading-none" style={{ color: "#22d3ee" }}>{dir}</span>
            </div>
          </div>

          {/* Scale label */}
          <span className="text-[12px] font-medium text-slate-300 leading-tight">{scale}</span>

          {/* Speed scale bar */}
          <div className="relative mt-0.5">
            <div className="h-[3px] w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct * 100}%`, background: "linear-gradient(to right, #22d3ee, #818cf8)" }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-slate-600">0</span>
              <span className="text-[7px] text-slate-600">{maxKph} km/h</span>
            </div>
          </div>

          {/* Supporting info */}
          <div className="flex flex-col gap-0.5 mt-0.5">
            {gust != null && (
              <span className="text-[10px] text-slate-400">Gusts up to <span className="text-white font-semibold">{Math.round(gust)} km/h</span></span>
            )}
            <span className="text-[10px] text-slate-500">Bearing {deg}°</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function EnvironmentIntelTile({ weather, water }: EnvironmentIntelTileProps) {
  const [activePanel, setActivePanel] = useState(0)
  const [isManual,    setIsManual]    = useState(false)
  const PANEL_COUNT = 2

  useEffect(() => {
    if (isManual) return
    const t = setInterval(() => setActivePanel(p => (p + 1) % PANEL_COUNT), 8000)
    return () => clearInterval(t)
  }, [isManual])

  const handleSelect = (i: number) => {
    setActivePanel(i)
    setIsManual(true)
    setTimeout(() => setIsManual(false), 20_000)
  }

  const panelActive = (i: number) => i === activePanel ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none z-0"

  return (
    <div className="relative h-full">
      {/* Panel 1 — Ambient Comfort */}
      <div className={`${TILE_CLS} ${panelActive(0)}`}>
        <AmbientComfortPanel weather={weather} />
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.04] px-3 py-1">
          <span className="text-[8px] text-slate-500 font-semibold">Comfort Index</span>
          <PanelDots active={activePanel} count={PANEL_COUNT} onSelect={handleSelect} />
        </div>
      </div>

      {/* Panel 2 — Wind Compass */}
      <div className={`${TILE_CLS} ${panelActive(1)}`}>
        <WindCompassPanel weather={weather} />
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.04] px-3 py-1">
          <span className="text-[8px] text-slate-500 font-semibold">Live wind data</span>
          <PanelDots active={activePanel} count={PANEL_COUNT} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  )
}
