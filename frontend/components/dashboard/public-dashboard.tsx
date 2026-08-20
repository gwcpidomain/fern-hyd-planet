"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LogIn, MapPin, Wind, Droplets, ArrowLeft } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { AirQualityCard } from "@/components/air-quality-card"
import { WaterQualityCard } from "@/components/water-quality-card"
import { getApiBaseUrl } from "@/lib/api-url"

// --- Status Helpers ---
function getAqiStatus(pm25: number) {
    if (pm25 <= 0) return { label: "--", color: "text-slate-500" };
    if (pm25 <= 12) return { label: "Good", color: "text-emerald-400" };
    if (pm25 <= 35.4) return { label: "Moderate", color: "text-yellow-400" };
    if (pm25 <= 55.4) return { label: "USG", color: "text-orange-400" };
    if (pm25 <= 150.4) return { label: "Unhealthy", color: "text-red-400" };
    if (pm25 <= 250.4) return { label: "V.Unhealthy", color: "text-purple-400" };
    return { label: "Hazardous", color: "text-rose-500" };
}

function getWaterStatus(ph: number, tds: number) {
    if (ph === 0 && tds === 0) return { label: "--", color: "text-slate-500" };
    const phOk = ph >= 6.5 && ph <= 8.5;
    const tdsOk = tds < 500;
    if (phOk && tdsOk) return { label: "Safe", color: "text-emerald-400" };
    if (phOk || tdsOk) return { label: "Warning", color: "text-yellow-400" };
    return { label: "Critical", color: "text-red-400" };
}

// Haversine distance (km)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function PublicDashboard() {
    const router = useRouter()
    const { token } = useAuth() // Check if user is logged in
    const [locations, setLocations] = useState<any[]>([])
    const [selectedLocId, setSelectedLocId] = useState<string | null>(null)
    const selectedLoc = locations.find(l => l.location_id === selectedLocId)
    const [loading, setLoading] = useState(true)
    const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

    // Interactive State
    const [activeMetric, setActiveMetric] = useState<string | null>("pm25")
    const [activeWaterMetric, setActiveWaterMetric] = useState<string | null>("level")

    // Stars State
    const [stars, setStars] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([])
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

    useEffect(() => {
        // Generate Stars
        setStars(Array.from({ length: 150 }).map(() => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${3 + Math.random() * 4}s`,
        })))

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth - 0.5) * 30,
                y: (e.clientY / window.innerHeight - 0.5) * 30
            })
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    useEffect(() => {
        const fetchPublicData = async () => {
            try {
                const apiUrl = getApiBaseUrl();
                const res = await fetch(`${apiUrl}/api/public/locations`)
                const data = await res.json()
                if (Array.isArray(data)) {
                    // Helper to sort by Online status first
                    const sortOnline = (list: any[]) => {
                        return [...list].sort((a, b) => {
                            if (a.online === b.online) return 0;
                            return a.online ? -1 : 1; // Online first
                        });
                    };

                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((pos) => {
                            const { latitude: userLat, longitude: userLng } = pos.coords;
                            setUserPos({ lat: userLat, lng: userLng });
                            const withDist = data.map((loc: any) => ({
                                ...loc,
                                distanceKm: (loc.latitude && loc.longitude)
                                    ? haversineKm(userLat, userLng, loc.latitude, loc.longitude)
                                    : null
                            }));
                            const sorted = [...withDist].sort((a, b) => {
                                if (a.online !== b.online) return a.online ? -1 : 1;
                                if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
                                return 0;
                            });
                            setLocations(sorted);
                        }, () => {
                            setLocations(sortOnline(data));
                        });
                    } else {
                        // No Geolocation support -> Sort by Online only
                        setLocations(sortOnline(data))
                    }
                } else {
                    setLocations([]);
                }
            } catch (e) {
                console.error("Public fetch error", e)
            } finally {
                setLoading(false)
            }
        }
        fetchPublicData()
        const interval = setInterval(fetchPublicData, 10000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="relative min-h-screen bg-[#020617] text-white font-sans selection:bg-emerald-500/30 flex flex-col overflow-hidden transition-colors duration-1000">

            {/* --- ANIMATED COSMIC BACKGROUND --- */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* 1. Base Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#0a0520] via-[#050511] to-[#000208]" />

                {/* 2. Interactive Nebula Glow (Mouse Follow) */}
                <div
                    className="absolute h-[800px] w-[800px] rounded-full bg-gradient-to-tr from-emerald-600/10 via-cyan-600/5 to-transparent blur-[120px] transition-transform duration-1000 ease-out"
                    style={{
                        transform: `translate(${mousePosition.x}px, ${mousePosition.y}px)`,
                        left: '10%', top: '10%'
                    }}
                />

                {/* 3. Revolving Stars Container */}
                <div className="absolute inset-0 animate-[spin_240s_linear_infinite]">
                    {stars.map((star, i) => (
                        <div
                            key={i}
                            className="absolute h-[2px] w-[2px] rounded-full bg-white animate-pulse"
                            style={{
                                left: star.left,
                                top: star.top,
                                animationDelay: star.delay,
                                animationDuration: star.duration,
                                opacity: Math.random() * 0.7 + 0.3
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* --- CONTENT --- */}
            <div className="relative z-10 flex-1 flex flex-col">
                {/* Public Header */}
                <header className="px-6 py-5 border-b border-white/5 flex items-center justify-between backdrop-blur-md bg-black/20 sticky top-0 z-50 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        {selectedLoc ? (
                            <button
                                onClick={() => setSelectedLocId(null)}
                                className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                            >
                                <MapPin className="h-5 w-5 text-slate-400 group-hover:text-white" />
                            </button>
                        ) : (
                            <div className="h-10 w-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/5 animate-pulse-slow">
                                <div className="h-4 w-4 rounded-full bg-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                            </div>
                        )}

                        <div>
                            <h1 className="text-xl font-bold tracking-wide">
                                {selectedLoc ? (
                                    <span className="text-white animate-in fade-in slide-in-from-left-2">{selectedLoc.name}</span>
                                ) : (
                                    <span className="bg-gradient-to-r from-cyan-400 to-[#7CFF9A] bg-clip-text text-transparent">
                                        EcoSphere Intelligence
                                    </span>
                                )}
                            </h1>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500">
                                {selectedLoc ? "Live Sensor Feed" : "Public Planetary Network"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {token ? (
                            /* User is logged in - show Back button */
                            <button
                                onClick={() => router.push("/")}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-sm font-semibold transition-all border border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                            >
                                <ArrowLeft className="h-4 w-4 text-emerald-400" />
                                <span className="text-emerald-400">My Dashboard</span>
                            </button>
                        ) : (
                            /* User not logged in - show Login button */
                            <button
                                onClick={() => router.push("/login")}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-semibold transition-all border border-white/5 hover:border-emerald-500/30 hover:shadow-[0_0_15px_rgba(52,211,153,0.2)]"
                            >
                                <LogIn className="h-4 w-4 text-emerald-400" />
                                <span>Login</span>
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
                    {selectedLoc ? (
                        /* DETAIL VIEW */
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                                {/* Water Quality Section */}
                                <div className="flex flex-col gap-2 h-full">
                                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
                                        <Droplets className="h-4 w-4" />
                                        Groundwater Analysis
                                    </h3>
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        <WaterQualityCard
                                            data={{
                                                level: selectedLoc.data?.level || 0,
                                                ph: selectedLoc.data?.ph || 0,
                                                tds: selectedLoc.data?.tds || 0,
                                                chartData: selectedLoc.data?.chartData || { labels: [], level: [], ph: [], tds: [] }
                                            }}
                                            activeMetric={activeWaterMetric}
                                            onMetricSelect={setActiveWaterMetric}
                                            isOffline={!selectedLoc.online}
                                        />
                                    </div>
                                </div>

                                {/* Air Quality Section */}
                                <div className="flex flex-col gap-2 h-full">
                                    <h3 className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
                                        <Wind className="h-4 w-4" />
                                        Atmospheric Conditions
                                    </h3>
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        <AirQualityCard
                                            data={{
                                                pm25: selectedLoc.data?.pm25 || 0,
                                                pm10: selectedLoc.data?.pm10 || 0,
                                                co2: selectedLoc.data?.co2 || 400,
                                                tvoc: selectedLoc.data?.tvoc || 0,
                                                hcho: selectedLoc.data?.hcho || 0,
                                                temp: selectedLoc.data?.temp || 0,
                                                humidity: selectedLoc.data?.humidity || 0,
                                                chartData: selectedLoc.data?.chartData || { 
                                                    labels: [], 
                                                    pm25: [], 
                                                    pm10: [], 
                                                    co2: [], 
                                                    tvoc: [], 
                                                    hcho: [],
                                                    temp: [],
                                                    humidity: []
                                                }
                                            }}
                                            activeMetric={activeMetric}
                                            onMetricSelect={setActiveMetric}
                                            isOffline={!selectedLoc.online}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* GRID VIEW */
                        <>
                            {/* Hero Section */}
                            <div className="mb-12 text-center space-y-4 animate-in fade-in zoom-in duration-700">
                                <h2 className="text-3xl lg:text-5xl font-bold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                                    Global Environmental Data <br />
                                    <span className="text-slate-500">Real-time. Decentralized. Open.</span>
                                </h2>
                                <p className="text-slate-400 max-w-2xl mx-auto">
                                    Access live metrics from the public sensor grid. Monitoring Air Quality and Groundwater levels across the network.
                                </p>
                            </div>

                            {/* Locations Grid */}
                            {loading ? (
                                <div className="text-center text-slate-500 py-20 flex flex-col items-center gap-3">
                                    <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                    <p>Scanning Network...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {locations.map((loc, i) => (
                                        <div
                                            key={loc.location_id}
                                            onClick={() => loc.online && setSelectedLocId(loc.location_id)}
                                            className={`
                                                relative overflow-hidden bg-slate-900/40 border border-white/10 rounded-2xl p-6 transition-all duration-300 group
                                                ${loc.online ? 'cursor-pointer hover:bg-white/5 hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]' : 'opacity-75 cursor-not-allowed grayscale-[0.5]'}
                                                animate-in fade-in slide-in-from-bottom-4
                                            `}
                                            style={{ animationDelay: `${i * 100}ms` }}
                                        >
                                            {/* Hover Glow Gradient */}
                                            {loc.online && <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />}

                                            <div className="relative z-10">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${loc.online ? 'bg-blue-500/20 text-blue-400 group-hover:bg-blue-500/30 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-slate-800 text-slate-500'}`}>
                                                            <MapPin className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg text-white group-hover:text-emerald-400 transition-colors">{loc.name}</h3>
                                                            <p className="text-sm text-slate-500">{loc.area}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${loc.online ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                                                        {loc.online ? 'Online' : 'Offline'}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 mt-6">
                                                    {(() => {
                                                        const s = loc.online ? getAqiStatus(loc.data?.pm25 || 0) : { label: "--", color: "text-slate-500" }; return (
                                                            <div className="bg-black/40 rounded-2xl p-3 border border-white/5 text-center group-hover:border-white/10 transition-colors">
                                                                <Wind className="h-5 w-5 mx-auto text-orange-400 mb-2" />
                                                                <div className="text-xs text-slate-500">AQI Status</div>
                                                                <div className={`font-mono text-lg font-bold ${s.color}`}>{s.label}</div>
                                                            </div>
                                                        )
                                                    })()}
                                                    {(() => {
                                                        const s = loc.online ? getWaterStatus(loc.data?.ph || 0, loc.data?.tds || 0) : { label: "--", color: "text-slate-500" }; return (
                                                            <div className="bg-black/40 rounded-2xl p-3 border border-white/5 text-center group-hover:border-white/10 transition-colors">
                                                                <Droplets className="h-5 w-5 mx-auto text-blue-400 mb-2" />
                                                                <div className="text-xs text-slate-500">Water Status</div>
                                                                <div className={`font-mono text-lg font-bold ${s.color}`}>{s.label}</div>
                                                            </div>
                                                        )
                                                    })()}
                                                </div>

                                                {loc.online && (
                                                    <div className="mt-4 text-center">
                                                        <span className="text-xs font-bold text-emerald-400 group-hover:underline group-hover:text-emerald-300 transition-colors">View Dashboard &rarr;</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
