"use client"

import { useEffect, useState } from "react"
import { Wind } from "lucide-react"

interface WindMapTileProps {
  lat?: number | null
  lon?: number | null
}

export function WindMapTile({ lat, lon }: WindMapTileProps) {
  const mapLat = lat ?? 17.38
  const mapLon = lon ?? 78.46
  const zoom   = 6

  // JS-based mobile detection — reliable on all browsers including Safari/Android Chrome
  const [isMobile, setIsMobile] = useState(true)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check, { passive: true })
    return () => window.removeEventListener("resize", check)
  }, [])

  const windyUrl =
    `https://embed.windy.com/embed2.html?lat=${mapLat}&lon=${mapLon}&detailLat=${mapLat}&detailLon=${mapLon}` +
    `&width=650&height=450&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf` +
    `&menu=&message=&marker=false&calendar=&pressure=&type=map&location=coordinates` +
    `&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`

  // Desktop: expand iframe 45px each side to crop Windy branding off-screen
  // Mobile: 100%×100% fill — negative offsets break iframe loading on phone browsers
  const CROP = isMobile ? 0 : 45
  const iframeStyle: React.CSSProperties = {
    position: "absolute",
    border: "none",
    top:    -CROP,
    bottom: -CROP,
    left:   -CROP,
    right:  -CROP,
    width:  isMobile ? "100%" : `calc(100% + ${CROP * 2}px)`,
    height: isMobile ? "100%" : `calc(100% + ${CROP * 2}px)`,
    filter: "brightness(0.72) contrast(1.1) saturate(0.85)",
  }

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(8,15,38,0.45)] backdrop-blur-xl border border-white/[0.11] shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)]">
      {/* Ambient glow */}
      <div className="absolute -left-10 -bottom-10 h-28 w-28 rounded-full blur-[60px] bg-cyan-500/10 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          <Wind className="h-3.5 w-3.5 text-cyan-400" />
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-400">
            Wind Map
          </h3>
        </div>
        <span className="text-[8px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          Live · Windy
        </span>
      </div>

      {/* Windy embed */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {!lat && !lon ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Wind className="h-8 w-8 text-cyan-400/40 animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-[10px] text-slate-500">Awaiting site coordinates…</span>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-hidden rounded-b-xl">
            <iframe
              key={`${mapLat}-${mapLon}`}
              src={windyUrl}
              style={iframeStyle}
              allow="fullscreen; geolocation"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              title="Live Wind Map"
              loading="lazy"
            />
            {/* Vignette to blend cropped edges */}
            <div
              className="absolute inset-0 pointer-events-none rounded-b-xl"
              style={{
                background: "radial-gradient(ellipse at center, transparent 42%, rgba(3,6,23,0.70) 100%)",
                boxShadow: "inset 0 0 36px 14px rgba(3,6,23,0.55)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
