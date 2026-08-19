"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { CloudRain, Eye, Gauge, Moon, Sun, Sunrise, Wind } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface SunriseSunsetTileProps {
  sunrise?: string | null
  sunset?: string | null
  uv?: number
  precip_mm?: number
  vis_km?: number
  humidity?: number
  wind_kph?: number
  pressure_mb?: number
}

function parseAMPM(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const ampm = match[3].toUpperCase()
  if (ampm === "PM" && hour !== 12) hour += 12
  if (ampm === "AM" && hour === 12) hour = 0
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date
}

function formatTime(date: Date | null): string {
  if (!date) return "--:--"
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function getUVLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: "Low", color: "#22c55e" }
  if (uv <= 5) return { label: "Moderate", color: "#eab308" }
  if (uv <= 7) return { label: "High", color: "#f97316" }
  if (uv <= 10) return { label: "Very High", color: "#ef4444" }
  return { label: "Extreme", color: "#a855f7" }
}

function cubicBezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): [number, number] {
  const mt = 1 - t
  const x = mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0]
  const y = mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1]
  return [x, y]
}

export function SunriseSunsetTile({
  sunrise, sunset, uv, precip_mm, vis_km, humidity, wind_kph, pressure_mb,
}: SunriseSunsetTileProps) {
  const [nowEpoch, setNowEpoch] = useState<number | null>(null)
  const [activeSet, setActiveSet] = useState(0)  // 0 = Set A, 1 = Set B
  const [visible, setVisible] = useState(true)   // opacity for fade transition
  const uniqueId = useId().replace(/:/g, "")

  useEffect(() => {
    const updateClock = () => setNowEpoch(Date.now())
    updateClock()
    const timer = window.setInterval(updateClock, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // 5-second carousel with 280ms opacity fade
  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false)
      window.setTimeout(() => {
        setActiveSet((prev) => (prev === 0 ? 1 : 0))
        setVisible(true)
      }, 280)
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  const sunriseDate = useMemo(() => parseAMPM(sunrise), [sunrise])
  const sunsetDate  = useMemo(() => parseAMPM(sunset),  [sunset])
  const now = nowEpoch === null ? null : new Date(nowEpoch)
  const hasSunTimes = Boolean(sunriseDate && sunsetDate && sunsetDate > sunriseDate)

  // Sun progress: 0 at sunrise → 1 at sunset
  const sunProgress = useMemo(() => {
    if (!hasSunTimes || !now || !sunriseDate || !sunsetDate) return 0
    const totalMs   = sunsetDate.getTime() - sunriseDate.getTime()
    const elapsedMs = now.getTime()        - sunriseDate.getTime()
    return Math.max(0, Math.min(1, elapsedMs / totalMs))
  }, [hasSunTimes, now, sunriseDate, sunsetDate])

  const isNight = !hasSunTimes || now === null || sunProgress <= 0 || sunProgress >= 1

  // Night progress: 0 at sunset → 1 at next sunrise (moon travels left→right)
  const nightProgress = useMemo(() => {
    if (!hasSunTimes || !now || !sunriseDate || !sunsetDate) return 0
    const nowMs = now.getTime()
    // After sunset today
    if (nowMs >= sunsetDate.getTime()) {
      const tomorrowSunriseMs = sunriseDate.getTime() + 24 * 60 * 60 * 1000
      const totalNight = tomorrowSunriseMs - sunsetDate.getTime()
      return Math.max(0, Math.min(1, (nowMs - sunsetDate.getTime()) / totalNight))
    }
    // Before sunrise today (pre-dawn)
    if (nowMs < sunriseDate.getTime()) {
      const yesterdaySunsetMs = sunsetDate.getTime() - 24 * 60 * 60 * 1000
      const totalNight = sunriseDate.getTime() - yesterdaySunsetMs
      return Math.max(0, Math.min(1, (nowMs - yesterdaySunsetMs) / totalNight))
    }
    return 0
  }, [hasSunTimes, now, sunriseDate, sunsetDate])

  const activeProgress = isNight ? nightProgress : sunProgress

  const daylightStr = hasSunTimes && sunriseDate && sunsetDate
    ? (() => {
        const totalMinutes = Math.round((sunsetDate.getTime() - sunriseDate.getTime()) / 60_000)
        return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
      })()
    : null

  const W = 280; const H = 110; const padX = 18; const baseY = H - 18
  const P0: [number, number] = [padX,     baseY]
  const P1: [number, number] = [42,       14]
  const P2: [number, number] = [W - 42,   14]
  const P3: [number, number] = [W - padX, baseY]
  const arcPath = `M ${P0[0]} ${P0[1]} C ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]}`
  const [markerX, markerY] = cubicBezierPoint(activeProgress, P0, P1, P2, P3)
  const clipWidth      = P0[0] + (P3[0] - P0[0]) * activeProgress
  const uvInfo         = getUVLabel(uv ?? 0)
  const progressClipId = `arc-progress-${uniqueId}`
  const sunGradientId  = `sun-gradient-${uniqueId}`
  const moonGradientId = `moon-gradient-${uniqueId}`

  // Set A â€” Humidity Â· Wind Speed Â· Pressure
  const setA = [
    {
      icon:  <svg className="h-[18px] w-[18px] text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M12 2c0 0-6 6.5-6 11a6 6 0 0 0 12 0C18 8.5 12 2 12 2z"/></svg>,
      value: humidity !== undefined ? `${humidity}%`              : "â€“",
      label: "Humidity",
    },
    {
      icon:  <Wind  className="h-[18px] w-[18px] text-slate-300" aria-hidden="true" />,
      value: wind_kph !== undefined ? `${wind_kph} km/h`          : "â€“",
      label: "Wind",
    },
    {
      icon:  <Gauge className="h-[18px] w-[18px] text-violet-400" aria-hidden="true" />,
      value: pressure_mb !== undefined ? `${Math.round(pressure_mb)} mb` : "â€“",
      label: "Pressure",
    },
  ]

  // Set B â€” UV Index Â· Rain Today Â· Visibility
  const setB = [
    {
      icon:  <Sun      className="h-[18px] w-[18px]"                 style={{ color: uvInfo.color }} aria-hidden="true" />,
      value: uv        !== undefined ? `${uv}`                        : "â€“",
      label: uvInfo.label,
    },
    {
      icon:  <CloudRain className="h-[18px] w-[18px] text-blue-400"  aria-hidden="true" />,
      value: precip_mm !== undefined ? `${precip_mm.toFixed(1)} mm`  : "â€“",
      label: "Rain",
    },
    {
      icon:  <Eye      className="h-[18px] w-[18px] text-slate-300"  aria-hidden="true" />,
      value: vis_km    !== undefined ? `${Math.round(vis_km)} km`    : "â€“",
      label: "Visibility",
    },
  ]

  const metrics = activeSet === 0 ? setA : setB

  return (
    <Card className="relative h-full min-h-0 gap-0 overflow-hidden rounded-xl border-white/[0.11] bg-[rgba(8,15,38,0.45)] p-0 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-xl">
      <div
        className="pointer-events-none absolute inset-0 transition-all duration-[2000ms]"
        style={{
          background: isNight
            ? `radial-gradient(ellipse at ${14 + activeProgress * 72}% 60%, rgba(79,70,229,0.13) 0%, transparent 65%)`
            : `radial-gradient(ellipse at ${14 + activeProgress * 72}% 30%, rgba(251,191,36,0.08) 0%, transparent 60%)`,
        }}
      />

      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sunrise className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
          <h3 className="truncate text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">
            Sunrise / Sunset
          </h3>
        </div>
        {daylightStr && (
          <span className="shrink-0 text-[8.5px] font-semibold text-slate-500">
            {daylightStr} daylight
          </span>
        )}
      </div>
      <Separator className="bg-white/[0.06]" />

      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
        {/* Ï€-arc SVG */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full max-h-[112px] overflow-visible"
            role="img"
            aria-label={`Sunrise ${formatTime(sunriseDate)}, sunset ${formatTime(sunsetDate)}`}
          >
            <defs>
              <clipPath id={progressClipId}>
                <rect x="0" y="-20" width={clipWidth} height={H + 40} />
              </clipPath>
              {/* Sun path: orange → amber */}
              <linearGradient id={sunGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#f97316" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              {/* Moon path: sky-blue → indigo */}
              <linearGradient id={moonGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>

            {/* Horizon dashed baseline */}
            <line x1={P0[0]-8} y1={baseY} x2={P3[0]+8} y2={baseY}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3 6" />
            {/* Dim full arc */}
            <path d={arcPath} fill="none" stroke="rgba(255,255,255,0.12)"
              strokeWidth="1.8" strokeLinecap="round" />
            {/* Active lit trail — sun is warm, moon is cool */}
            <path d={arcPath} fill="none"
              stroke={isNight ? `url(#${moonGradientId})` : `url(#${sunGradientId})`}
              strokeWidth="2.2" strokeLinecap="round"
              clipPath={`url(#${progressClipId})`} />

            {/* Horizon endpoint dots */}
            <circle cx={P0[0]} cy={P0[1]} r="3" fill="#f97316" opacity="0.75" />
            <circle cx={P3[0]} cy={P3[1]} r="3" fill="#f97316" opacity="0.55" />

            {/* Marker — glowing sun during day, moving moon at night */}
            {!isNight ? (
              <>
                <circle cx={markerX} cy={markerY} r="11" fill="rgba(251,191,36,0.08)" />
                <circle cx={markerX} cy={markerY} r="6.5" fill="rgba(251,191,36,0.20)" />
                <circle cx={markerX} cy={markerY} r="3.8" fill="#fbbf24" />
                <circle cx={markerX} cy={markerY} r="2"   fill="white" opacity="0.9" />
              </>
            ) : (
              <>
                {/* Soft lunar glow halo */}
                <circle cx={markerX} cy={markerY} r="13" fill="rgba(56,189,248,0.07)" />
                <circle cx={markerX} cy={markerY} r="7"  fill="rgba(56,189,248,0.13)" />
                {/* Moon icon riding the arc */}
                <Moon x={markerX-9} y={markerY-9} width={18} height={18}
                  strokeWidth={1.6} color="#7dd3fc" aria-hidden="true" />
              </>
            )}
          </svg>
        </div>

        {/* Sunrise / Sunset times */}
        <div className="flex shrink-0 items-end justify-between px-0.5">
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sunrise</span>
            <span className="mt-0.5 text-[16px] font-black leading-none text-white">{formatTime(sunriseDate)}</span>
          </div>
          <div className="pb-0.5 text-[9px] font-bold text-amber-400/60">
            {hasSunTimes && !isNight ? `${Math.round(sunProgress * 100)}% daylight` : ""}
          </div>
          <div className="flex min-w-0 flex-col items-end">
            <span className="text-[7px] font-semibold uppercase tracking-[0.18em] text-slate-500">Sunset</span>
            <span className="mt-0.5 text-[16px] font-black leading-none text-white">{formatTime(sunsetDate)}</span>
          </div>
        </div>

        <Separator className="bg-white/[0.05]" />

        {/* Metric carousel â€” no dots, pure opacity fade */}
        <div
          className="grid shrink-0 grid-cols-3 items-center gap-2 py-0.5 transition-opacity duration-[280ms]"
          style={{ opacity: visible ? 1 : 0 }}
          aria-live="polite"
          aria-atomic="true"
        >
          {metrics.map((metric) => (
            <div key={metric.label} className="flex min-w-0 flex-col items-center gap-0.5">
              {metric.icon}
              <span className="max-w-full truncate text-[12px] font-black leading-tight text-white">
                {metric.value}
              </span>
              <span className="max-w-full truncate text-[8px] uppercase tracking-wide text-slate-500">
                {metric.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

