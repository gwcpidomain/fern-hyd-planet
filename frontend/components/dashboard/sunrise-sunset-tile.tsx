"use client"

import { useMemo, useState, useEffect } from "react"
import { Droplets, Wind, Gauge, Eye, CloudRain, Sun } from "lucide-react"

interface SunriseSunsetTileProps {
  sunrise?: string | null
  sunset?: string | null
  isLoading?: boolean
  // Weather metrics migrated from Surrounding Conditions
  wind_kph?: number
  wind_dir?: string
  humidity?: number
  uv?: number
  precip_mm?: number
  vis_km?: number
  pressure_mb?: number
}

function parseAMPM(timeStr: string | null | undefined): Date | null {
  if (!timeStr) return null
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

function getUVLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: "Low", color: "#22c55e" }
  if (uv <= 5) return { label: "Moderate", color: "#eab308" }
  if (uv <= 7) return { label: "High", color: "#f97316" }
  if (uv <= 10) return { label: "Very High", color: "#ef4444" }
  return { label: "Extreme", color: "#a855f7" }
}

// Cubic Bezier interpolation for the sun position along the π-curve
function cubicBezierPoint(
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): [number, number] {
  const mt = 1 - t
  const x = mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0]
  const y = mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1]
  return [x, y]
}

export function SunriseSunsetTile({
  sunrise, sunset,
  wind_kph, wind_dir, humidity, uv, precip_mm, vis_km, pressure_mb
}: SunriseSunsetTileProps) {
  const sunriseDate = parseAMPM(sunrise)
  const sunsetDate  = parseAMPM(sunset)
  const now = new Date()

  // Auto-rotating metric set with fade
  const [activeSet, setActiveSet] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setActiveSet(prev => 1 - prev)
        setVisible(true)
      }, 280)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // 0 = sunrise, 1 = sunset
  const progress = useMemo(() => {
    if (!sunriseDate || !sunsetDate) return 0.5
    const totalMs = sunsetDate.getTime() - sunriseDate.getTime()
    const elapsedMs = now.getTime() - sunriseDate.getTime()
    return Math.max(0, Math.min(1, elapsedMs / totalMs))
  }, [sunriseDate, sunsetDate])

  const isNight = !sunriseDate || !sunsetDate || progress <= 0 || progress >= 1

  // ── SVG π-curve geometry ──────────────────────────────────────────────────
  // Coordinate system: viewBox 0 0 280 100
  const W = 280, H = 100
  const padX = 16
  const baseY = H - 8   // horizon level

  // The four cubic Bezier points:
  // P0 (sunrise) and P3 (sunset) sit on the horizon.
  // P1 and P2 are directly above their respective endpoints → creates near-vertical sides (π shape)
  const P0: [number, number] = [padX, baseY]
  const P3: [number, number] = [W - padX, baseY]
  const P1: [number, number] = [padX, 6]        // directly above P0 → vertical left side
  const P2: [number, number] = [W - padX, 6]    // directly above P3 → vertical right side

  const arcPath = `M ${P0[0]} ${P0[1]} C ${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]} ${P3[0]} ${P3[1]}`

  // Sun dot at current time position
  const [sunX, sunY] = cubicBezierPoint(progress, P0, P1, P2, P3)

  // Clip width for colored progress arc (proportional to progress)
  const clipW = P0[0] + (P3[0] - P0[0]) * progress

  // Daylight duration string
  const daylightStr = sunriseDate && sunsetDate
    ? (() => {
        const ms = sunsetDate.getTime() - sunriseDate.getTime()
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return `${h}h ${m}m`
      })()
    : null

  const uvInfo = getUVLabel(uv ?? 0)

  // Two metric sets (borderless, no boxes)
  const metricSets = [
    [
      {
        icon: <Droplets className="h-[18px] w-[18px] text-blue-400" />,
        value: humidity !== undefined ? `${humidity}%` : "–",
        label: "Humidity",
      },
      {
        icon: <Wind className="h-[18px] w-[18px] text-cyan-400" />,
        value: wind_kph !== undefined ? `${Math.round(wind_kph)} km/h` : "–",
        label: wind_dir ?? "Wind",
      },
      {
        icon: <Gauge className="h-[18px] w-[18px] text-purple-400" />,
        value: pressure_mb !== undefined ? `${Math.round(pressure_mb)}` : "–",
        label: "mb",
      },
    ],
    [
      {
        icon: <Sun className="h-[18px] w-[18px]" style={{ color: uvInfo.color }} />,
        value: uv !== undefined ? `${uv}` : "–",
        label: uvInfo.label,
      },
      {
        icon: <CloudRain className="h-[18px] w-[18px] text-indigo-400" />,
        value: precip_mm !== undefined ? `${precip_mm.toFixed(1)} mm` : "–",
        label: "Rain",
      },
      {
        icon: <Eye className="h-[18px] w-[18px] text-slate-400" />,
        value: vis_km !== undefined ? `${Math.round(vis_km)} km` : "–",
        label: "Visibility",
      },
    ],
  ]

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">

      {/* Ambient warm/cool glow that follows the sun */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-[2000ms]"
        style={{
          background: isNight
            ? "radial-gradient(ellipse at 50% 110%, rgba(79,70,229,0.10) 0%, transparent 65%)"
            : `radial-gradient(ellipse at ${14 + progress * 72}% 30%, rgba(251,191,36,0.09) 0%, transparent 60%)`,
        }}
      />

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px]">🌅</span>
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">
            Sunrise / Sunset
          </h3>
        </div>
        {daylightStr && (
          <span className="text-[8.5px] font-semibold text-slate-500">{daylightStr} daylight</span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-3 py-2 min-h-0 gap-2">

        {/* π-shaped Sun Path SVG */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            className="w-full"
            style={{ maxHeight: "95px", overflow: "visible" }}
          >
            <defs>
              {/* Clip for progress coloring */}
              <clipPath id="ssProgressClip">
                <rect x="0" y="-20" width={clipW} height={H + 30} />
              </clipPath>
              {/* Gradient for the traversed arc */}
              <linearGradient id="ssSunGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>

            {/* Dashed horizon line */}
            <line
              x1={P0[0] - 12} y1={baseY}
              x2={P3[0] + 12} y2={baseY}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="4 5"
            />

            {/* Full dim arc (the untraversed path) */}
            <path
              d={arcPath}
              fill="none"
              stroke="rgba(255,255,255,0.09)"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Coloured progress arc */}
            <path
              d={arcPath}
              fill="none"
              stroke="url(#ssSunGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              clipPath="url(#ssProgressClip)"
            />

            {/* Sunrise endpoint dot */}
            <circle cx={P0[0]} cy={P0[1]} r="3.5" fill="#f97316" opacity="0.75" />
            {/* Sunset endpoint dot */}
            <circle cx={P3[0]} cy={P3[1]} r="3.5" fill="#f97316" opacity="0.75" />

            {/* Glowing sun indicator (daytime only) */}
            {!isNight && (
              <>
                <circle cx={sunX} cy={sunY} r="12" fill="rgba(251,191,36,0.10)" />
                <circle cx={sunX} cy={sunY} r="7" fill="rgba(251,191,36,0.22)" />
                <circle cx={sunX} cy={sunY} r="4.5" fill="#fbbf24" />
                <circle cx={sunX} cy={sunY} r="2.5" fill="white" opacity="0.92" />
              </>
            )}

            {/* Night moon indicator at center-top */}
            {isNight && (
              <text x={W / 2} y={20} textAnchor="middle" fontSize="18" fill="rgba(255,255,255,0.3)">🌙</text>
            )}
          </svg>
        </div>

        {/* Sunrise / Sunset time labels */}
        <div className="flex justify-between items-end px-0.5 shrink-0">
          <div className="flex flex-col items-start">
            <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-widest">Sunrise</span>
            <span className="text-[16px] font-black text-white leading-none mt-0.5">{formatTime(sunriseDate)}</span>
          </div>
          {/* Center: progress % or night badge */}
          <div className="flex flex-col items-center pb-0.5">
            {!isNight && (
              <span className="text-[9px] font-bold text-amber-400/60">
                {Math.round(progress * 100)}%
              </span>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[7px] font-semibold text-slate-500 uppercase tracking-widest">Sunset</span>
            <span className="text-[16px] font-black text-white leading-none mt-0.5">{formatTime(sunsetDate)}</span>
          </div>
        </div>

        {/* Thin separator */}
        <div className="border-t border-white/[0.05] shrink-0" />

        {/* ── Auto-sliding metrics (no boxes) ────────────── */}
        <div
          className="flex justify-around items-center shrink-0 py-0.5 transition-opacity duration-[280ms]"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {metricSets[activeSet].map((m, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              {m.icon}
              <span className="text-[13px] font-black text-white leading-tight mt-0.5">{m.value}</span>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Pill dots carousel indicator */}
        <div className="flex justify-center gap-1 pb-0.5 shrink-0">
          {[0, 1].map(i => (
            <button
              key={i}
              onClick={() => { setVisible(true); setActiveSet(i) }}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                activeSet === i ? "w-5 bg-amber-400/60" : "w-[5px] bg-white/15"
              }`}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
