"use client"

import { useMemo } from "react"

interface SunriseSunsetTileProps {
  sunrise?: string | null   // e.g. "06:07 AM"
  sunset?: string | null    // e.g. "18:40 PM"
  isLoading?: boolean
}

function parseAMPM(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null
  // Handles "06:07 AM" or "6:07 AM" formats from WeatherAPI
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  let hour = parseInt(match[1])
  const min = parseInt(match[2])
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && hour !== 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  const d = new Date()
  d.setHours(hour, min, 0, 0)
  return d
}

function formatTime(d: Date | null): string {
  if (!d) return "--:--"
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
}

export function SunriseSunsetTile({ sunrise, sunset, isLoading }: SunriseSunsetTileProps) {
  const sunriseDate = parseAMPM(sunrise)
  const sunsetDate  = parseAMPM(sunset)
  const now = new Date()

  // Progress: 0 = sunrise, 1 = sunset
  const progress = useMemo(() => {
    if (!sunriseDate || !sunsetDate) return 0.5
    const totalMs = sunsetDate.getTime() - sunriseDate.getTime()
    const elapsedMs = now.getTime() - sunriseDate.getTime()
    return Math.max(0, Math.min(1, elapsedMs / totalMs))
  }, [sunriseDate, sunsetDate, now])

  // SVG arc parameters
  const W = 220, H = 120
  const cx = W / 2, cy = H + 10
  const r = 100
  // Arc: from left (sunrise) to right (sunset), bottom half hidden
  const startAngle = Math.PI       // 180° = left
  const endAngle   = 0             // 0°   = right
  const sunAngle   = Math.PI - progress * Math.PI // goes left→right
  const sunX = cx + r * Math.cos(sunAngle)
  const sunY = cy + r * Math.sin(sunAngle)

  // SVG arc path
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`

  const daylight = sunriseDate && sunsetDate
    ? Math.round((sunsetDate.getTime() - sunriseDate.getTime()) / 3600000 * 10) / 10
    : null

  const isNight = progress <= 0 || progress >= 1

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Night/day ambient */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000"
        style={{
          background: isNight
            ? "radial-gradient(ellipse at 50% 100%, rgba(79,70,229,0.08) 0%, transparent 70%)"
            : `radial-gradient(ellipse at ${50 + (progress - 0.5) * 60}% 80%, rgba(251,191,36,0.07) 0%, transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🌅</span>
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">
            Sunrise / Sunset
          </h3>
        </div>
        {daylight && (
          <span className="text-[8.5px] font-semibold text-slate-500">
            {daylight}h daylight
          </span>
        )}
      </div>

      {/* SVG Solar Arc */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-1 gap-2 min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[200px] overflow-visible" style={{ filter: "drop-shadow(0 0 4px rgba(251,191,36,0.2))" }}>
          {/* Background arc (dim) */}
          <path
            d={arcPath}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Progress arc (golden) */}
          <path
            d={arcPath}
            fill="none"
            stroke="url(#arcGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${progress * Math.PI * r} ${Math.PI * r}`}
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#f97316" />
              <stop offset="50%"  stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Sunrise dot (left end) */}
          <circle cx={cx - r} cy={cy} r="4" fill="#f97316" opacity="0.7" />

          {/* Sunset dot (right end) */}
          <circle cx={cx + r} cy={cy} r="4" fill="#f97316" opacity="0.7" />

          {/* Current sun position — glowing dot */}
          {!isNight && (
            <>
              <circle cx={sunX} cy={sunY} r="8" fill="rgba(251,191,36,0.15)" />
              <circle cx={sunX} cy={sunY} r="5" fill="#fbbf24" />
              <circle cx={sunX} cy={sunY} r="3" fill="white" opacity="0.9" />
            </>
          )}

          {/* Horizon line */}
          <line x1={cx - r - 8} y1={cy} x2={cx + r + 8} y2={cy} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </svg>

        {/* Sunrise / Sunset labels */}
        <div className="flex w-full justify-between px-2">
          <div className="flex flex-col items-start">
            <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Sunrise</span>
            <span className="text-[18px] font-black text-white leading-tight">{formatTime(sunriseDate)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider">Sunset</span>
            <span className="text-[18px] font-black text-white leading-tight">{formatTime(sunsetDate)}</span>
          </div>
        </div>

        {/* Progress description */}
        <div className="w-full bg-white/[0.03] border border-white/[0.05] rounded-lg px-3 py-1.5 text-center">
          {isNight ? (
            <p className="text-[9px] text-slate-400">🌙 Currently night time</p>
          ) : progress < 0.5 ? (
            <p className="text-[9px] text-slate-400">
              ☀️ {Math.round(progress * 100)}% through the day · {formatTime(sunsetDate)} sunset
            </p>
          ) : (
            <p className="text-[9px] text-slate-400">
              🌇 Sunset in {(() => {
                if (!sunsetDate) return "–"
                const diff = Math.max(0, sunsetDate.getTime() - now.getTime())
                const h = Math.floor(diff / 3600000)
                const m = Math.floor((diff % 3600000) / 60000)
                return h > 0 ? `${h}h ${m}m` : `${m} min`
              })()}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
