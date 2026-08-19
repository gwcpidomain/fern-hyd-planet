"use client"

import React from "react"
import { Sun, Droplets } from "lucide-react"

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

function formatDate(dateStr: string, index: number): string {
  if (index === 0) {
    return "Today"
  }
  const date = new Date(dateStr)
  const day = date.getDate()
  const month = date.toLocaleDateString("en-IN", { month: "short" })
  const weekday = date.toLocaleDateString("en-IN", { weekday: "short" })
  return `${day} ${month}, ${weekday}`
}

function getIconUrl(icon: string): string {
  if (!icon) return ""
  // WeatherAPI returns "//cdn.weatherapi.com/..." — prepend https:
  if (icon.startsWith("//")) return `https:${icon}`
  if (icon.startsWith("http")) return icon
  return `https:${icon}`
}

export function ForecastTile({ forecast, isLoading }: ForecastTileProps) {
  const days = forecast?.slice(0, 3) ?? []

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Ambient glow */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[50px] bg-amber-500/10 pointer-events-none" />

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 text-amber-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">
            3-Day Forecast
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <span className="px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/25 text-[8.5px] font-bold text-amber-400 tracking-wide">
            3 days
          </span>
        </div>
      </div>

      {/* ── Forecast rows ────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-2.5 py-2 gap-1.5">

        {/* Loading state */}
        {(isLoading || days.length === 0) && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-slate-500 tracking-wider">Forecast loading…</span>
          </div>
        )}

        {/* Data rows */}
        {days.map((day, i) => (
          <div
            key={i}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
          >
            {/* Condition icon from WeatherAPI CDN */}
            <div className="shrink-0 w-9 h-9 flex items-center justify-center">
              {day.icon ? (
                <img
                  src={getIconUrl(day.icon)}
                  alt={day.condition}
                  className="w-9 h-9 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]"
                  loading="lazy"
                />
              ) : (
                <Sun className="h-7 w-7 text-amber-400/50" />
              )}
            </div>

            {/* Temperatures */}
            <div className="flex items-baseline gap-1.5 shrink-0">
              <span className="text-[20px] font-black text-white leading-none">
                {day.max_c}°
              </span>
              <span className="text-[12px] font-semibold text-slate-500 leading-none">
                /{day.min_c}°
              </span>
            </div>

            {/* Rain chance — only if > 10% */}
            {day.rain_chance > 10 && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Droplets className="h-3 w-3 text-blue-400" />
                <span className="text-[9px] font-bold text-blue-400">{day.rain_chance}%</span>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date on the right */}
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[11px] font-bold text-slate-300 leading-tight whitespace-nowrap">
                {formatDate(day.date, i)}
              </span>
              {i === 0 && (
                <span className="text-[8px] text-amber-400/60 font-semibold tracking-wide uppercase">
                  {day.condition}
                </span>
              )}
            </div>
          </div>
        ))}

      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div className="flex items-center justify-end px-3 pb-2 shrink-0">
        <span className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider">WeatherAPI</span>
      </div>
    </div>
  )
}
