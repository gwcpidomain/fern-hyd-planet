"use client"

import { Wind } from "lucide-react"

interface WindMapTileProps {
  lat?: number | null
  lon?: number | null
}

export function WindMapTile({ lat, lon }: WindMapTileProps) {
  // Default to center of India if coordinates not available yet
  const mapLat = lat ?? 17.38
  const mapLon = lon ?? 78.46
  const zoom   = 6

  // Windy.com free embed — dark mode, wind overlay, centered on tenant coordinates
  const windyUrl =
    `https://embed.windy.com/embed2.html?lat=${mapLat}&lon=${mapLon}&detailLat=${mapLat}&detailLon=${mapLon}` +
    `&width=650&height=450&zoom=${zoom}&level=surface&overlay=wind&product=ecmwf` +
    `&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates` +
    `&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl bg-[rgba(6,10,30,0.35)] backdrop-blur-2xl border border-white/[0.08] shadow-[0_6px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]">
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

      {/* Windy embed — fills remaining space */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {!lat && !lon ? (
          // Placeholder while location loads
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <Wind className="h-8 w-8 text-cyan-400/40 animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-[10px] text-slate-500">Awaiting site coordinates…</span>
          </div>
        ) : (
          <iframe
            key={`${mapLat}-${mapLon}`}
            src={windyUrl}
            className="absolute inset-0 w-full h-full border-0"
            allow="fullscreen"
            title="Live Wind Map"
            loading="lazy"
          />
        )}
      </div>
    </div>
  )
}
