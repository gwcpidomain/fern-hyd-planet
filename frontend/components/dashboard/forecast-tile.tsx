"use client"

import React from "react"
import { Cloud, CloudRain, Sun, Activity } from "lucide-react"

interface ForecastDay {
  date: string
  max_c: number
  min_c: number
  condition: string
  icon: string
  rain_chance: number
}

interface ForecastTileProps {
  forecast?: ForecastDay[]
  isLoading?: boolean
}

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today"
  if (index === 1) return "Tomorrow"
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-IN", { weekday: "short" })
}

function getConditionEmoji(condition: string): { icon: React.ReactElement; color: string } {
  const c = condition.toLowerCase()
  if (c.includes("thunder") || c.includes("storm"))
    return { icon: <Activity className="h-5 w-5" />, color: "#fbbf24" }
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower"))
    return { icon: <CloudRain className="h-5 w-5" />, color: "#60a5fa" }
  if (c.includes("cloud") || c.includes("overcast"))
    return { icon: <Cloud className="h-5 w-5" />, color: "#94a3b8" }
  return { icon: <Sun className="h-5 w-5" />, color: "#fbbf24" }
}

// Min temp of all days for relative bar calculation
function getTempRange(forecast: ForecastDay[]) {
  const allMin = Math.min(...forecast.map(d => d.min_c))
  const allMax = Math.max(...forecast.map(d => d.max_c))
  return { allMin, allMax, range: allMax - allMin || 1 }
}

export function ForecastTile({ forecast, isLoading }: ForecastTileProps) {
  if (isLoading || !forecast || forecast.length === 0) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 border-b border-white/[0.06]">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">3-Day Forecast</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-slate-500">Forecast data loading…</span>
        </div>
      </div>
    )
  }

  const { allMin, allMax, range } = getTempRange(forecast)

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Ambient glow */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[50px] bg-amber-500/10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">3-Day Forecast</h3>
        </div>
        <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">WeatherAPI</span>
      </div>

      {/* Forecast rows */}
      <div className="flex-1 flex flex-col justify-around px-3 py-2 gap-1.5">
        {forecast.slice(0, 3).map((day, i) => {
          const { icon, color } = getConditionEmoji(day.condition)
          // Temperature range bar position
          const barLeft = ((day.min_c - allMin) / range) * 100
          const barWidth = ((day.max_c - day.min_c) / range) * 100

          return (
            <div key={i} className="flex items-center gap-3 group">
              {/* Day label */}
              <span className="text-[12px] font-bold text-white w-16 shrink-0">{getDayLabel(day.date, i)}</span>

              {/* Condition icon + rain chance */}
              <div className="flex items-center gap-1 w-14 shrink-0">
                <span style={{ color }}>{icon}</span>
                {day.rain_chance > 10 && (
                  <span className="text-[9px] font-bold text-blue-400">{day.rain_chance}%</span>
                )}
              </div>

              {/* Temperature range bar (iPhone style) */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold w-7 text-right shrink-0">
                  {day.min_c}°
                </span>
                <div className="flex-1 relative h-[5px] bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full transition-all duration-700"
                    style={{
                      left: `${barLeft}%`,
                      width: `${Math.max(barWidth, 8)}%`,
                      background: `linear-gradient(to right, #60a5fa, #fbbf24, #f97316)`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-white font-bold w-7 shrink-0">
                  {day.max_c}°
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom label */}
      <div className="px-3 pb-2 shrink-0">
        <p className="text-[8px] text-slate-500 text-center uppercase tracking-wider">
          {forecast[0]?.condition}
        </p>
      </div>
    </div>
  )
}
