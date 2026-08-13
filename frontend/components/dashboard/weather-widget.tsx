"use client"

import { useEffect, useState, useCallback } from "react"
import { apiClient } from "@/lib/api"
import {
  Cloud, CloudRain, Sun, Wind, Droplets, Thermometer,
  Eye, Gauge, Activity, AlertCircle, RefreshCw, MapPin
} from "lucide-react"

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

function getAQILabel(index: number): { label: string; color: string } {
  const map: Record<number, { label: string; color: string }> = {
    1: { label: "Good", color: "#22c55e" },
    2: { label: "Moderate", color: "#eab308" },
    3: { label: "Unhealthy for Sensitive", color: "#f97316" },
    4: { label: "Unhealthy", color: "#ef4444" },
    5: { label: "Very Unhealthy", color: "#a855f7" },
    6: { label: "Hazardous", color: "#be123c" },
  }
  return map[index] || { label: "Unknown", color: "#64748b" }
}

function getConditionIcon(condition: string, cloud: number) {
  const c = condition.toLowerCase()
  if (c.includes("rain") || c.includes("drizzle") || c.includes("shower"))
    return <CloudRain className="h-10 w-10 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
  if (c.includes("thunder") || c.includes("storm"))
    return <Activity className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
  if (c.includes("cloud") || c.includes("overcast") || cloud > 60)
    return <Cloud className="h-10 w-10 text-slate-400 drop-shadow-[0_0_8px_rgba(148,163,184,0.4)]" />
  return <Sun className="h-10 w-10 text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]" />
}

function timeAgo(isoString: string): string {
  if (!isoString) return "—"
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface WeatherWidgetProps {
  token: string
}

export function WeatherWidget({ token }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0) // for live "X min ago" display

  const fetchWeather = useCallback(async () => {
    try {
      const data = await apiClient<WeatherData>("/api/weather", { token, showErrorToast: false })
      setWeather(data)
      setError(null)
    } catch (e: any) {
      setError(e?.message || "Weather unavailable")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchWeather()
    // Refresh every 15 minutes
    const interval = setInterval(fetchWeather, 15 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchWeather])

  // Tick every 30s to update "X min ago"
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl bg-[rgba(6,10,30,0.4)] backdrop-blur-md border border-white/5 gap-3">
        <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
        <span className="text-[11px] text-slate-500 uppercase tracking-widest">Fetching weather…</span>
      </div>
    )
  }

  if (error || !weather) {
    return (
      <div className="h-full flex flex-col items-center justify-center rounded-xl bg-[rgba(6,10,30,0.4)] backdrop-blur-md border border-white/5 gap-3 px-4 text-center">
        <AlertCircle className="h-6 w-6 text-red-400" />
        <span className="text-[11px] text-slate-400 uppercase tracking-widest">Weather Unavailable</span>
        <span className="text-[10px] text-slate-600">{error}</span>
        <button
          onClick={fetchWeather}
          className="mt-1 text-[10px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  const uvInfo = getUVLabel(weather.uv ?? 0)
  const aqiInfo = getAQILabel(weather.aqi_index ?? 1)
  const conditionIcon = getConditionIcon(weather.condition, weather.cloud ?? 0)
  const isStale = weather.stale

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.4)] backdrop-blur-md border border-white/5 shadow-[0_6px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Subtle glow */}
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full blur-[60px] bg-sky-500/10 pointer-events-none" />
      <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full blur-[60px] bg-indigo-500/10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06]">
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

      {/* Main body */}
      <div className="flex-1 flex flex-col gap-2 px-3 py-2 overflow-hidden min-h-0">

        {/* Top row: big temp + condition */}
        <div className="flex items-center gap-3">
          <div className="transition-transform duration-300 hover:scale-105">
            {conditionIcon}
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-black text-white leading-none">
              {weather.temp_c?.toFixed(1)}<span className="text-lg text-slate-400 font-semibold ml-0.5">°C</span>
            </span>
            <span className="text-[10px] text-slate-400 leading-tight mt-0.5">
              Feels {weather.feelslike_c?.toFixed(1)}°C
            </span>
            <span className="text-[10px] text-slate-300 font-semibold leading-tight">
              {weather.condition}
            </span>
          </div>
        </div>

        {/* Grid of metrics */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 flex-1">

          {/* Wind */}
          <div className="flex items-center gap-1.5 group">
            <Wind className="h-3 w-3 text-cyan-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">Wind</span>
              <span className="text-[11px] font-bold text-white">
                {weather.wind_kph?.toFixed(0)} km/h {weather.wind_dir}
              </span>
            </div>
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-1.5">
            <Droplets className="h-3 w-3 text-blue-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">Humidity</span>
              <span className="text-[11px] font-bold text-white">{weather.humidity}%</span>
            </div>
          </div>

          {/* UV Index */}
          <div className="flex items-center gap-1.5">
            <Sun className="h-3 w-3 shrink-0" style={{ color: uvInfo.color }} />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">UV Index</span>
              <span className="text-[11px] font-bold" style={{ color: uvInfo.color }}>
                {weather.uv} — {uvInfo.label}
              </span>
            </div>
          </div>

          {/* Precipitation */}
          <div className="flex items-center gap-1.5">
            <CloudRain className="h-3 w-3 text-indigo-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">Rain Today</span>
              <span className="text-[11px] font-bold text-white">{weather.precip_mm?.toFixed(1)} mm</span>
            </div>
          </div>

          {/* Visibility */}
          <div className="flex items-center gap-1.5">
            <Eye className="h-3 w-3 text-slate-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">Visibility</span>
              <span className="text-[11px] font-bold text-white">{weather.vis_km?.toFixed(0)} km</span>
            </div>
          </div>

          {/* Pressure */}
          <div className="flex items-center gap-1.5">
            <Gauge className="h-3 w-3 text-purple-400 shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] text-slate-500 uppercase tracking-wide">Pressure</span>
              <span className="text-[11px] font-bold text-white">{weather.pressure_mb?.toFixed(0)} mb</span>
            </div>
          </div>
        </div>

        {/* Surrounding Air Quality divider */}
        <div className="border-t border-white/[0.06] pt-1.5">
          <div className="flex items-center gap-1 mb-1.5">
            <Activity className="h-2.5 w-2.5 text-cyan-400" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/70">
              Surrounding Air Quality
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex flex-col items-center bg-white/[0.03] rounded-lg py-1 px-1 border border-white/[0.04]">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mb-0.5">PM2.5</span>
              <span className="text-[11px] font-black text-white">{weather.pm25?.toFixed(0)}</span>
              <span className="text-[7px] text-slate-600">µg/m³</span>
            </div>
            <div className="flex flex-col items-center bg-white/[0.03] rounded-lg py-1 px-1 border border-white/[0.04]">
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mb-0.5">PM10</span>
              <span className="text-[11px] font-black text-white">{weather.pm10?.toFixed(0)}</span>
              <span className="text-[7px] text-slate-600">µg/m³</span>
            </div>
            <div className="flex flex-col items-center bg-white/[0.03] rounded-lg py-1 px-1 border border-white/[0.04]" style={{ borderColor: `${aqiInfo.color}30` }}>
              <span className="text-[8px] text-slate-500 uppercase tracking-wide mb-0.5">AQI</span>
              <span className="text-[11px] font-black" style={{ color: aqiInfo.color }}>{aqiInfo.label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer: timestamp */}
      <div className={`flex items-center justify-between px-3 py-1 border-t border-white/[0.04] ${isStale ? "bg-yellow-500/5" : ""}`}>
        <span className="text-[8.5px] text-slate-600">
          {isStale ? "⚠ Stale data" : "Updated"} {timeAgo(weather.fetchedAt)}
        </span>
        <span className="text-[8px] text-slate-700 uppercase tracking-wider">WeatherAPI</span>
      </div>
    </div>
  )
}
