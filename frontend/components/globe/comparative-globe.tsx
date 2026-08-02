"use client"

import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import { fetchGlobalAQData, type GlobalAQPoint } from '@/utils/aqi-comparison'
import {
  getIndiaAvgAQI,
  getCityAQI,
  getStateAQIForLocation,
  getAQICategory,
} from '@/utils/india-aqi-data'
import { Activity, Globe as GlobeIcon, TrendingUp, MapPin } from 'lucide-react'

// Dynamic import for Globe (no SSR)
const Globe = dynamic(() => import('react-globe.gl'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse flex items-center justify-center h-full w-full bg-slate-900/20 rounded-xl">
      <GlobeIcon className="h-10 w-10 text-emerald-400" />
    </div>
  ),
})

interface GlobalComparativeGlobeProps {
  userAQI?: number
  userLat?: number
  userLng?: number
  locationName?: string
}

export const GlobalComparativeGlobe = memo(function GlobalComparativeGlobe({
  userAQI = 42,
  userLat = 17.3850,
  userLng = 78.4867,
  locationName = "HYD-01",
}: GlobalComparativeGlobeProps) {
  const [globalData, setGlobalData] = useState<GlobalAQPoint[]>([])
  const [loading, setLoading] = useState(true)
  const globeEl = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 300, height: 300 })

  // ── Handle Responsiveness ──────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })
    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [])

  // ── Data Fetching ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const global = await fetchGlobalAQData()
        setGlobalData(global)
      } catch (err) {
        console.warn("Globe data fetch error handled gracefully:", err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ── Globe Config ──────────────────────────────────────────
  const globeConfig = {
    backgroundColor: 'rgba(0,0,0,0)',
    globeImageUrl: '//unpkg.com/three-globe/example/img/earth-night.jpg',
    bumpImageUrl: '//unpkg.com/three-globe/example/img/earth-topology.png',
  }

  // Use a proper India GeoJSON from Natural Earth (fetched at runtime)
  // instead of hand-drawn approximate polygons

  // ── Indian City Blinkers (green/red based on AQI) ─────────
  const indianCityBlinkers = useMemo(() => [
    { lat: 28.6139, lng: 77.2090, aqi: 285, city: 'Delhi', isUser: false },
    { lat: 19.0760, lng: 72.8777, aqi: 115, city: 'Mumbai', isUser: false },
    { lat: 12.9716, lng: 77.5946, aqi: 45, city: 'Bengaluru', isUser: false },
    { lat: 13.0827, lng: 80.2707, aqi: 78, city: 'Chennai', isUser: false },
    { lat: 22.5726, lng: 88.3639, aqi: 145, city: 'Kolkata', isUser: false },
    { lat: 23.0225, lng: 72.5714, aqi: 110, city: 'Ahmedabad', isUser: false },
    { lat: 18.5204, lng: 73.8567, aqi: 82, city: 'Pune', isUser: false },
    { lat: 26.9124, lng: 75.7873, aqi: 135, city: 'Jaipur', isUser: false },
    { lat: 25.3176, lng: 82.9739, aqi: 190, city: 'Varanasi', isUser: false },
    { lat: 17.3850, lng: 78.4867, aqi: 92, city: 'Hyderabad', isUser: false },
    { lat: 26.8467, lng: 80.9462, aqi: 210, city: 'Lucknow', isUser: false },
    { lat: 30.7333, lng: 76.7794, aqi: 125, city: 'Chandigarh', isUser: false },
    { lat: 15.2993, lng: 74.1240, aqi: 38, city: 'Goa', isUser: false },
    { lat: 11.0168, lng: 76.9558, aqi: 52, city: 'Coimbatore', isUser: false },
    { lat: 21.1702, lng: 72.8311, aqi: 95, city: 'Surat', isUser: false },
  ], [])

  // ── User Location Pin (Pulsing Ring) ──────────────────────
  const userRingData = useMemo(() => [{
    lat: userLat,
    lng: userLng,
    aqi: userAQI,
    city: locationName,
    isUser: true,
  }], [userLat, userLng, userAQI, locationName])

  // Merge user pin + Indian cities + global data for rings
  const allRingsData = useMemo(() => [
    ...userRingData,
    ...indianCityBlinkers,
    ...globalData,
  ], [userRingData, indianCityBlinkers, globalData])

  // ── Comparison Data ───────────────────────────────────────
  const cityInfo = getCityAQI(locationName)
  const stateAQI = getStateAQIForLocation(locationName)
  const indiaAvg = getIndiaAvgAQI()
  const globalAvg = useMemo(() => {
    if (globalData.length === 0) return 59
    return Math.round(globalData.reduce((acc, curr) => acc + curr.aqi, 0) / globalData.length)
  }, [globalData])

  const comparison = useMemo(() => {
    const diff = Math.round(((cityInfo.aqi - userAQI) / cityInfo.aqi) * 100)
    if (diff > 0) return { text: `${diff}% cleaner than ${cityInfo.city} avg`, positive: true }
    if (diff < 0) return { text: `${Math.abs(diff)}% worse than ${cityInfo.city} avg`, positive: false }
    return { text: `Same as ${cityInfo.city} avg`, positive: true }
  }, [userAQI, cityInfo])

  // ── Lock controls: rotation only, NO zoom, NO pan ─────────
  const lockControls = useCallback(() => {
    if (globeEl.current) {
      const controls = globeEl.current.controls()
      if (controls) {
        controls.enableZoom = false   // DISABLE zoom completely
        controls.enablePan = false    // DISABLE panning
        controls.autoRotate = true    // Gentle auto-rotation
        controls.autoRotateSpeed = 0.4
      }
    }
  }, [])

  // ── Set initial view on mount ──────────────────────────────
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.pointOfView({ lat: userLat, lng: userLng, altitude: 2.5 }, 0)
      lockControls()
    }
  }, [userLat, userLng, lockControls])

  // ── Comparison items ──────────────────────────────────────
  const comparisonItems = [
    { label: "YOU", value: userAQI, icon: <MapPin className="h-3 w-3" />, highlight: true },
    { label: cityInfo.city.toUpperCase(), value: cityInfo.aqi, icon: null, highlight: false },
    { label: cityInfo.state.toUpperCase(), value: stateAQI, icon: null, highlight: false },
    { label: "INDIA", value: indiaAvg, icon: null, highlight: false },
    { label: "WORLD", value: globalAvg, icon: null, highlight: false },
  ]

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.6)] backdrop-blur-xl border border-white/5 p-0 group shadow-[0_6px_24px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">

      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="absolute top-2 left-2 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            <GlobeIcon className="h-3 w-3 text-emerald-400" />
          </div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">AQI Pulse</h3>
        </div>
      </div>

      {/* Top Right Badge */}
      <div className="absolute top-2 left-30 z-10 flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg px-2 py-1 pointer-events-none">
        <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
        <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
      </div>

      {/* ── MAIN BODY: Globe (60%) + Strip (40%) ──────── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 w-full">

        {/* Globe (60%) */}
        <div ref={containerRef} className="w-full h-[200px] lg:h-auto lg:w-[60%] relative lg:min-h-0 overflow-hidden">
          <Globe
            ref={globeEl}
            {...globeConfig}
            width={dimensions.width}
            height={dimensions.height}
            showAtmosphere={true}
            atmosphereColor="rgba(16, 185, 129, 0.08)"
            atmosphereAltitude={0.12}
            onGlobeReady={lockControls}
            enablePointerInteraction={false}

            // Ripple rings ONLY (lightweight)
            ringsData={allRingsData}
            ringLat={(d: any) => d.lat}
            ringLng={(d: any) => d.lng}
            ringColor={(d: any) => d.isUser
              ? ['rgba(34,211,238,1)', 'rgba(34,211,238,0.2)']
              : d.aqi > 100
                ? 'rgba(239, 68, 68, 0.5)'
                : 'rgba(52, 211, 153, 0.5)'
            }
            ringMaxRadius={(d: any) => d.isUser ? 4 : 3}
            ringPropagationSpeed={(d: any) => d.isUser ? 3 : 2}
            ringRepeatPeriod={(d: any) => d.isUser ? 600 : 1000}
          />
        </div>

        {/* ── COMPARISON STRIP (40%) ─────────────────── */}
        <div className="w-full lg:w-[40%] flex flex-col justify-center gap-1.5 px-2 lg:pr-2 lg:pl-1 py-2 border-t lg:border-t-0 lg:border-l border-white/[0.06]">
          <span className="text-[7px] font-black uppercase tracking-[0.25em] text-slate-500 px-1 mb-0.5 mt-1 lg:mt-0">INDEX</span>

          {comparisonItems.map((item, i) => {
            const cat = getAQICategory(item.value)
            return (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-2 py-1.5 border transition-all ${item.highlight
                  ? 'bg-cyan-500/10 border-cyan-500/20'
                  : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'
                  }`}
              >
                <div className="flex items-center gap-1.5">
                  {item.icon && <span className="text-cyan-400">{item.icon}</span>}
                  <span className={`text-[8px] font-black uppercase tracking-wider ${item.highlight ? 'text-cyan-300' : 'text-slate-400'
                    }`}>
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-black text-white">{item.value}</span>
                  <span
                    className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.color, boxShadow: `0 0 4px ${cat.color}` }}
                  />
                </div>
              </div>
            )
          })}

          {/* Verdict */}
          <div className={`mt-1 rounded-lg px-2 py-1 text-[8px] font-bold text-center ${comparison.positive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
            : 'bg-red-500/10 text-red-400 border border-red-500/15'
            }`}>
            {comparison.positive ? '✓' : '⚠'} {comparison.text}
          </div>
        </div>
      </div>

      {/* ── FOOTER STRIP ───────────────────────────────── */}
      <div className="border-t border-white/5 bg-slate-900/60 px-2 py-1.5 flex items-center justify-between text-[7px] uppercase tracking-widest text-slate-500">
        <div className="flex items-center gap-1.5">
          <Activity className="h-2.5 w-2.5 text-blue-400" />
          <span>Comparative Index</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
            <span>Good</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
            <span>Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            <span>Poor</span>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/20 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">Syncing Globe...</span>
          </div>
        </div>
      )}
    </div>
  )
})
