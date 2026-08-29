"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Activity, AlertCircle, Cloud, MapPin, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api"
import { Card } from "@/components/ui/card"
import {
  normalizeWeatherIconUrl,
  formatForecastDate,
  type WeatherPayload,
} from "./weather-types"

function getAQILabel(index: number): { label: string; color: string; percent: number } {
  const map: Record<number, { label: string; color: string; percent: number }> = {
    1: { label: "Good",        color: "#22c55e", percent: 5  },
    2: { label: "Satisfactory",color: "#84cc16", percent: 22 },
    3: { label: "Moderate",    color: "#eab308", percent: 40 },
    4: { label: "Poor",        color: "#f97316", percent: 60 },
    5: { label: "Very Poor",   color: "#ef4444", percent: 78 },
    6: { label: "Severe",      color: "#be123c", percent: 95 },
  }
  return map[index] || map[1]
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
  onWeatherLoad?: (data: WeatherPayload) => void
}

export function WeatherWidget({ token, onConditionChange, onWeatherLoad }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState<string | null>(null)
  const [nowEpoch, setNowEpoch] = useState<number | null>(null)
  const hourlyViewportRef       = useRef<HTMLDivElement>(null)
  const hasInitialScrolledRef   = useRef(false)
  const [activePanel, setActivePanel] = useState(0)
  const [isManual,    setIsManual]    = useState(false)

  // ── Data fetch ──────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiClient<WeatherPayload>("/api/weather", { token, showErrorToast: false })
      setWeather(data)
      setError(null)
      if (onConditionChange && data.condition) onConditionChange(data.condition)
      if (onWeatherLoad) onWeatherLoad(data)
    } catch (e: any) {
      setError(e?.message || "Weather unavailable")
    } finally {
      setLoading(false)
    }
  }, [onConditionChange, onWeatherLoad, token])

  useEffect(() => {
    fetchWeather()
    const interval = window.setInterval(fetchWeather, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [fetchWeather])

  // ── Clock tick ───────────────────────────────────────────────
  useEffect(() => {
    const update = () => setNowEpoch(Math.floor(Date.now() / 1000))
    update()
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  // ── Hourly slice ─────────────────────────────────────────────
  const hourly = weather?.hourly ?? []
  const activeHourIndex = nowEpoch === null
    ? 0
    : (() => {
        const idx = hourly.findIndex((slot, i) => {
          const next = hourly[i + 1]?.time_epoch ?? slot.time_epoch + 3600
          return slot.time_epoch <= nowEpoch && nowEpoch < next
        })
        if (idx >= 0) return idx
        const next = hourly.findIndex(s => s.time_epoch > nowEpoch)
        return next > 0 ? next - 1 : 0
      })()
  const visibleHourly = hourly.slice(Math.min(activeHourIndex, hourly.length))

  // ── Auto-scroll ribbon to current hour ───────────────────────
  useEffect(() => {
    if (nowEpoch === null || visibleHourly.length === 0 || hasInitialScrolledRef.current) return
    const vp = hourlyViewportRef.current
    const cur = vp?.querySelector<HTMLElement>("[data-current-hour='true']")
    if (!vp || !cur) return
    vp.scrollTo({ left: Math.max(0, cur.offsetLeft - (vp.clientWidth - cur.clientWidth) / 2), behavior: "auto" })
    hasInitialScrolledRef.current = true
  }, [nowEpoch, visibleHourly.length])

  // ── Mouse-wheel horizontal scroll ────────────────────────────
  useEffect(() => {
    const el = hourlyViewportRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [visibleHourly.length])

  // ── Panel auto-cycle (8 s) ────────────────────────────────────
  useEffect(() => {
    if (isManual) return
    const t = setInterval(() => setActivePanel(p => (p + 1) % 2), 8000)
    return () => clearInterval(t)
  }, [isManual])

  const handlePanelSelect = (i: number) => {
    setActivePanel(i)
    setIsManual(true)
    setTimeout(() => setIsManual(false), 20_000)
  }

  // ── Loading / Error states ────────────────────────────────────
  if (loading && !weather) {
    return (
      <Card className="dash-tile flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-white/[0.08] bg-[rgba(6,10,30,0.35)] p-4 text-white shadow-none">
        <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Loading Weather...</span>
      </Card>
    )
  }

  if (error && !weather) {
    return (
      <Card className="dash-tile flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-white/[0.08] bg-[rgba(6,10,30,0.35)] p-4 text-center text-white shadow-none">
        <AlertCircle className="h-7 w-7 text-amber-400" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">WEATHER UNAVAILABLE</span>
        <span className="text-[9.5px] text-slate-500">{error}</span>
        <button
          type="button"
          onClick={() => { setLoading(true); fetchWeather() }}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-[10px] font-bold text-cyan-300 transition-all hover:bg-cyan-500/30"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </Card>
    )
  }

  if (!weather) return null

  const aqiInfo       = getAQILabel(weather.aqi_index ?? 1)
  const isStale       = weather.stale
  const currentIconUrl = normalizeWeatherIconUrl(weather.condition_icon)
  const displayAQI    = Math.round((weather.aqi_index ?? 1) * 34)

  // Shared panel dot component
  const PanelDots = () => (
    <div className="flex items-center gap-1.5">
      {[0, 1].map(i => (
        <button
          key={i}
          onClick={() => handlePanelSelect(i)}
          aria-label={i === 0 ? "Surrounding Conditions" : "3-Day Forecast"}
          className={`rounded-full transition-all duration-300 ${i === activePanel ? "w-4 h-1.5 bg-cyan-400" : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"}`}
        />
      ))}
    </div>
  )

  return (
    <div className="relative h-full">
      {/* ═══ Panel 1: Surrounding Conditions ═══ */}
      <Card className={`dash-tile absolute inset-0 flex flex-col gap-0 overflow-hidden rounded-2xl border-white/[0.11] bg-[rgba(8,15,38,0.45)] p-0 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] transition-opacity duration-500 ${activePanel === 0 ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none z-0"}`}>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 overflow-hidden px-3 pt-2 pb-1.5">
          {/* Current condition row */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-300 hover:scale-105">
              {currentIconUrl ? (
                <img src={currentIconUrl} alt={weather.condition || "Current weather"} className="h-11 w-11 object-contain drop-shadow-[0_0_10px_rgba(96,165,250,0.45)]" />
              ) : (
                <span className="text-sm text-slate-600" aria-label="Current weather icon unavailable">—</span>
              )}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-2xl font-black leading-none text-white">
                {weather.temp_c?.toFixed(1)}
                <span className="ml-0.5 text-sm font-semibold text-slate-400">°C</span>
              </span>
              <span className="mt-0.5 truncate text-[9px] leading-tight text-slate-400">
                Feels {weather.feelslike_c?.toFixed(1)}°C · {weather.condition}
              </span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-600">
                <MapPin className="h-2 w-2" aria-hidden="true" />
                {weather.location}
              </span>
            </div>
          </div>

          {/* Hourly ribbon */}
          {visibleHourly.length > 0 && (
            <div
              ref={hourlyViewportRef}
              role="region"
              aria-label="Hourly weather forecast"
              tabIndex={0}
              className="shrink-0 overflow-x-auto overflow-y-hidden rounded-lg border border-white/[0.05] bg-white/[0.03] px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div className="flex min-w-max items-stretch gap-1">
                {visibleHourly.map((slot, index) => {
                  const iconUrl  = normalizeWeatherIconUrl(slot.icon)
                  const isCurrent = index === 0
                  const timeLabel = isCurrent ? "Now" : (slot.time?.slice(11, 16) || "—")
                  return (
                    <div
                      key={slot.time_epoch}
                      data-current-hour={isCurrent ? "true" : undefined}
                      aria-current={isCurrent ? "time" : undefined}
                      className={`flex min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-center transition-colors ${isCurrent ? "border border-cyan-400/30 bg-cyan-400/15 backdrop-blur-sm" : "border border-transparent"}`}
                    >
                      <span className={`text-[8px] font-semibold ${isCurrent ? "text-cyan-100" : "text-slate-200"}`}>{timeLabel}</span>
                      <div className="flex h-4.5 items-center justify-center">
                        {iconUrl ? (
                          <img src={iconUrl} alt={slot.condition || ""} className="h-4.5 w-4.5 object-contain" loading="lazy" />
                        ) : (
                          <span className="text-[9px] text-slate-600" aria-hidden="true">—</span>
                        )}
                      </div>
                      <span className="text-[10px] font-black leading-none text-white">{slot.temp_c}°</span>
                      <span className="text-[7.5px] font-bold text-sky-300">{slot.precip_chance}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* AQI bar */}
          <div className="shrink-0 rounded-lg border border-white/[0.05] bg-white/[0.03] p-2">
            <div className="mb-0.5 flex items-center gap-1">
              <Activity className="h-2.5 w-2.5 text-cyan-400/80" aria-hidden="true" />
              <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Air Quality</span>
            </div>
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="text-[22px] font-black leading-none text-white">{displayAQI}</span>
              <span className="text-[11px] font-bold leading-none" style={{ color: aqiInfo.color }}>{aqiInfo.label}</span>
            </div>
            <div
              className="relative my-1.5 h-[5px] w-full rounded-full"
              style={{ background: "linear-gradient(to right, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #be123c)" }}
              aria-label={`Air quality scale: ${aqiInfo.label}`}
              role="img"
            >
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-[2px] border-slate-900 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] transition-all duration-700"
                style={{ left: `calc(${aqiInfo.percent}% - 6px)` }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex shrink-0 items-center justify-between border-t border-white/[0.04] px-3 py-1 ${isStale ? "bg-yellow-500/5" : ""}`}>
          <span className="text-[8px] font-bold text-slate-400">
            {isStale ? "⚠ Stale data" : "Updated"} {timeAgo(weather.fetchedAt)}
          </span>
          <PanelDots />
        </div>
      </Card>

      {/* ═══ Panel 2: 3-Day Forecast ═══ */}
      <Card className={`dash-tile absolute inset-0 flex flex-col gap-0 overflow-hidden rounded-2xl border-white/[0.11] bg-[rgba(8,15,38,0.45)] p-0 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] transition-opacity duration-500 ${activePanel === 1 ? "opacity-100 pointer-events-auto z-10" : "opacity-0 pointer-events-none z-0"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-1.5">
            <Cloud className="h-3.5 w-3.5 text-cyan-400" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.20em] text-cyan-400">3-Day Forecast</h3>
          </div>
          <span className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider">{weather.location}</span>
        </div>
        {/* Day cards */}
        <div className="flex flex-col flex-1 min-h-0 justify-evenly px-3 py-2 gap-1.5">
          {(weather.forecast ?? []).slice(0, 3).map((day, i) => {
            const icon = normalizeWeatherIconUrl(day.icon)
            return (
              <div key={day.date} className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {icon ? (
                    <img src={icon} alt={day.condition} className="h-8 w-8 object-contain drop-shadow-[0_0_6px_rgba(96,165,250,0.4)]" />
                  ) : (
                    <Cloud className="h-8 w-8 text-slate-500" />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black text-white">{formatForecastDate(day.date, i)}</span>
                    <span className="text-[8px] text-slate-400 truncate max-w-[120px]">{day.condition}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {day.rain_chance > 0 && (
                    <span className="text-[9px] text-blue-400 font-bold">{day.rain_chance}%</span>
                  )}
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[13px] font-black text-white">{day.max_c}°</span>
                    <span className="text-[10px] text-slate-500">/{day.min_c}°</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.04] px-3 py-1">
          <span className="text-[8px] font-bold text-slate-500">3-day outlook</span>
          <PanelDots />
        </div>
      </Card>
    </div>
  )
}
