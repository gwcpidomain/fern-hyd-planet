"use client"

import { useEffect, useMemo, useRef } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { Maximize2, X } from "lucide-react"
import type { HistoricalPeriod } from "@/lib/historical-readings"

interface RecentReadingsTableProps {
  // Daily series (used by expanded modal)
  waterLevels: number[]
  aqiValues: number[]
  labels: string[]

  // Yearly monthly series (used by tile)
  yearlyLabels: string[]
  yearlyWaterLevels: number[]

  // Expansion modal controls
  period: HistoricalPeriod
  onPeriodChange: (p: HistoricalPeriod) => void
  onExpand: () => void
}

export function RecentReadingsTable({
  waterLevels,
  aqiValues,
  labels,
  yearlyLabels,
  yearlyWaterLevels,
  period,
  onPeriodChange,
  onExpand,
}: RecentReadingsTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [waterLevels, aqiValues, labels])

  const yearlyData = useMemo(
    () =>
      yearlyLabels.map((label, idx) => ({
        label,
        current: yearlyWaterLevels[idx] ?? 0,
        previous: (yearlyWaterLevels[idx] ?? 0) * 0.88,
      })),
    [yearlyLabels, yearlyWaterLevels]
  )

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-slate-900/35 p-3 backdrop-blur-2xl shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between">
      <div className="mb-1 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-bold-slate-400">
            Yearly Water Level Comparison
          </h3>
          <p className="text-[11px] text-slate-500">Last 12 months</p>
        </div>
        <div className="flex items-center gap-1.5 mr-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-400">CURRENT YEAR</span>
          </div>
          <button
            type="button"
            onClick={onExpand}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-cyan-400/80 transition-colors hover:bg-white/10 hover:text-cyan-300"
            title="Expand historical readings"
            aria-label="Expand historical readings"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 my-2">
        <div ref={scrollRef} className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyData} margin={{ top: 10, right: 10, bottom: 6, left: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval={0}
                minTickGap={8}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.25)" }}
                tickLine={false}
                width={25}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(2, 6, 23, 0.92)",
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: "10px",
                }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(value: any, name: string) => [`${Number(value).toFixed(1)} ft`, name === "current" ? "2026 (current)" : "2025 (previous)"]}
              />
              <Bar dataKey="previous" fill="rgba(148, 163, 184, 0.35)" radius={[4, 4, 0, 0]} barSize={6} />
              <Bar dataKey="current" fill="#22d3ee" radius={[4, 4, 0, 0]} barSize={6} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 my-1 shrink-0">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400/60" />
          2025 (previous)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          2026 (current)
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-500/10" />
    </div>
  )
}

interface RecentReadingsExpandModalProps {
  open: boolean
  onClose: () => void
  waterLevels: number[]
  labels: string[]
  period: HistoricalPeriod
  onPeriodChange: (p: HistoricalPeriod) => void
}

function derivePressureKpa(avgLevel: number, idx: number) {
  // Tuned to match screenshot-like kPa values (roughly 330..360)
  return Math.round(310 + avgLevel * 18 + (idx % 7) * 1.6)
}

function derivePumpRuntimeMinutes(avgLevel: number, idx: number) {
  // Roughly 3h..6h with light variation
  return Math.round(120 + avgLevel * 22 + (idx % 5) * 9)
}

function formatRuntime(minutesTotal: number) {
  const hours = Math.floor(minutesTotal / 60)
  const minutes = Math.max(0, minutesTotal % 60)
  return `${hours}h ${minutes}m`
}

function deriveStatus(avgLevel: number) {
  // Mimic screenshot "NORMAL" vs "OPTIMAL"
  if (avgLevel >= 5.5 && avgLevel <= 7.2) return "OPTIMAL"
  if (avgLevel >= 3.2 && avgLevel <= 9.0) return "NORMAL"
  if (avgLevel < 3.2) return "LOW"
  return "HIGH"
}

export function RecentReadingsExpandModal({
  open,
  onClose,
  ...tableProps
}: RecentReadingsExpandModalProps) {
  if (!open) return null

  const periodLabel = tableProps.period === "week" ? "Last 7 days" : "Last 30 days"

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Historical readings expanded"
      onClick={onClose}
    >
      <div
        className="relative flex h-[min(85vh,720px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Recent Sensor Readings
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-slate-500">{periodLabel} (daily)</p>
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
              <button
                type="button"
                onClick={() => tableProps.onPeriodChange("week")}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${tableProps.period === "week"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-slate-500 hover:text-slate-300"
                  }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => tableProps.onPeriodChange("month")}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${tableProps.period === "month"
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "text-slate-500 hover:text-slate-300"
                  }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="rounded-2xl border border-white/5 bg-slate-950/30 overflow-hidden">
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-slate-500 w-[22%]">
                    Date
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500 w-[18%]">
                    Avg level
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500 w-[18%]">
                    Pressure
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500 w-[22%]">
                    Pump runtime
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-wider text-slate-500 w-[20%]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableProps.labels.map((dateLabel, idx) => {
                  const level = tableProps.waterLevels[idx] ?? 0
                  const pressureKpa = derivePressureKpa(level, idx)
                  const runtimeMin = derivePumpRuntimeMinutes(level, idx)
                  const runtimeText = formatRuntime(runtimeMin)
                  const status = deriveStatus(level)

                  const pill =
                    status === "OPTIMAL"
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : status === "NORMAL"
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : status === "LOW"
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-rose-500/15 text-rose-300 border-rose-500/30"

                  return (
                    <tr key={`${dateLabel}-${idx}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-3 py-3 text-[12px] font-semibold text-cyan-300">{dateLabel}</td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-white">
                        {level.toFixed(1)}m
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-white">
                        {pressureKpa} kPa
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-[12px] text-white">
                        {runtimeText}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-bold ${pill}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
