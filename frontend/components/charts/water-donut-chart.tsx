"use client"

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from "recharts"
import { useState, useMemo, useEffect, memo } from "react"

interface WaterDonutChartProps {
    waterData?: {
        tds: number
        ph: number
        level: number
        irms?: number
        flow?: number
        flowRate?: number
        totalLiters?: number
        liters?: string | number
        turbidity?: number
    }
    transparent?: boolean
    sideBySide?: boolean
}

export const WaterDonutChart = memo(function WaterDonutChart({ waterData, transparent = false }: WaterDonutChartProps) {
    const [activeIndex, setActiveIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % 4)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    const data = useMemo(() => {
        if (!waterData) return [
            { name: "Loading...", value: 1, chartValue: 25, rawValue: 0, unit: "", color: "#334155" }
        ];

        const volumeValue = waterData.totalLiters !== undefined 
            ? waterData.totalLiters 
            : (waterData.liters !== undefined ? Number(waterData.liters) : 0.0);
            
        const turbidityValue = waterData.turbidity !== undefined ? waterData.turbidity : 0.0;
        const tdsValue = waterData.tds !== undefined ? waterData.tds : 0.0;
        const phValue = waterData.ph !== undefined ? waterData.ph : 7.0;

        const scores = [
            { 
                name: "Volume", 
                value: Math.min(100, (volumeValue / 2000) * 100), // Scale target of 2000 L
                chartValue: 25,
                rawValue: volumeValue, 
                unit: "L", 
                color: "#34d399" 
            },
            {
                name: "pH Balance",
                value: Math.max(0, (7 - Math.abs(7 - phValue)) * 14.28),
                chartValue: 25,
                rawValue: phValue,
                unit: "pH",
                color: "#60a5fa"
            },
            {
                name: "Turbidity",
                // NTU scoring: 0 NTU = 100 score, 100 NTU = 0 score (linear, WHO threshold ~4 NTU for drinking)
                value: Math.max(0, Math.min(100, 100 - (turbidityValue / 10))),
                chartValue: 25,
                rawValue: Math.min(turbidityValue, 999), // Cap display at 999 (sensor max clamp artifact)
                unit: "NTU",
                color: "#a855f7"
            },
            {
                name: "TDS",
                value: Math.min(100, (tdsValue / 500) * 100),
                chartValue: 25,
                rawValue: tdsValue,
                unit: "ppm",
                color: "#fb923c"
            },
        ];

        return scores;
    }, [waterData]);

    const activeItem = data[activeIndex] || data[0];

    const onPieEnter = (_: any, index: number) => {
        setActiveIndex(index)
    }

    return (
        <div className={`${transparent ? '' : 'card-vibrant bg-slate-900/40 rounded-2xl border border-blue-500/20 p-3'} h-full min-h-[160px] w-full flex flex-col backdrop-blur-md lg:backdrop-blur-xl relative overflow-hidden group`}>
            <div className="flex-1 w-full flex flex-col items-center justify-between min-h-0 relative z-10">
                {/* Donut Chart Container (Centered) */}
                <div className="relative w-full h-[66%] min-h-[112px] mt-1.5">
                    {/* Center Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 translate-y-[2%]">
                        <span className="text-2xl font-bold text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-transform duration-500">
                            {activeItem.name === "pH Balance"
                                ? activeItem.rawValue.toFixed(1)
                                : activeItem.name === "Turbidity"
                                ? Math.round(activeItem.rawValue)
                                : Math.round(activeItem.rawValue)}
                        </span>
                        <span className="text-[9px] uppercase font-black tracking-widest" style={{ color: activeItem.color }}>
                            {activeItem.unit}
                        </span>
                    </div>

                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                innerRadius={41}
                                outerRadius={55}
                                paddingAngle={4}
                                dataKey="chartValue"
                                onMouseEnter={onPieEnter}
                                stroke="none"
                                cornerRadius={6}
                                cx="50%"
                                cy="52%"
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.color}
                                        style={{
                                            filter: index === activeIndex ? `drop-shadow(0 0 12px ${entry.color})` : 'none',
                                            opacity: index === activeIndex ? 1 : 0.6,
                                            transform: index === activeIndex ? 'scale(1.05)' : 'scale(1)',
                                            transformOrigin: 'center',
                                            outline: 'none',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Bottom Row Metrics Stack (Name and color dot only, no values) */}
                <div className="flex flex-row flex-wrap justify-center items-center w-full px-1 mt-2 gap-x-4 gap-y-1 relative z-10 border-t border-white/[0.05] pt-2">
                    {data.map((entry, index) => (
                        <div
                            key={index}
                            className={`flex items-center gap-1.5 cursor-pointer transition-all duration-300 ${index === activeIndex ? "opacity-100 scale-105" : "opacity-50 hover:opacity-100"}`}
                            onMouseEnter={() => setActiveIndex(index)}
                        >
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color, boxShadow: `0 0 5px ${entry.color}` }} />
                            <span className="text-[10px] font-black text-white/90 uppercase tracking-wider leading-none">
                                {entry.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})
