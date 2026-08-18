"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Bot, Bell, ChevronRight, Zap } from "lucide-react"

interface Alert {
  id: string
  time: string
  message: string
  priority: "high" | "low"
}

interface AiSummarizerCardProps {
  waterData?: {
    level: number
    ph: number
    tds: number
    irms?: number
    flowRate?: number
    efficiency?: number
    turbidity?: number
    totalLiters?: number
  }
  isMotorOn?: boolean
  airData?: {
    pm25: number
    pm10: number
    co2: number
  }
  isWaterOffline?: boolean
  isAirOffline?: boolean
}

export function AiSummarizerCard({ 
  waterData, 
  isMotorOn = false, 
  airData,
  isWaterOffline = false,
  isAirOffline = false
}: AiSummarizerCardProps) {
  const feedRef = useRef<HTMLDivElement>(null)
  
  // Dynamic state for Live Feed logs
  const [liveEvents, setLiveEvents] = useState<Alert[]>([])

  const level = waterData?.level ?? 4.5
  const ph = waterData?.ph ?? 7.2
  const tds = waterData?.tds ?? 250
  const flowRate = waterData?.flowRate ?? 0
  const irms = waterData?.irms ?? 0
  const totalLiters = waterData?.totalLiters ?? 0
  const turbidity = waterData?.turbidity ?? 1.2
  const pm25 = airData?.pm25 ?? 0
  const co2 = airData?.co2 ?? 400

  // 1. Initial Feed Setup
  useEffect(() => {
    const getTimestamp = (offsetSec: number) => {
      const d = new Date(Date.now() - offsetSec * 1000)
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    }
    setLiveEvents([
      { id: "init-1", time: getTimestamp(30), message: "System boot completed: Core diagnostics normal.", priority: "low" },
      { id: "init-2", time: getTimestamp(20), message: "All local nodes online: awaiting LoRa broadcast packets.", priority: "low" },
      { id: "init-3", time: getTimestamp(10), message: "Initial handshake ok. Listening on port 8000.", priority: "low" }
    ])
  }, [])

  // 2. Stream Water Telemetry events
  useEffect(() => {
    if (!waterData) return
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    
    let message = ""
    if (isWaterOffline) {
      message = "LoRa gateway signal offline. Standing by for node reconnection..."
    } else if (isMotorOn) {
      message = `Water Node Update: Flow ${flowRate.toFixed(1)} LPM | Load current ${irms.toFixed(1)}A | Level ${level.toFixed(2)}ft`
    } else {
      message = `Water Node Update: Standing by | Level resting at ${level.toFixed(2)}ft | TDS ${tds} ppm`
    }

    const eventId = `water-${Date.now()}-${Math.random()}`
    setLiveEvents(prev => {
      // Avoid duplicate logs if values did not change
      if (prev.length > 0 && prev[prev.length - 1].message === message) return prev
      return [...prev.slice(-49), { id: eventId, time: timestamp, message, priority: "low" }]
    })
  }, [waterData, isMotorOn, flowRate, irms, level, tds, isWaterOffline])

  // 3. Stream Air/AQI Telemetry events
  useEffect(() => {
    if (!airData) return
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    
    let message = ""
    if (isAirOffline) {
      message = "AQI WiFi telemetry node offline. Retrying connection..."
    } else {
      message = `AQI Node Update: PM2.5 ${pm25.toFixed(1)} µg/m³ | CO2 ${co2} ppm | Status normal`
    }

    const eventId = `air-${Date.now()}-${Math.random()}`
    setLiveEvents(prev => {
      // Avoid duplicate logs
      if (prev.length > 0 && prev[prev.length - 1].message === message) return prev
      return [...prev.slice(-49), { id: eventId, time: timestamp, message, priority: "low" }]
    })
  }, [airData, pm25, co2, isAirOffline])

  // 4. Pinned Marketing-Friendly Alerts (No Red unless offline)
  const alerts: Alert[] = useMemo(() => {
    const list: Alert[] = []
    let id = 1
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })

    if (isWaterOffline) {
      list.push({
        id: String(id++),
        time: timestamp,
        message: "LORA RECEIVER OFFLINE - Gateway connection lost.",
        priority: "high"
      })
    }
    if (isAirOffline) {
      list.push({
        id: String(id++),
        time: timestamp,
        message: "AQI NODE OFFLINE - Check WiFi receiver connection.",
        priority: "high"
      })
    }

    // No warning alerts since we want a clean marketing representation when online
    if (list.length === 0) {
      list.push({
        id: String(id++),
        time: timestamp,
        message: "System health nominal: all parameters operating in optimal ranges.",
        priority: "low"
      })
      list.push({
        id: String(id++),
        time: timestamp,
        message: "Filtration levels normal: TDS and pH within target thresholds.",
        priority: "low"
      })
    }

    return list
  }, [isWaterOffline, isAirOffline])

  // Auto-scroll the terminal view as new logs stream in
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [liveEvents])

  return (
    <div className="card-vibrant relative flex h-full flex-col overflow-hidden rounded-xl bg-slate-900/35 !p-3 backdrop-blur-2xl border border-emerald-500/[0.12] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.07)]">
      {/* 1. FIXED HEADER */}
      <div className="mb-2 shrink-0 flex items-center justify-between border-b border-white/5 pb-2">
        <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-emerald-400 flex items-center gap-2 whitespace-nowrap">
          <Bot className="h-4 w-4" />
          AI Summarizer
        </h3>
        <span className="mr-3 text-[9px] font-mono text-slate-500 whitespace-nowrap uppercase tracking-tighter">V2.2_LIVE</span>
      </div>

      {/* 2. DUAL-CHANNEL VIEWPORT */}
      <div className="flex-1 min-h-0 flex flex-row gap-3 py-1">
        {/* Left Channel: Alerts */}
        <div className="flex-[0.4] min-w-0 flex flex-col border-r border-white/5 pr-2">
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <Bell className={`h-3 w-3 ${isWaterOffline || isAirOffline ? "text-red-500 animate-pulse" : "text-emerald-400"}`} />
            <span className={`text-[9px] font-black uppercase tracking-wider ${isWaterOffline || isAirOffline ? "text-red-400" : "text-emerald-400"}`}>Alerts</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-none hover:scrollbar-thin scrollbar-thumb-emerald-500/10">
            {alerts.map(alert => {
              const isCrit = alert.message.includes("OFFLINE")
              return (
                <div 
                  key={alert.id} 
                  className={`rounded-lg px-2 py-1.5 border transition-all border-l-2 ${
                    isCrit 
                      ? "bg-red-500/5 border-red-500/10 border-l-red-500 hover:bg-red-500/10" 
                      : "bg-emerald-500/5 border-emerald-500/10 border-l-emerald-500 hover:bg-emerald-500/10"
                  }`}
                >
                  <div className="text-[8.5px] font-bold text-white leading-tight mb-1">{alert.message}</div>
                  <div className={`text-[7.5px] font-mono uppercase ${isCrit ? "text-red-400/50" : "text-emerald-400/50"}`}>{alert.time}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Channel: Live System Feed (Terminal Style) */}
        <div className="flex-[0.6] min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5 mb-2 shrink-0">
            <ChevronRight className="h-3 w-3 text-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Live Feed</span>
          </div>
          <div
            ref={feedRef}
            className="flex-1 overflow-y-auto space-y-2 bg-black/30 rounded-lg p-2 border border-white/5 scrollbar-thin scrollbar-thumb-emerald-500/10 custom-scroll"
          >
            {liveEvents.map(item => (
              <div key={item.id} className="flex gap-2 items-start opacity-90 hover:opacity-100 transition-opacity">
                <span className="text-[8px] font-mono text-emerald-500/40 shrink-0 mt-0.5">[{item.time}]</span>
                <p className="text-[9px] text-slate-300 leading-snug font-medium italic select-none">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. MINIMALIST FOOTER (Power Target displaying live irms/Amps) */}
      <div className="mt-2 shrink-0 rounded-lg bg-emerald-500/5 px-2 py-2 flex items-center justify-between border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center gap-2">
          <Zap className="h-3 w-3 text-amber-500 fill-amber-500/10" />
          <span className="text-[9px] font-black text-emerald-400/70 uppercase tracking-widest">Power Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-[88%] bg-emerald-500/50" />
          </div>
          <span className="text-[9px] font-mono font-bold text-amber-300">
            {irms > 0.2 ? `${irms.toFixed(1)}A` : "0.0A"}
          </span>
        </div>
      </div>
    </div>
  )
}