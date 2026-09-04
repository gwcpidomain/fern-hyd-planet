"use client"

import { useState } from "react"
import { AirQualityCard } from "./air-quality-card"
import { MetricHistoryChart } from "./charts/aqi-forecast-chart"
import { PollutantDonutChart } from "./charts/pollutant-donut-chart"
import { calculateAQI } from "@/utils/aqi-calculator"
import { X, Activity, BarChart3, PieChart as PieChartIcon, ArrowDownCircle } from "lucide-react"
import { type TimeRange } from "@/utils/data-simulator"

interface AQIPollutantHubProps {
  data: any
  activeMetric: string | null
  onMetricSelect: (metric: string | null) => void
  isOffline: boolean
  mode?: 'full' | 'compact'
  onExpand?: () => void
  timeRange?: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
}

export function AQIPollutantHub({ 
  data, 
  activeMetric, 
  onMetricSelect, 
  isOffline, 
  mode = 'full', 
  onExpand,
  timeRange: propTimeRange,
  onTimeRangeChange: propOnTimeRangeChange
}: AQIPollutantHubProps) {
  const [isInternalExpanded, setIsInternalExpanded] = useState(false)
  const [localTimeRange, setLocalTimeRange] = useState<TimeRange>("1h")

  const timeRange = propTimeRange || localTimeRange
  const setTimeRange = propOnTimeRangeChange || setLocalTimeRange


  // Calculate Real AQI for the big header
  const aqiData = calculateAQI({
    pm25: data.pm25,
    pm10: data.pm10,
  })
  const aqi = aqiData.aqi

  const getAqiStatus = (val: number) => {
    if (val <= 50) return { text: "GOOD", color: "text-emerald-400", bg: "bg-emerald-500/20" }
    if (val <= 100) return { text: "SATISFACTORY", color: "text-green-400", bg: "bg-green-500/20" }
    if (val <= 200) return { text: "MODERATE", color: "text-amber-400", bg: "bg-amber-500/20" }
    if (val <= 300) return { text: "POOR", color: "text-orange-400", bg: "bg-orange-500/20" }
    if (val <= 400) return { text: "VERY POOR", color: "text-red-400", bg: "bg-red-500/20" }
    return { text: "SEVERE", color: "text-purple-400", bg: "bg-purple-500/20" }
  }

  const status = getAqiStatus(aqi)


  return (
    <>
      <div
        className={`dash-tile relative flex h-full flex-col items-start overflow-hidden rounded-2xl bg-[rgba(8,15,38,0.45)] border border-white/[0.11] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] ${mode === 'compact' ? 'h-full' : ''}`}
      >
        {/* Header Section - Extreme Top Left */}
        <div className="w-full shrink-0 px-3 pt-2 pb-1 border-b border-white/5 bg-white/[0.02] text-left">
          <div className="flex items-center justify-between mb-1 w-full">
            <div className="flex items-center gap-2">
              <img src="/LOGOS/AQI.png" alt="AQI Logo" className="h-4 w-4 object-contain" />
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
                AQI Pollutant Level
              </h3>
            </div>
          </div>
          <div className="flex items-baseline gap-2 w-full">
            <span className={`text-2xl font-bold tracking-tighter ${status.color}`}>
              {aqi}
            </span>
            <div className={`px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase tracking-wider border border-current ${status.bg} ${status.color}`}>
              {status.text}
            </div>
          </div>
        </div>

        {/* Values & Tiles */}
        <div className="w-full flex-1 overflow-hidden px-2 py-1 flex flex-col">
          <AirQualityCard
            data={data}
            activeMetric={activeMetric}
            onMetricSelect={onMetricSelect}
            isOffline={isOffline}
            compact
            transparent
          />
        </div>

        {/* Embedded Chart (Hidden if compact mode) */}
        {mode === 'full' && (
          <div className="flex-1 bg-white/[0.01] mt-4">
            <MetricHistoryChart
              data={(data.chartData?.labels || []).map((l: string, i: number) => ({
                label: l,
                pm25: data.chartData?.pm25?.[i] ?? 0,
                pm10: data.chartData?.pm10?.[i] ?? 0,
                co2: data.chartData?.co2?.[i] ?? 0,
                tvoc: data.chartData?.tvoc?.[i] ?? 0,
                hcho: data.chartData?.hcho?.[i] ?? 0,
                temp: data.chartData?.temp?.[i] ?? 0,
                humidity: data.chartData?.humidity?.[i] ?? 0
              }))}
              activeMetric={activeMetric}
              onMetricSelect={onMetricSelect}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              compact
            />
          </div>
        )}
      </div>

      {/* EXPANDED DIAGNOSTIC OVERLAY */}
      {isInternalExpanded && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="relative w-[90vw] h-[90vh] bg-slate-950/80 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">

            {/* Header Overlay */}
            <div className="flex-none p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/40">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Activity className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-widest uppercase">Atmospheric Diagnostics</h2>                </div>
              </div>
              <button
                onClick={() => setIsInternalExpanded(false)}
                className="p-3 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Split View: 75% Line Chart | 25% Pie Chart */}
            <div className="flex-1 flex overflow-hidden p-4 gap-4">

              {/* Left: Line Chart (75%) */}
              <div className="w-3/4 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-2">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Live Analysis</span>
                </div>
                <div className="flex-1 bg-slate-900/30 rounded-2xl border border-white/5 p-4 relative">
                  <MetricHistoryChart
                    data={(data.chartData?.labels || []).map((l: string, i: number) => ({
                      label: l,
                      pm25: data.chartData?.pm25?.[i] ?? 0,
                      pm10: data.chartData?.pm10?.[i] ?? 0,
                      co2: data.chartData?.co2?.[i] ?? 0,
                      tvoc: data.chartData?.tvoc?.[i] ?? 0,
                      hcho: data.chartData?.hcho?.[i] ?? 0,
                      temp: data.chartData?.temp?.[i] ?? 0,
                      humidity: data.chartData?.humidity?.[i] ?? 0
                    }))}
                    activeMetric={activeMetric}
                    onMetricSelect={onMetricSelect}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                  />
                </div>
              </div>

              {/* Right: Pie Chart + Verdict (25%) */}
              <div className="w-1/4 flex flex-col gap-3 border-l border-white/5 pl-4">
                <div className="flex items-center gap-2 px-1">
                  <PieChartIcon className="h-4 w-4 text-cyan-400" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Source Analysis</span>
                </div>
                <div className="flex-1 flex items-center justify-center bg-slate-900/20 rounded-2xl border border-white/5 p-3">
                  <PollutantDonutChart airData={data} transparent />
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-emerald-400 text-[10px] font-black uppercase mb-1">Automated Verdict</h4>
                  <p className="text-slate-300 text-[10px] leading-relaxed font-medium">
                    <span className="text-white font-bold">PM2.5</span> is the primary atmospheric load. Filtration advised if safety score drifts below 65%.
                  </p>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}
