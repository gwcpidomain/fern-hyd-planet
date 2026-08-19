"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Activity, AlertCircle, Cloud, MapPin, RefreshCw } from "lucide-react"
import { apiClient } from "@/lib/api"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  normalizeWeatherIconUrl,
  type WeatherPayload,
} from "./weather-types"

function getAQILabel(index: number): { label: string; color: string; percent: number } {
  const map: Record<number, { label: string; color: string; percent: number }> = {
    1: { label: "Good", color: "#22c55e", percent: 5 },
    2: { label: "Satisfactory", color: "#84cc16", percent: 22 },
    3: { label: "Moderate", color: "#eab308", percent: 40 },
    4: { label: "Poor", color: "#f97316", percent: 60 },
    5: { label: "Very Poor", color: "#ef4444", percent: 78 },
    6: { label: "Severe", color: "#be123c", percent: 95 },
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

export function WeatherWidget({
  token,
  onConditionChange,
  onWeatherLoad,
}: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nowEpoch, setNowEpoch] = useState<number | null>(null)
  const hourlyViewportRef = useRef<HTMLDivElement>(null)
  const hasInitialScrolledRef = useRef(false)

  const fetchWeather = useCallback(async () => {
    if (!token) return

    try {
      const data = await apiClient<WeatherPayload>("/api/weather", {
        token,
        showErrorToast: false,
      })
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

  useEffect(() => {
    const updateClock = () => setNowEpoch(Math.floor(Date.now() / 1000))
    updateClock()

    const interval = window.setInterval(updateClock, 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  const hourly = weather?.hourly ?? []
  const activeHourIndex = nowEpoch === null
    ? 0
    : (() => {
        const matchingIndex = hourly.findIndex((slot, index) => {
          const nextEpoch = hourly[index + 1]?.time_epoch ?? slot.time_epoch + 3600
          return slot.time_epoch <= nowEpoch && nowEpoch < nextEpoch
        })
        if (matchingIndex >= 0) return matchingIndex
        const nextIndex = hourly.findIndex((slot) => slot.time_epoch > nowEpoch)
        return nextIndex > 0 ? nextIndex - 1 : 0
      })()
  const visibleHourly = hourly.slice(Math.min(activeHourIndex, hourly.length))

  useEffect(() => {
    if (nowEpoch === null || visibleHourly.length === 0 || hasInitialScrolledRef.current) return

    const viewport = hourlyViewportRef.current
    const currentItem = viewport?.querySelector<HTMLElement>("[data-current-hour='true']")
    if (!viewport || !currentItem) return

    const targetLeft = currentItem.offsetLeft - (viewport.clientWidth - currentItem.clientWidth) / 2
    viewport.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" })
    hasInitialScrolledRef.current = true
  }, [nowEpoch, visibleHourly.length])

  if (loading && !weather) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border-white/[0.08] bg-[rgba(6,10,30,0.35)] p-4 text-white shadow-[0_6px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          Loading Weather...
        </span>
      </Card>
    )
  }

  if (error && !weather) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border-white/[0.08] bg-[rgba(6,10,30,0.35)] p-4 text-center text-white shadow-[0_6px_32px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <AlertCircle className="h-7 w-7 text-amber-400" aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          WEATHER UNAVAILABLE
        </span>
        <span className="text-[9.5px] text-slate-500">{error}</span>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            fetchWeather()
          }}
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 text-[10px] font-bold text-cyan-300 transition-all hover:bg-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Retry
        </button>
      </Card>
    )
  }

  if (!weather) return null

  const aqiInfo = getAQILabel(weather.aqi_index ?? 1)
  const isStale = weather.stale
  const currentIconUrl = normalizeWeatherIconUrl(weather.condition_icon)
  const displayAQI = Math.round((weather.aqi_index ?? 1) * 34)

  return (
    <Card className="relative h-full min-h-0 gap-0 overflow-hidden rounded-xl border-white/[0.08] bg-[rgba(6,10,30,0.35)] p-0 text-white shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">




      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-3 pt-2.5 pb-1.5">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center transition-transform duration-300 hover:scale-105">
            {currentIconUrl ? (
              <img
                src={currentIconUrl}
                alt={weather.condition || "Current weather"}
                className="h-9 w-9 object-contain drop-shadow-[0_0_8px_rgba(96,165,250,0.35)]"
              />
            ) : (
              <span className="text-sm text-slate-600" aria-label="Current weather icon unavailable">
                —
              </span>
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

        {visibleHourly.length > 0 && (
          <div
            ref={hourlyViewportRef}
            role="region"
            aria-label="Hourly weather forecast"
            tabIndex={0}
            className="max-h-[58px] shrink-0 overflow-x-auto overflow-y-hidden rounded-lg border border-white/[0.05] bg-white/[0.03] px-1.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex min-w-max items-stretch gap-1">
              {visibleHourly.map((slot, index) => {
                const iconUrl = normalizeWeatherIconUrl(slot.icon)
                const isCurrent = index === 0
                const timeLabel = isCurrent
                  ? "Now"
                  : slot.time?.slice(11, 16) || "—"

                return (
                  <div
                    key={slot.time_epoch}
                    data-current-hour={isCurrent ? "true" : undefined}
                    aria-current={isCurrent ? "time" : undefined}
                    aria-label={`${timeLabel}: ${slot.condition || "Weather unavailable"}, ${slot.temp_c} degrees, ${slot.precip_chance}% precipitation chance`}
                    className={`flex min-w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-center transition-colors ${
                      isCurrent
                        ? "border border-cyan-400/20 bg-cyan-400/10"
                        : "border border-transparent"
                    }`}
                  >
                    <span className={`text-[8px] font-medium ${isCurrent ? "text-cyan-200" : "text-slate-400"}`}>
                      {timeLabel}
                    </span>
                    <div className="flex h-5 items-center justify-center">
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt={slot.condition || "Hourly weather condition"}
                          className="h-5 w-5 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-[9px] text-slate-600" aria-hidden="true">
                          —
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-black leading-none text-white">
                      {slot.temp_c}°
                    </span>
                    <span className="text-[7px] font-bold text-blue-400">
                      {slot.precip_chance}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="shrink-0 rounded-lg border border-white/[0.05] bg-white/[0.03] p-2">
          <div className="mb-0.5 flex items-center gap-1">
            <Activity className="h-2.5 w-2.5 text-cyan-400/80" aria-hidden="true" />
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
              Air Quality
            </span>
          </div>

          <div className="mb-1 flex items-baseline gap-1.5">
            <span className="text-[22px] font-black leading-none text-white">{displayAQI}</span>
            <span className="text-[11px] font-bold leading-none" style={{ color: aqiInfo.color }}>
              {aqiInfo.label}
            </span>
          </div>

          <div
            className="relative my-1.5 h-[5px] w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, #22c55e, #84cc16, #eab308, #f97316, #ef4444, #be123c)",
            }}
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

      <div className={`flex shrink-0 items-center justify-between border-t border-white/[0.04] px-3 py-1 ${isStale ? "bg-yellow-500/5" : ""}`}>
        <span className="text-[8px] font-bold text-slate-400">
          {isStale ? "⚠ Stale data" : "Updated"} {timeAgo(weather.fetchedAt)}
        </span>
      </div>
    </Card>
  )
}
