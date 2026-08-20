"use client"

import React from "react"
import { Droplets, Sun } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  formatForecastDate,
  normalizeWeatherIconUrl,
  type ForecastDay,
} from "./weather-types"

interface ForecastTileProps {
  forecast?: ForecastDay[]
  isLoading?: boolean
}

export function ForecastTile({ forecast, isLoading }: ForecastTileProps) {
  const days = forecast?.slice(0, 3) ?? []
  const isEmpty = isLoading || days.length === 0

  return (
    <Card className="relative h-full min-h-0 gap-0 overflow-hidden rounded-xl border-white/[0.11] bg-[rgba(8,15,38,0.45)] p-0 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.22)] backdrop-blur-xl">


      <div className="flex shrink-0 items-center justify-between px-3 pb-1.5 pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sun className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
          <h3 className="truncate text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">
            3-Day Forecast
          </h3>
        </div>
        <Badge
          variant="outline"
          className="shrink-0 rounded-full border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[8.5px] font-bold tracking-wide text-cyan-400"
        >
          3 days
        </Badge>
      </div>
      <Separator className="bg-white/[0.06]" />

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2.5 py-2">
        {isEmpty ? (
          <div className="flex min-h-24 flex-1 items-center justify-center">
            <span className="text-[10px] tracking-wider text-slate-500">
              Forecast loading…
            </span>
          </div>
        ) : (
          days.map((day, index) => {
            const iconUrl = normalizeWeatherIconUrl(day.icon)

            return (
              <div
                key={day.date}
                className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.04] px-2.5 py-2.5 backdrop-blur-sm transition-colors hover:bg-white/[0.06] sm:gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={day.condition || "Forecast condition"}
                      className="h-9 w-9 object-contain drop-shadow-[0_0_6px_rgba(255,255,255,0.15)]"
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="text-[9px] font-semibold uppercase tracking-wide text-slate-600"
                      aria-label="Forecast icon unavailable"
                    >
                      —
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-[20px] font-black leading-none text-white sm:text-[21px]">
                    {day.max_c}°
                  </span>
                  <span className="text-[11px] font-semibold leading-none text-slate-500 sm:text-[12px]">
                    {day.min_c}°
                  </span>
                </div>

                {day.rain_chance > 0 && (
                  <div className="flex shrink-0 items-center gap-0.5 text-blue-400">
                    <Droplets className="h-3 w-3" aria-hidden="true" />
                    <span className="text-[8px] font-bold sm:text-[9px]">
                      {day.rain_chance}%
                    </span>
                  </div>
                )}

                <div className="min-w-0 flex-1" />

                <div className="flex min-w-0 shrink-0 flex-col items-end">
                  <span className="max-w-[76px] truncate text-right text-[10px] font-bold leading-tight text-slate-300 sm:max-w-none sm:text-[11px]">
                    {formatForecastDate(day.date, index)}
                  </span>
                  {index === 0 && day.condition && (
                    <span className="max-w-[76px] truncate text-right text-[8px] font-semibold uppercase tracking-wide text-amber-400/60 sm:max-w-none">
                      {day.condition}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>


    </Card>
  )
}
