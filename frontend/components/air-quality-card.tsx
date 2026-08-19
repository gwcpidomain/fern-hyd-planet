"use client"

import { useEffect, useRef, useState } from "react"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  LineController,
  Filler,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarController, LineController, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface AirQualityData {
  pm25: number
  pm10: number
  co2: number
  tvoc: number
  hcho: number
  temp: number
  humidity: number
  chartData: {
    labels: string[]
    pm25: number[]
    pm10: number[]
    co2: number[]
    tvoc: number[]
    hcho: number[]
    temp: number[]
    humidity: number[]
  }
}


import { Maximize2 } from "lucide-react"
import { MetricHistoryChart } from "@/components/charts/aqi-forecast-chart"
import { calculateAQI } from "@/utils/aqi-calculator"

interface AirQualityCardProps {
  data: AirQualityData
  activeMetric: string | null
  onMetricSelect: (metric: string | null) => void
  onExpand?: () => void
  isOffline?: boolean
  compact?: boolean
  transparent?: boolean
}

export function AirQualityCard({ data, activeMetric, onMetricSelect, onExpand, isOffline = false, compact = false, transparent = false }: AirQualityCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [animatedValues, setAnimatedValues] = useState({
    pm25: 0,
    pm10: 0,
    co2: 0,
    tvoc: 0,
    hcho: 0,
    temp: 0,
    humidity: 0,
  })
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("1h")
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // Animate values when data changes
  useEffect(() => {
    const duration = 200 // Faster update for real-time feel (200ms)
    const startTime = Date.now()
    const startValues = { ...animatedValues }

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      setAnimatedValues({
        pm25: startValues.pm25 + (data.pm25 - startValues.pm25) * eased,
        pm10: startValues.pm10 + (data.pm10 - startValues.pm10) * eased,
        co2: startValues.co2 + (data.co2 - startValues.co2) * eased,
        tvoc: startValues.tvoc + (data.tvoc - startValues.tvoc) * eased,
        hcho: startValues.hcho + (data.hcho - startValues.hcho) * eased,
        temp: startValues.temp + (data.temp - startValues.temp) * eased,
        humidity: startValues.humidity + (data.humidity - startValues.humidity) * eased,
      })

      if (progress < 1) requestAnimationFrame(animate)
    }

    animate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.pm25, data.pm10, data.co2, data.tvoc, data.hcho, data.temp, data.humidity])

  // Calculate Real AQI based on current data (CPCB Standards)
  const aqiData = calculateAQI({
    pm25: data.pm25,
    pm10: data.pm10,
  })
  const aqi = aqiData.aqi

  // Determine status based on AQI (CPCB Standards)
  const getAqiStatus = (aqiValue: number) => {
    if (aqiValue <= 50)
      return {
        text: "Good",
        color: "text-emerald-400",
        bg: "bg-emerald-500/20",
        border: "border-emerald-500/30",
        glow: "shadow-[0_0_20px_rgba(52,211,153,0.4)]",
      }
    if (aqiValue <= 100)
      return {
        text: "Satisfactory",
        color: "text-green-400",
        bg: "bg-green-500/20",
        border: "border-green-500/30",
        glow: "shadow-[0_0_20px_rgba(34,197,94,0.4)]",
      }
    if (aqiValue <= 200)
      return {
        text: "Moderate",
        color: "text-amber-400",
        bg: "bg-amber-500/20",
        border: "border-amber-500/30",
        glow: "shadow-[0_0_20px_rgba(251,191,36,0.4)]",
      }
    if (aqiValue <= 300)
      return {
        text: "Poor",
        color: "text-orange-400",
        bg: "bg-orange-500/20",
        border: "border-orange-500/30",
        glow: "shadow-[0_0_20px_rgba(249,115,22,0.4)]",
      }
    if (aqiValue <= 400)
      return {
        text: "Very Poor",
        color: "text-red-400",
        bg: "bg-red-500/20",
        border: "border-red-500/30",
        glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
      }
    return {
      text: "Severe",
      color: "text-purple-400",
      bg: "bg-purple-500/20",
      border: "border-purple-500/30",
      glow: "shadow-[0_0_20px_rgba(168,85,247,0.4)]",
    }
  }

  const status = getAqiStatus(aqi)

  return (
    <div
      ref={cardRef}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onExpand && onExpand();
        }
      }}
      onClick={onExpand}
      className={`${transparent ? 'bg-transparent border-none p-0 flex-1 h-full' : 'card-vibrant bg-slate-900/40 border ' + status.border + ' rounded-3xl ' + (compact ? 'p-1' : 'p-6') + ' backdrop-blur-md lg:backdrop-blur-xl'} relative overflow-hidden transition-all duration-200 lg:duration-1000 cursor-pointer hover:shadow-[0_0_30px_rgba(52,211,153,0.1)] active:scale-[0.99] flex flex-col ${transparent ? 'flex-1 h-full' : 'h-full'} ${isVisible ? "opacity-100" : "opacity-0"}`}
    >
      {/* Background Glow - hidden on mobile for performance */}
      {!transparent && (
        <div
          className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[100px] transition-colors duration-1000 ${status.bg} hidden sm:block`}
        />
      )}

      {!transparent && (
        <div className={`relative z-10 ${compact ? 'mb-3' : 'mb-8'} flex items-start justify-between`}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img
                src="/AQI.png"
                alt="AQI Logo"
                className="h-6 object-contain rounded-full"
              />
              <h2 className={`${compact ? 'text-[10px]' : 'text-sm'} font-semibold uppercase tracking-[0.2em] text-slate-400`}>Air Quality Index</h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`${compact ? 'text-3xl' : 'text-6xl'} font-bold tracking-tighter transition-colors duration-1000 ${status.color
                  } drop-shadow-lg`}
              >
                {aqi}
              </span>
              <div className={`rounded-full ${compact ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-xs'} font-bold uppercase tracking-wider ${status.bg} ${status.color}`}>
                {status.text}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onExpand && (
              <button
                onClick={(e) => { e.stopPropagation(); onExpand(); }}
                className="rounded-full bg-white/5 p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Grid of Pollutants */}
      <div className={`grid ${compact ? 'grid-cols-3 gap-1 flex-1 min-h-0' : 'grid-cols-2 gap-3 sm:grid-cols-3 flex-1 min-h-0'}`}>
        {[
          { key: "pm25", label: "PM2.5", value: animatedValues.pm25.toFixed(1), unit: "µg/m³", bg: "bg-orange-500", glow: "group-hover:shadow-[0_0_8px_rgba(249,115,22,0.6)]" },
          { key: "pm10", label: "PM10", value: animatedValues.pm10.toFixed(1), unit: "µg/m³", bg: "bg-amber-400", glow: "group-hover:shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
          { key: "co2", label: "CO2", value: animatedValues.co2.toFixed(0), unit: "ppm", bg: "bg-emerald-400", glow: "group-hover:shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
          { key: "tvoc", label: "TVOC", value: animatedValues.tvoc.toFixed(3), unit: "mg/m³", bg: "bg-purple-500", glow: "group-hover:shadow-[0_0_8px_rgba(168,85,247,0.6)]" },
          { key: "hcho", label: "HCHO", value: animatedValues.hcho.toFixed(3), unit: "mg/m³", bg: "bg-blue-500", glow: "group-hover:shadow-[0_0_8px_rgba(59,130,246,0.6)]" },
          { key: "temp", label: "TEMP", value: animatedValues.temp.toFixed(1), unit: "°C", bg: "bg-rose-500", glow: "group-hover:shadow-[0_0_8px_rgba(244,63,94,0.6)]" },
        ].map((item) => (
          <div
            key={item.key}
            onClick={(e) => {
              e.stopPropagation();
              onMetricSelect(item.key);
            }}
            className={`group cursor-pointer relative overflow-hidden rounded-xl border ${compact ? 'px-1.5 py-0.5' : 'p-3'} transition-all duration-200 lg:duration-300 active:scale-95 ${activeMetric === item.key
              ? "border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(52,211,153,0.3)] ring-1 ring-emerald-400"
              : "border-white/5 bg-slate-900/40 hover:border-emerald-500/30 hover:bg-slate-800/50 hover:shadow-[0_0_10px_rgba(52,211,153,0.1)]"
              }`}
          >
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between">
                <span className={`${compact ? 'text-[10.5px]' : 'text-[12.5px]'} uppercase tracking-[0.15em] font-black transition-colors ${activeMetric === item.key ? "text-emerald-300" : "text-slate-500"
                  }`}>
                  {item.label}
                </span>
                <div className={`w-2 h-2 rounded-full ${item.bg} ${item.glow} transition-all duration-300 shadow-sm`} />
              </div>
              <div className={`${compact ? 'mt-0.5' : 'mt-1.5'} flex items-baseline gap-1`}>
                <span className={`${compact ? 'text-2xl' : 'text-4xl'} font-black font-mono tracking-tighter transition-all duration-300 ${activeMetric === item.key ? "text-white" : "text-slate-100"
                  }`}>
                  {item.value}
                </span>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">{item.unit}</span>
              </div>
            </div>
            {activeMetric === item.key && (
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent pointer-events-none" />
            )}
          </div>
        ))}
      </div>

      {/* Embedded History Chart — hidden in compact mode */}
      {!compact && (
        <div className="mt-4 border-t border-white/5 pt-4 flex-1 min-h-[200px]">
          <MetricHistoryChart
            data={data.chartData.labels.map((l, i) => ({
              label: l,
              pm25: data.chartData.pm25[i],
              pm10: data.chartData.pm10[i],
              co2: data.chartData.co2[i],
              tvoc: data.chartData.tvoc[i],
              hcho: data.chartData.hcho?.[i] ?? 0,
              temp: data.chartData.temp?.[i] ?? 0,
              humidity: data.chartData.humidity?.[i] ?? 0,
            }))}
            activeMetric={activeMetric}
            onMetricSelect={onMetricSelect}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>
      )}
    </div>
  )
}
