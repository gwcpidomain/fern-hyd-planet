"use client"

import { useEffect, useState, useMemo } from "react"
import { Chart } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Title, Tooltip, Legend, Filler)

interface WaterQualityData {
  level: number
  ph: number
  tds: number
  waterStatus?: string
  tdsStatus?: string
  turbidity?: number
  turbidityStatus?: string
  chartData: {
    labels: string[]
    level: number[]
    ph: number[]
    tds: number[]
    turbidity?: number[]
  }
}

import { generateWaterHistory, generateTimeLabels, type TimeRange } from "@/utils/data-simulator"

interface WaterQualityCardProps {
  data: WaterQualityData
  activeMetric: string | null
  onMetricSelect: (metric: string | null) => void
  onExpand?: () => void
  isOffline?: boolean
  compact?: boolean
  isMotorOn?: boolean
  mode?: "full" | "bar-only" | "line-only"
  transparent?: boolean
}

export function WaterQualityCard({
  data,
  activeMetric,
  onMetricSelect,
  onExpand,
  isOffline = false,
  compact = false,
  mode,
  transparent = false,
  isMotorOn = false
}: WaterQualityCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredMetric, setHoveredMetric] = useState<string | null>(null)
  const [animatedValues, setAnimatedValues] = useState({
    level: 0,
    ph: 0,
    tds: 0,
    turbidity: 0,
  })

  useEffect(() => {
    setIsVisible(true)
  }, [])

  useEffect(() => {
    const duration = 1200
    const startTime = Date.now()
    const startValues = { ...animatedValues }

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      setAnimatedValues({
        level: startValues.level + (data.level - startValues.level) * eased,
        ph: startValues.ph + (data.ph - startValues.ph) * eased,
        tds: startValues.tds + (data.tds - startValues.tds) * eased,
        turbidity: startValues.turbidity + ((data.turbidity !== undefined ? data.turbidity : 1.2) - startValues.turbidity) * eased,
      })

      if (progress < 1) requestAnimationFrame(animate)
    }

    animate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.level, data.ph, data.tds, data.turbidity])

  // ==========================================
  // STATIC BAR CHART PREPARATION (OLD STYLE)
  // ==========================================
  /* Short labels so x-axis fits without clipping in tight tiles */
  const allLabels = ["Level", "pH", "TDS", "Turbidity"]
  const allLineData = [animatedValues.level, animatedValues.ph, animatedValues.tds, animatedValues.turbidity]
  const allBarData = [animatedValues.level, animatedValues.ph, animatedValues.tds, animatedValues.turbidity]

  const barChartData = {
    labels: allLabels,
    datasets: [
      {
        type: 'line' as const,
        label: 'Trend',
        data: allLineData,
        borderColor: "rgba(143, 211, 255, 0.5)",
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 6,
        pointBackgroundColor: [
          (activeMetric === null || activeMetric === "level" || hoveredMetric === "level") ? "rgba(143, 211, 255, 1)" : "rgba(143, 211, 255, 0.1)",
          (activeMetric === null || activeMetric === "ph" || hoveredMetric === "ph") ? "rgba(124, 255, 154, 1)" : "rgba(124, 255, 154, 0.1)",
          (activeMetric === null || activeMetric === "tds" || hoveredMetric === "tds") ? "rgba(255, 211, 106, 1)" : "rgba(255, 211, 106, 0.1)",
          (activeMetric === null || activeMetric === "turbidity" || hoveredMetric === "turbidity") ? "rgba(168, 85, 247, 1)" : "rgba(168, 85, 247, 0.1)",
        ],
        pointBorderColor: "#0f172a",
        pointBorderWidth: 2,
        order: 0,
      },
      {
        type: 'bar' as const,
        label: 'Value',
        data: allBarData,
        backgroundColor: [
          (activeMetric === null || activeMetric === "level" || hoveredMetric === "level") ? "rgba(6, 182, 212, 1)" : "rgba(6, 182, 212, 0.1)",
          (activeMetric === null || activeMetric === "ph" || hoveredMetric === "ph") ? "rgba(34, 197, 94, 1)" : "rgba(34, 197, 94, 0.1)",
          (activeMetric === null || activeMetric === "tds" || hoveredMetric === "tds") ? "rgba(251, 191, 36, 1)" : "rgba(251, 191, 36, 0.1)",
          (activeMetric === null || activeMetric === "turbidity" || hoveredMetric === "turbidity") ? "rgba(168, 85, 247, 1)" : "rgba(168, 85, 247, 0.1)",
        ],
        borderRadius: 8,
        barThickness: 35,
        order: 1,
      }
    ]
  }

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { top: 8, right: 10, bottom: 28, left: 8 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(2, 6, 23, 0.9)",
        titleColor: "#94a3b8",
        bodyColor: "#f1f5f9",
        borderColor: "rgba(148, 163, 184, 0.1)",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context: any) => `Value: ${context.parsed.y?.toFixed(2) ?? 'N/A'}`,
        },
      }
    },
    scales: {
      x: {
        offset: true,
        ticks: {
          color: "#94a3b8",
          font: { size: 10 },
          maxRotation: 0,
          autoSkip: false,
        },
        grid: { display: false },
        border: { display: true, color: "rgba(148, 163, 184, 0.25)" },
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 10 } },
        beginAtZero: true,
        grace: "5%",
        grid: { color: "rgba(148, 163, 184, 0.08)" },
        border: { display: true, color: "rgba(148, 163, 184, 0.25)" },
      },
    },
    animation: {
      duration: 750,
      easing: "easeInOutQuart" as const,
    }
  }

  // ==========================================
  // LIVE TIME-SERIES CHART PREPARATION
  // ==========================================
  // Determine which metric to show on the live chart
  const chartMetric = activeMetric || "level"
  const metricConfig: Record<string, { label: string; shortLabel: string; color: string; bgColor: string; unit: string }> = {
    level: { label: "Water Level", shortLabel: "Water Level", color: "rgb(34, 211, 238)", bgColor: "rgba(34, 211, 238, 0.1)", unit: "ft" },
    ph: { label: "pH Level", shortLabel: "pH", color: "rgb(74, 222, 128)", bgColor: "rgba(74, 222, 128, 0.1)", unit: "" },
    tds: { label: "TDS", shortLabel: "TDS", color: "rgb(251, 191, 36)", bgColor: "rgba(251, 191, 36, 0.1)", unit: "ppm" },
    turbidity: { label: "Turbidity", shortLabel: "Turbidity", color: "rgb(168, 85, 247)", bgColor: "rgba(168, 85, 247, 0.1)", unit: "NTU" },
  }
  const cfg = metricConfig[chartMetric] || metricConfig.level

  // ==========================================
  // SIMULATION / HISTORY PREPARATION
  // ==========================================
  const simulatedHistory = useMemo(() => {
    const hasLiveHistory = data.chartData?.level && data.chartData.level.length >= 2;
    if (hasLiveHistory) {
      const labels = (data.chartData?.labels || []).map(l => {
        const normalized = l.includes(' ') && !l.includes('T') ? l.replace(' ', 'T') + 'Z' : l;
        const d = new Date(normalized);
        return !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : l;
      });
      return {
        labels,
        level: data.chartData?.level || [],
        ph: data.chartData?.ph || [],
        tds: data.chartData?.tds || [],
        turbidity: data.chartData?.turbidity || [],
        flow: (data.chartData as any)?.flowRate || (data.chartData as any)?.flow || []
      };
    }

    return {
      labels: [],
      level: [],
      ph: [],
      tds: [],
      turbidity: [],
      flow: []
    };
  }, [data]);

  const timeLabels = simulatedHistory.labels;
  const chartValues = (simulatedHistory as any)?.[chartMetric] || [];
  const isOverlayChart = mode === "line-only"
  const overlaySeries = [
    { key: "level", yAxisID: "yLevel", ...metricConfig.level },
    { key: "ph", yAxisID: "yPh", ...metricConfig.ph },
    { key: "tds", yAxisID: "yTds", ...metricConfig.tds },
    { key: "turbidity", yAxisID: "yTurbidity", ...metricConfig.turbidity },
  ]

  const liveChartData = {
    labels: timeLabels,
    datasets: isOverlayChart
      ? overlaySeries.map((series) => {
          const emphasized = !activeMetric || activeMetric === series.key
          return {
            label: `${series.shortLabel}${series.unit ? ` (${series.unit})` : ""}`,
            data: (simulatedHistory as any)?.[series.key] || [],
            yAxisID: series.yAxisID,
            borderColor: emphasized ? series.color : series.color.replace("rgb(", "rgba(").replace(")", ", 0.28)"),
            backgroundColor: "transparent",
            borderWidth: emphasized ? 2.2 : 1.3,
            tension: 0.4,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: series.color,
            pointHoverBorderColor: "#0f172a",
            pointHoverBorderWidth: 2,
          }
        })
      : [
          {
            label: `${cfg.label} ${cfg.unit ? `(${cfg.unit})` : ''}`,
            data: chartValues,
            borderColor: cfg.color,
            backgroundColor: (context: any) => {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return cfg.bgColor;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              const rgbMatch = cfg.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              if (rgbMatch) {
                const [, r, g, b] = rgbMatch;
                gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.45)`);
                gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.12)`);
                gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
              } else {
                gradient.addColorStop(0, cfg.bgColor);
                gradient.addColorStop(1, 'transparent');
              }
              return gradient;
            },
            borderWidth: 2.5,
            tension: 0.45,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: cfg.color,
            pointHoverBorderColor: "#0f172a",
            pointHoverBorderWidth: 2,
          },
        ],
  }

  const liveChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: isOverlayChart,
        position: "top" as const,
        align: "end" as const,
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          padding: 8,
          color: "#94a3b8",
          font: { size: 9, weight: 700 as const },
        },
      },
      tooltip: {
        backgroundColor: "rgba(2, 6, 23, 0.9)",
        titleColor: "#94a3b8",
        bodyColor: "#f1f5f9",
        borderColor: "rgba(148, 163, 184, 0.1)",
        borderWidth: 1,
        padding: 8,
        displayColors: isOverlayChart,
        callbacks: {
          label: (context: any) => {
            if (isOverlayChart) {
              return `${context.dataset.label}: ${context.parsed.y?.toFixed(2) ?? "N/A"}`
            }
            return `${cfg.label}: ${context.parsed.y?.toFixed(1) ?? 'N/A'} ${cfg.unit}`
          },
        }
      },
    },
    scales: isOverlayChart
      ? {
          x: {
            ticks: { color: "#475569", font: { size: 9 }, maxTicksLimit: 6 },
            grid: { display: false },
            border: { display: false },
          },
          yLevel: {
            type: "linear" as const,
            display: true,
            position: "left" as const,
            ticks: { display: false },
            grace: "12%",
            grid: { color: "rgba(148, 163, 184, 0.06)" },
            border: { display: false },
          },
          yPh: {
            type: "linear" as const,
            display: false,
            position: "left" as const,
            grace: "12%",
            grid: { drawOnChartArea: false },
          },
          yTds: {
            type: "linear" as const,
            display: false,
            position: "right" as const,
            grace: "12%",
            grid: { drawOnChartArea: false },
          },
          yTurbidity: {
            type: "linear" as const,
            display: false,
            position: "right" as const,
            grace: "12%",
            grid: { drawOnChartArea: false },
          },
        }
      : {
          x: {
            ticks: { color: "#475569", font: { size: 9 }, maxTicksLimit: 6 },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            title: {
              display: true,
              text: `${cfg.label} ${cfg.unit ? `(${cfg.unit})` : ''}`,
              color: "#64748b",
              font: { size: 9, weight: "bold" as any }
            },
            ticks: { color: "#475569", font: { size: 9 } },
            beginAtZero: false,
            grace: "10%",
            grid: { color: "rgba(148, 163, 184, 0.05)" },
            border: { display: false },
          },
        },
    animation: { duration: 500 },
  }

  // Visibility flags based on mode
  const showTiles = !mode || mode === "full"
  const showBar = mode === "bar-only" || ((!mode || mode === "full") && !compact)
  const showLiveChart = mode === "line-only" || ((!mode || mode === "full") && !compact)
  const cardTitle = isOverlayChart ? "Water Quality Trend" : `${cfg.shortLabel || cfg.label} Trend`

  const metrics = [
    {
      key: "level",
      label: "Ground\nWater Level",
      value: animatedValues.level.toFixed(1),
      unit: "ft",
      color: "text-cyan-400",
      hoverColor: "text-cyan-300",
      glow: "drop-shadow-[0_0_10px_rgba(143,211,255,0.5)]",
      bgGlow: "shadow-[0_0_25px_rgba(143,211,255,0.3)]"
    },
    {
      key: "ph",
      label: "pH Level",
      value: animatedValues.ph.toFixed(1),
      range: data.waterStatus ? `Status: ${data.waterStatus}` : "Within 6.5 - 8.5",
      color: "text-emerald-400",
      hoverColor: "text-emerald-300",
      glow: "drop-shadow-[0_0_10px_rgba(124,255,154,0.5)]",
      bgGlow: "shadow-[0_0_25px_rgba(124,255,154,0.3)]"
    },
    {
      key: "tds",
      label: "TDS",
      value: animatedValues.tds.toFixed(0),
      unit: "ppm",
      range: data.tdsStatus ? `Status: ${data.tdsStatus}` : "Within 0 - 300",
      color: "text-amber-400",
      hoverColor: "text-amber-300",
      glow: "drop-shadow-[0_0_10px_rgba(255,211,106,0.5)]",
      bgGlow: "shadow-[0_0_25px_rgba(255,211,106,0.3)]"
    },
    {
      key: "turbidity",
      label: "Turbidity",
      value: animatedValues.turbidity.toFixed(1),
      unit: "NTU",
      range: data.turbidityStatus ? `Status: ${data.turbidityStatus}` : "Clear (< 200)",
      color: "text-purple-400",
      hoverColor: "text-purple-300",
      glow: "drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]",
      bgGlow: "shadow-[0_0_25px_rgba(168,85,247,0.3)]"
    },
  ]

  return (
    <div
      className={`${transparent ? '' : 'dash-tile relative h-full w-full overflow-hidden rounded-2xl border border-white/[0.11] bg-[rgba(8,15,38,0.45)] p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]'} group flex min-h-0 flex-col transition-all duration-200 ${isVisible ? "opacity-100" : "opacity-0"
        }`}
      style={{ transitionDelay: "100ms" }}
    >
      {/* Animated background - removed to match Yearly Comparison style */}

      {!transparent && (
        <div className="relative z-10 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/humidity.png"
              alt="Water Logo"
              className="h-6 object-contain rounded-full"
            />
            <h2 className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-[14px] sm:text-[15px] font-bold uppercase tracking-[0.15em] text-transparent whitespace-nowrap">
              {cardTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Metric Selector Tabs (Replaces 1h | 24h | 7d) */}
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/5 overflow-x-auto max-w-[280px] sm:max-w-none">
              {[
                { key: "level", label: "Water Level" },
                { key: "ph", label: "pH" },
                { key: "tds", label: "TDS" },
                { key: "turbidity", label: "Turbidity" },
              ].map((tab) => {
                const isSelected = isOverlayChart
                  ? activeMetric === tab.key
                  : (activeMetric || "level") === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isOverlayChart && activeMetric === tab.key) {
                        onMetricSelect(null);
                      } else {
                        onMetricSelect(tab.key);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase whitespace-nowrap transition-all ${
                      isSelected
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Metrics Grid — hidden in bar-only / line-only modes */}
      {showTiles && <div className={`relative z-10 mt-3 mb-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5`}>
        {metrics.map((m, i) => (
          <div
            key={m.label}
            onClick={(e) => {
              e.stopPropagation();
              onMetricSelect(m.key === activeMetric ? null : m.key);
            }}
            className={`group/item cursor-pointer rounded-xl border p-3 text-center backdrop-blur-sm transition-all duration-200 ${(activeMetric === m.key)
              ? `border-cyan-500/50 bg-cyan-500/10 ${m.bgGlow}`
              : "border-white/5 bg-slate-900/50 hover:border-cyan-500/30 hover:bg-slate-800/50 opacity-80 hover:opacity-100"
              }`}
            style={{ animationDelay: `${i * 100}ms` }}
            onMouseEnter={() => setHoveredMetric(m.key)}
            onMouseLeave={() => setHoveredMetric(null)}
          >
            <div className={`mb-1 whitespace-pre-line text-[9px] font-semibold uppercase tracking-wider transition-colors ${activeMetric === m.key ? "text-cyan-300" : "text-slate-500"
              }`}>
              {m.label}
            </div>
            <div
              className={`text-2xl font-bold transition-all duration-300 ${(activeMetric === m.key || hoveredMetric === m.key) ? `${m.hoverColor} ${m.glow}` : `${m.color} ${m.glow}`
                }`}
            >
              {m.value}
            </div>
            {m.unit && <div className="text-[10px] text-slate-500">{m.unit}</div>}
            {m.range && <div className="text-[8px] text-slate-500">{m.range}</div>}
          </div>
        ))}
      </div>}

      {/* Bar Chart Section — visible in bar-only mode or full non-compact */}
      {showBar && (
        <div
          className={`relative z-10 mb-4 flex min-h-0 flex-1 flex-col ${mode === "bar-only" ? "min-h-[160px]" : "min-h-[140px]"}`}
        >
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Water Quality
            </h3>
            {activeMetric && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMetricSelect(null);
                }}
                className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-wider"
              >
                Show All Metrics
              </button>
            )}
          </div>
          {/* Explicit height so Chart.js (maintainAspectRatio: false) reserves space for x/y ticks */}
          <div
            className={`relative w-full flex-1 ${mode === "bar-only" ? "min-h-[180px]" : "min-h-[160px]"}`}
          >
            <Chart type="bar" data={barChartData} options={barChartOptions as any} />
          </div>
        </div>
      )}

      {/* Embedded Live Time-Series Chart — visible in line-only mode or full non-compact */}
      {showLiveChart && (
        <div className={`relative z-10 flex-1 flex flex-col min-h-[160px] ${mode === "line-only" ? "" : "mt-4 border-t border-white/5 pt-4"}`}>
          <div className="flex-1 h-[160px] min-h-[140px]">
            <Chart type="line" data={liveChartData} options={liveChartOptions as any} />
          </div>
        </div>
      )}

      {/* Animated border */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-cyan-500/10 transition-colors duration-300 group-hover:border-cyan-500/30" />
    </div>
  )
}