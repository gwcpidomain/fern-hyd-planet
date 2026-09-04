"use client"

import { WaterDonutChart } from "../charts/water-donut-chart"
import { SpeedometerGauge } from "../environmental-core"
import { Droplets, Gauge } from "lucide-react"

interface WaterAnalysisSplitProps {
  waterData: any
  maxWaterLevel: number
  waterStatus: any
  isMotorOn?: boolean
}

export function WaterAnalysisSplit({ waterData, maxWaterLevel, waterStatus, isMotorOn = false }: WaterAnalysisSplitProps) {
  return (
    <div className="dash-tile relative flex h-full flex-col lg:flex-row overflow-hidden rounded-2xl bg-[rgba(8,15,38,0.45)] border border-white/[0.11] group shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] transition-all duration-200">
      {/* Background Glow */}
      <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full blur-[80px] bg-cyan-500/10 pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-700" />

      {/* Left: WQI Analysis (50%) */}
      <div className="w-full h-[200px] lg:h-auto lg:w-[50%] shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 pt-1 px-3 pb-2 flex flex-col">
        <div className="flex items-center justify-center gap-1.5 mb-1.5 border-b border-white/10 pb-1">
          <Droplets className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.20em] text-cyan-400">
            WQI Analysis
          </h3>
        </div>
        <div className="flex-1 min-h-0">
          <WaterDonutChart waterData={waterData} transparent={true} sideBySide={true} />
        </div>
      </div>

      {/* Right: Pump Monitor (50%) */}
      <div className="w-full h-[200px] lg:h-auto lg:w-[50%] shrink-0 pt-1 px-2 pb-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-center gap-1.5 mb-1.5 border-b border-white/10 pb-1 w-full">
          <Gauge className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.20em] text-cyan-400">
            Pump Monitor
          </h3>
        </div>
        <div className="flex-1 min-h-0 w-full flex items-center justify-center">
          <SpeedometerGauge
            value={Number.isFinite(waterData?.level ?? 0) ? Number((waterData?.level ?? 0).toFixed(2)) : 0}
            maxValue={Number.isFinite(maxWaterLevel) ? Number(maxWaterLevel.toFixed(2)) : 0}
            status={waterStatus ?? undefined}
            irms={waterData?.irms ?? 0}
            pumpStatus={waterData?.pump_status ?? waterData?.currentStatus ?? 'N/A'}
            isMotorOn={isMotorOn}
          />
        </div>
      </div>
    </div>
  )
}
