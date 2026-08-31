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
  const deg    = weather?.wind_degree ?? 0
  const kph    = weather?.wind_kph   ?? 0
  const gust   = weather?.gust_kph
  const dir    = degToCardinal(deg)
  const scale  = windScale(kph)

  // Segmented speed zones: Calm(0-12) Breeze(12-29) Moderate(29-50) Strong(50+) out of 60 max
  const maxKph = 60
  const pct    = Math.min(kph / maxKph, 1)
  const segments = [
    { label: "CALM",     end: 12  / maxKph, color: "#34d399" },
    { label: "LIGHT",    end: 29  / maxKph, color: "#22d3ee" },
    { label: "MODERATE", end: 50  / maxKph, color: "#f59e0b" },
    { label: "STRONG",   end: 1,            color: "#f87171" },
  ]

  // Compass: smooth needle via SVG rotate transform
  const CX = 60; const CY = 60; const R_OUTER = 54; const R_INNER = 50
  const NEEDLE_LEN = 40

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
      <div className="flex flex-1 min-h-0 items-center gap-1 px-2 py-2">

        {/* ── Compass SVG — 120×120 viewBox, ~45% width ── */}
        <div className="flex items-center justify-center shrink-0" style={{ width: "46%" }}>
          <svg viewBox="0 0 120 120" style={{ width: "100%", maxWidth: 118, height: "auto" }}>
            {/* Outer decorative ring */}
            <circle cx={CX} cy={CY} r={R_OUTER} fill="rgba(8,15,38,0.55)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2" />
            {/* Inner ring */}
            <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* 32 radial tick marks */}
            {Array.from({ length: 32 }).map((_, i) => {
              const angle   = (i * 360 / 32 - 90) * Math.PI / 180
              const isMajor = i % 8 === 0   // N E S W
              const isMid   = i % 4 === 0   // intercardinals
              const rOut    = R_OUTER - 1
              const rIn     = isMajor ? rOut - 9 : isMid ? rOut - 6 : rOut - 3.5
              return (
                <line key={i}
                  x1={CX + rIn  * Math.cos(angle)} y1={CY + rIn  * Math.sin(angle)}
                  x2={CX + rOut * Math.cos(angle)} y2={CY + rOut * Math.sin(angle)}
                  stroke={isMajor ? "rgba(255,255,255,0.35)" : isMid ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}
                  strokeWidth={isMajor ? 1.5 : isMid ? 1 : 0.6}
                />
              )
            })}

            {/* N E S W cardinal labels */}
            {([ ["N", CX, CY - R_OUTER + 13], ["E", CX + R_OUTER - 13, CY],
                ["S", CX, CY + R_OUTER - 13], ["W", CX - R_OUTER + 13, CY] ] as [string,number,number][])
              .map(([lbl, lx, ly]) => (
              <text key={lbl} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize="9.5" fontWeight="800" letterSpacing="0.08em"
                fill={lbl === "N" ? "#22d3ee" : "rgba(255,255,255,0.5)"}>
                {lbl}
              </text>
            ))}

            {/* Glowing center dot */}
            <circle cx={CX} cy={CY} r="3.5" fill="rgba(34,211,238,0.25)" stroke="#22d3ee" strokeWidth="1" />

            {/* ── Needle: rotates smoothly via CSS transition on the group ── */}
            <g
              transform={`rotate(${deg}, ${CX}, ${CY})`}
              style={{ transition: "transform 0.9s cubic-bezier(0.4,0,0.2,1)" }}
            >
              {/* Needle shaft — points toward deg (up = 0°, right = 90°) */}
              <line
                x1={CX} y1={CY}
                x2={CX} y2={CY - NEEDLE_LEN}
                stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 5px #22d3ee)" }}
              />
              {/* Arrowhead */}
              <polygon
                points={`${CX},${CY - NEEDLE_LEN - 2} ${CX - 4},${CY - NEEDLE_LEN + 6} ${CX + 4},${CY - NEEDLE_LEN + 6}`}
                fill="#22d3ee"
                style={{ filter: "drop-shadow(0 0 6px #22d3ee)" }}
              />
              {/* Tail (opposite direction, grey) */}
              <line
                x1={CX} y1={CY}
                x2={CX} y2={CY + 16}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round"
              />
            </g>
          </svg>
        </div>

        {/* ── Details — right 54% ── */}
        <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0 pl-1">

          {/* Hero: wind speed + direction on one line */}
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className="text-[38px] font-black leading-none tracking-tight text-white">{Math.round(kph)}</span>
            <span className="text-[11px] font-semibold text-slate-400 leading-none">km/h</span>
            <span className="text-[18px] font-black leading-none" style={{ color: "#22d3ee" }}>{dir}</span>
          </div>

          {/* Wind scale label */}
          <span className="text-[11px] font-medium text-slate-300 leading-none">{scale}</span>

          {/* Segmented speed bar with dot marker */}
          <div className="mt-0.5">
            {/* Zone labels */}
            <div className="flex mb-0.5">
              {segments.map((s, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[6px] font-bold uppercase tracking-wide" style={{ color: kph <= (s.end * maxKph) && (i === 0 || kph > (segments[i-1]?.end ?? 0) * maxKph) ? s.color : "rgba(255,255,255,0.2)" }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
            {/* Segmented track */}
            <div className="relative h-[4px] w-full flex gap-[2px] rounded-sm overflow-visible">
              {segments.map((s, i) => {
                const segStart = i === 0 ? 0 : segments[i-1].end
                const segWidth = s.end - segStart
                const fillPct  = Math.max(0, Math.min(1, (pct - segStart) / segWidth))
                return (
                  <div key={i} className="relative rounded-sm overflow-hidden" style={{ flex: segWidth }}>
                    <div className="absolute inset-0 rounded-sm" style={{ background: "rgba(255,255,255,0.07)" }} />
                    <div className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
                      style={{ width: `${fillPct * 100}%`, background: s.color, opacity: 0.75 }} />
                  </div>
                )
              })}
              {/* Dot marker at current speed position */}
              <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white bg-white shadow-[0_0_5px_rgba(255,255,255,0.8)] transition-all duration-700 z-10"
                style={{ left: `calc(${pct * 100}% - 5px)` }} />
            </div>
            {/* Min/max labels */}
            <div className="flex justify-between mt-0.5">
              <span className="text-[7px] text-slate-600">0</span>
              <span className="text-[7px] text-slate-600">{maxKph}+ km/h</span>
            </div>
          </div>

          {/* Secondary metrics — horizontal 2-column */}
          <div className="flex gap-3 mt-0.5">
            {gust != null && (
              <div className="flex flex-col min-w-0">
                <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-slate-600">Wind Gusts</span>
                <span className="text-[12px] font-black text-white leading-none">{Math.round(gust)} <span className="text-[8px] font-medium text-slate-500">km/h</span></span>
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[7px] font-bold uppercase tracking-[0.12em] text-slate-600">Direction</span>
              <span className="text-[12px] font-black text-white leading-none">{dir} <span className="text-[9px] font-medium text-slate-400">· {deg}°</span></span>
            </div>
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
          <span className="text-[8px] text-slate-500 font-semibold">Updated from weather API</span>
          <PanelDots active={activePanel} count={PANEL_COUNT} onSelect={handleSelect} />
        </div>
      </div>
    </div>
  )
}
