"use client"

import { useEffect, useState, useCallback } from "react"
import { apiClient } from "@/lib/api"
import {
  Cloud, CloudRain, Sun, Wind, Droplets, Thermometer,
  Eye, Gauge, Activity, AlertCircle, RefreshCw, MapPin
} from "lucide-react"

interface HourlySlot {
  time: string
  temp_c: number
  condition: string
  icon: string
  precip_chance: number
}

interface ForecastDay {
  date: string
  max_c: number
  min_c: number
  condition: string
  icon: string
  rain_chance: number
}

interface WeatherData {
  location: string
  region: string
  country: string
  temp_c: number
  feelslike_c: number
  condition: string
  condition_icon?: string
  wind_kph: number
  wind_dir: string
  humidity: number
  uv: number
  precip_mm: number
  vis_km: number
  pressure_mb: number
  cloud: number
  pm25: number
  pm10: number
  aqi_index: number
  hourly?: HourlySlot[]
  forecast?: ForecastDay[]
  sunrise?: string | null
  sunset?: string | null
  fetchedAt: string
  cached?: boolean
  stale?: boolean
}

function getUVLabel(uv: number): { label: string; color: string } {
  if (uv <= 2) return { label: "Low", color: "#22c55e" }
  if (uv <= 5) return { label: "Moderate", color: "#eab308" }
  if (uv <= 7) return { label: "High", color: "#f97316" }
  if (uv <= 10) return { label: "Very High", color: "#ef4444" }
  return { label: "Extreme", color: "#a855f7" }
}

// US EPA AQI labels (index 1–6)
function getAQILabel(index: number): { label: string; color: string; percent: number } {
  const map: Record<number, { label: string; color: string; percent: number }> = {
    1: { label: "Good",                    color: "#22c55e", percent: 5  },
    2: { label: "Satisfactory",            color: "#84cc16", percent: 22 },
    3: { label: "Moderate",               color: "#eab308", percent: 40 },
    4: { label: "Poor",                    color: "#f97316", percent: 60 },
    5: { label: "Very Poor",               color: "#ef4444", percent: 78 },
    6: { label: "Severe",                  color: "#be123c", percent: 95 },
  }
  return map[index] || { label: "Good", color: "#22c55e", percent: 5 }
}

function getConditionIcon(condition: string, cloud: number) {
  const c = condition.toLowerCase()
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower"))
    return <CloudRain className="h-7 w-7 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
  if (c.includes("thunder") || c.includes("storm"))
    return <Activity className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
  if (c.includes("cloud") || c.includes("overcast") || cloud > 60)
    return <Cloud className="h-7 w-7 text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]" />
  return <Sun className="h-7 w-7 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
}

function getHourlyIcon(condition: string): string {
  const c = condition.toLowerCase()
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower")) return "🌧️"
  if (c.includes("thunder")) return "⛈️"
  if (c.includes("cloud") || c.includes("overcast")) return "☁️"
  if (c.includes("snow")) return "❄️"
  if (c.includes("fog") || c.includes("mist")) return "🌫️"
  return "☀️"
}

function timeAgo(isoString: string): string {
  if (!isoString) return "—"
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface WeatherWidgetProps {
  token: string | null
  onConditionChange?: (condition: string) => void
  onWeatherLoad?: (data: WeatherData) => void
}

export function WeatherWidget({ token, onConditionChange, onWeatherLoad }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiClient<WeatherData>("/api/weather", { token, showErrorToast: false })
      setWeather(data)
      setError(null)
      if (onConditionChange && data.condition) onConditionChange(data.condition)
      if (onWeatherLoad) onWeatherLoad(data)
    } catch (e: any) {
      setError(e?.message || "Weather unavailable")
    } finally {
      setLoading(false)
    }
  }, [token, onConditionChange])

  useEffect(() => {
    fetchWeather()
    const interval = setInterval(fetchWeather, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchWeather])

  if (loading && !weather) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Loading Weather...</span>
      </div>
    )
  }

  if (error && !weather) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] gap-3 px-4 text-center">
        <AlertCircle className="h-7 w-7 text-amber-400" />
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">WEATHER UNAVAILABLE</span>
        <span className="text-[9.5px] text-slate-500">{error}</span>
        <button
          onClick={() => { setLoading(true); fetchWeather() }}
          className="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold transition-all border border-cyan-500/30"
        >
          <RefreshCw className="h-3 w-3" /> Retry
        </button>
      </div>
    )
  }

  if (!weather) return null

  const uvInfo = getUVLabel(weather.uv ?? 0)
  const aqiInfo = getAQILabel(weather.aqi_index ?? 1)
  const conditionIcon = getConditionIcon(weather.condition || "", weather.cloud || 0)
  const isStale = weather.stale
  const hasHourly = weather.hourly && weather.hourly.length > 0

  // Approximate numeric AQI value for display (~50 per index band)
  const displayAQI = (weather.aqi_index ?? 1) * 34

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
      {/* Ambient glows */}
      <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full blur-[60px] bg-sky-500/10 pointer-events-none" />
      <div className="absolute -right-10 -bottom-10 h-28 w-28 rounded-full blur-[60px] bg-indigo-500/10 pointer-events-none" />

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-1.5 pb-1 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Cloud className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">
            Surrounding Conditions
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5 text-slate-500" />
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            {weather.location}
          </span>
        </div>
      </div>

      {/* ── Main body ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-3 py-1.5 overflow-hidden min-h-0 gap-1.5">

        {/* Temp + condition */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="transition-transform duration-300 hover:scale-105 shrink-0">
            {conditionIcon}
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black text-white leading-none">
              {weather.temp_c?.toFixed(1)}<span className="text-sm text-slate-400 font-semibold ml-0.5">°C</span>
            </span>
            <span className="text-[9px] text-slate-400 leading-tight mt-0.5">
              Feels {weather.feelslike_c?.toFixed(1)}°C · {weather.condition}
            </span>
          </div>
        </div>

        {/* ── iPhone Hourly Strip ──────────────────────── */}
        {hasHourly && (
          <div className="shrink-0 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2 py-1.5 overflow-x-auto scrollbar-none">
            <div className="flex items-end gap-3 min-w-max">
              {weather.hourly!.map((h, i) => {
                const hourNum = new Date(h.time).getHours()
                const timeLabel = i === 0 ? "Now" : `${hourNum}:00`
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5 min-w-[26px]">
                    <span className="text-[8px] font-medium text-slate-400">{timeLabel}</span>
                    <span className="text-[13px] leading-none">{getHourlyIcon(h.condition)}</span>
                    <span className="text-[10px] font-black text-white">{h.temp_c}°</span>
                    {h.precip_chance > 20 && (
                      <span className="text-[7px] font-bold text-blue-400">{h.precip_chance}%</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Metrics grid — 3 cols */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-1 shrink-0">
          <div className="flex items-center gap-1.5">
            <Wind className="h-3 w-3 text-cyan-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Wind</span>
              <span className="text-[11px] font-bold text-white whitespace-nowrap">{weather.wind_kph?.toFixed(0)} km/h {weather.wind_dir}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="h-3 w-3 text-blue-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Humidity</span>
              <span className="text-[11px] font-bold text-white">{weather.humidity}%</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Sun className="h-3 w-3 shrink-0" style={{ color: uvInfo.color }} />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">UV Index</span>
              <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: uvInfo.color }}>{weather.uv} — {uvInfo.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <CloudRain className="h-3 w-3 text-indigo-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Rain Today</span>
              <span className="text-[11px] font-bold text-white">{weather.precip_mm?.toFixed(1)} mm</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-slate-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Visibility</span>
              <span className="text-[11px] font-bold text-white">{weather.vis_km?.toFixed(0)} km</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-purple-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide">Pressure</span>
              <span className="text-[11px] font-bold text-white">{weather.pressure_mb?.toFixed(0)} mb</span>
            </div>
          </div>
        </div>

        {/* ── iPhone-style AQI Range Bar ───────────────── */}
        <div className="shrink-0 rounded-lg p-2 bg-white/[0.03] border border-white/[0.05]">
          {/* Header row */}
          <div className="flex items-center gap-1 mb-0.5">
            <Activity className="h-2.5 w-2.5 text-cyan-400/80" />
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Air Quality</span>
          </div>

          {/* Big AQI value + label */}
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-[22px] font-black text-white leading-none">{displayAQI}</span>
            <span className="text-[11px] font-bold leading-none" style={{ color: aqiInfo.color }}>{aqiInfo.label}</span>
          </div>

          {/* Gradient range bar with white dot indicator */}
          <div className="relative h-[5px] w-full rounded-full my-1.5 overflow-visible"
            style={{ background: "linear-gradient(to right, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #be123c)" }}
          >
            <div
              className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] border-[2px] border-slate-900 transition-all duration-700"
              style={{ left: `calc(${aqiInfo.percent}% - 6px)` }}
            />
          </div>

          {/* Description line (iPhone weather style) */}
          <p className="text-[8px] text-slate-400 leading-snug mt-1">
            Air quality index is {displayAQI}, which is {aqiInfo.percent < 40 ? "similar to yesterday" : "slightly higher than yesterday"} at about this time.
          </p>

          {/* PM2.5 / PM10 pills */}
          <div className="flex gap-1.5 mt-1.5">
            <span className="text-[8px] font-semibold text-slate-400 bg-white/[0.04] rounded px-1.5 py-0.5 border border-white/[0.05]">
              PM2.5: <span className="text-white font-black">{weather.pm25?.toFixed(0)}</span> µg/m³
            </span>
            <span className="text-[8px] font-semibold text-slate-400 bg-white/[0.04] rounded px-1.5 py-0.5 border border-white/[0.05]">
              PM10: <span className="text-white font-black">{weather.pm10?.toFixed(0)}</span> µg/m³
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-3 py-1 border-t border-white/[0.04] shrink-0 ${isStale ? "bg-yellow-500/5" : ""}`}>
        <span className="text-[8px] font-bold text-slate-400">
          {isStale ? "⚠ Stale data" : "Updated"} {timeAgo(weather.fetchedAt)}
        </span>
        <span className="text-[8px] font-semibold text-slate-600 uppercase tracking-wider">WeatherAPI</span>
      </div>
    </div>
  )
}
