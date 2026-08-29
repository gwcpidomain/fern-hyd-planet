"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { AirQualityCard } from "@/components/air-quality-card"
import { LoadingScreen } from "@/components/loading-screen"
import { SpeedometerGauge } from "@/components/environmental-core"
import { ErrorBoundary } from "@/components/error-boundary"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { calculateAQI } from "@/utils/aqi-calculator"
import { WaterQualityCard } from "@/components/water-quality-card"
import { SidebarNavigation } from "@/components/sidebar-navigation"
import { PollutantDonutChart } from "@/components/charts/pollutant-donut-chart"
import { MetricHistoryChart } from "@/components/charts/aqi-forecast-chart"
import { RecentReadingsTable, RecentReadingsExpandModal } from "@/components/recent-readings-table"
import { ChartModal } from "@/components/chart-modal"
import { AQIPollutantHub } from "@/components/aqi-pollutant-hub"
import { WaterAnalysisSplit } from "@/components/analysis/water-split"
import { BorewellHealthIndex } from "@/components/analysis/health-index"
import { WeatherWidget } from "@/components/dashboard/weather-widget"
import { BorewellMonitorCard } from "@/components/borewell-monitor-card"
import { ForecastTile } from "@/components/dashboard/forecast-tile"
import { SunriseSunsetTile } from "@/components/dashboard/sunrise-sunset-tile"
import { WindMapTile } from "@/components/dashboard/wind-map-tile"
import { EnvironmentIntelTile } from "@/components/dashboard/environment-intel-tile"
import type { WeatherPayload } from "@/components/dashboard/weather-types"
import dynamic from "next/dynamic"
import { useRealtimeData } from "@/hooks/useRealtimeData"
import { useAuth } from "@/components/auth-provider"
import { getApiUrl } from "@/lib/api-url"
import { buildHistoricalReadingsSeries, buildYearlyMonthlyWaterLevelComparison, type HistoricalPeriod } from "@/lib/historical-readings"
import { calculateNextWaterLevel } from "@/utils/data-simulator"
import { Wifi, WifiOff, Cpu, MapPin, Trash2, Menu } from "lucide-react"

type AirState = {
    pm25: number; pm10: number; co2: number; tvoc: number; hcho: number; temp: number; humidity: number;
    chartData: { labels: string[], pm25: number[], pm10: number[], co2: number[], tvoc: number[], hcho: number[], temp: number[], humidity: number[] }
};

type WaterState = {
    level: number; ph: number; tds: number; irms: number; pump_status: string;
    flow?: number; flowRate?: number; efficiency?: number; voltage?: number; runTime?: number; turbidity?: number;
    totalLiters?: number;
    currentStatus?: string;
    waterStatus?: string;
    turbidityStatus?: string;
    tdsStatus?: string;
    chartData: { labels: string[], level: number[], ph: number[], tds: number[], turbidity?: number[] }
};

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function nextRandomWalk(prev: number, delta: number, min: number, max: number) {
    return clamp(prev + rand(-delta, delta), min, max);
}

function timeLabelNow() {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

// Dynamically import Global Globe
const GlobalComparativeGlobe = dynamic(
    () => import("@/components/globe/comparative-globe").then((mod) => mod.GlobalComparativeGlobe),
    { ssr: false }
)

export function PrivateDashboard() {
    const { token, user, tenantId } = useAuth();
    const [tenantConfig, setTenantConfig] = useState<{ id: string; name: string; primary_color?: string; secondary_color?: string; logo_url?: string; address?: string } | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [maxWaterLevel, setMaxWaterLevel] = useState(0)
    const hasAutoSelected = useRef(false); // Track smart auto-selection
    const [loopIndex, setLoopIndex] = useState(0);
    const waterDataRef = useRef(null);
    // PRODUCTIZATION STATE
    // PRODUCTIZATION STATE
    const [selectedPollutant, setSelectedPollutant] = useState<string | null>(null);
    const [selectedWaterMetric, setSelectedWaterMetric] = useState<string | null>(null);
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; type: 'aqi' | 'water' | null }>({ isOpen: false, type: null });
    const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("1h");

    // Auto-rotate Water Trend tile metric every 2 minutes (Level -> pH -> TDS -> Turbidity)
    useEffect(() => {
        const metrics = ["level", "ph", "tds", "turbidity"];
        const interval = setInterval(() => {
            setSelectedWaterMetric((current) => {
                const active = current || "level";
                const nextIndex = (metrics.indexOf(active) + 1) % metrics.length;
                return metrics[nextIndex];
            });
        }, 120000); // 2 minutes (120,000 ms)
        return () => clearInterval(interval);
    }, []);

    const [readingsPeriod, setReadingsPeriod] = useState<HistoricalPeriod>("week")
    const [readingsModalOpen, setReadingsModalOpen] = useState(false)
    const [activeBorewellIndex, setActiveBorewellIndex] = useState(0);
    const [borewells, setBorewells] = useState([
        { id: "BW-01", isMotorOn: false, runTime: 0 },
        { id: "BW-02", isMotorOn: false, runTime: 0 },
        { id: "BW-03", isMotorOn: false, runTime: 0 },
    ]);

    // HYDRATION GUARD INITIALIZATION
    const [mounted, setMounted] = useState(false);
    const [demoMode, setDemoMode] = useState(false) // Set to false to receive live backend data
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        setMounted(true);
        // Shortened for HR Demo (3 seconds)
        const timer = setTimeout(() => setIsInitialLoading(false), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Navigation State
    const [activeView, setActiveView] = useState("dashboard")

    // Location Management
    const [locations, setLocations] = useState<any[]>([])
    const [currentLocation, setCurrentLocation] = useState("HYD-01")
    const [capabilities, setCapabilities] = useState({ has_aqi: true, has_water: true })

    // Devices State
    const [myDevices, setMyDevices] = useState<any[]>([])

    // Real-Time Data Hook (Pass Token!)
    const { data: wsData, isConnected: wsConnected, isLive, lastMessageTime, isOffline: wsOffline } = useRealtimeData(currentLocation, token, tenantId);

    const [lastAirTime, setLastAirTime] = useState(0);
    const lastAirTimeRef = useRef(0);
    useEffect(() => {
        lastAirTimeRef.current = lastAirTime;
    }, [lastAirTime]);
    const [lastWaterTime, setLastWaterTime] = useState(0);
    const lastWaterTimeRef = useRef(0);
    useEffect(() => {
        lastWaterTimeRef.current = lastWaterTime;
    }, [lastWaterTime]);
    const [currentTime, setCurrentTime] = useState(Date.now());

    // Update 'currentTime' every 5 seconds for offline calc AND increment motor timers for all ON units
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
            if (demoMode) {
                setBorewells(prev => prev.map(bw =>
                    bw.isMotorOn ? { ...bw, runTime: bw.runTime + 5 } : bw
                ));
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [demoMode]);



    const now = currentTime;
    const isAirOnline = lastAirTime > 0 && (now - lastAirTime < 30000);
    const isWaterOnline = lastWaterTime > 0 && (now - lastWaterTime < 30000);

    const isAirOffline = !isAirOnline;
    const isWaterOffline = !isWaterOnline;

    const isMotorOn = !isWaterOffline && (borewells[activeBorewellIndex]?.isMotorOn || false);
    const motorRunTime = borewells[activeBorewellIndex]?.runTime || 0;

    // Dynamic history limit based on active time range â€” prevents live data from truncating historical views
    const historyLimit = timeRange === "1h" ? 100 : timeRange === "24h" ? 300 : 1000;

    // Status Logic
    let locationStatus: "ONLINE" | "PARTIAL" | "OFFLINE" = "OFFLINE";
    if (!isAirOffline && !isWaterOffline) locationStatus = "ONLINE";
    else if (!isAirOffline || !isWaterOffline) locationStatus = "PARTIAL";

    const [airData, setAirData] = useState<AirState | null>(null);

    const [waterData, setWaterData] = useState<WaterState | null>(null);

    // --- ONLINE DETECTION (POLLING /api/locations/status) ---
    const [isSystemOnline, setIsSystemOnline] = useState(true); // Forced true for UX
    const [locationsStatus, setLocationsStatus] = useState<Record<string, { location_id: string; online: boolean; last_seen: string | null; latitude: number | null; longitude: number | null; name: string }>>({});

    // API URL helper from shared utility

    useEffect(() => {
        if (demoMode) return;
        if (!token) return;

        const checkStatus = async () => {
            // Guard: Pause polling when page is hidden (Finding 3.2 / 7.1)
            if (typeof document !== "undefined" && document.hidden) return;

            try {
                const data = await apiClient<Array<{ location_id: string; online: boolean; last_seen: string | null; latitude: number | null; longitude: number | null; name: string }>>(
                    "/api/locations/status", 
                    { token, showErrorToast: false }
                );
                
                // Map for easy lookup
                const statusMap: Record<string, { location_id: string; online: boolean; last_seen: string | null; latitude: number | null; longitude: number | null; name: string }> = {};
                let anyOnline = false;
                let currentLocOnline = false;

                data.forEach(loc => {
                    statusMap[loc.location_id] = loc;
                    if (loc.online) {
                        anyOnline = true;
                    }
                    if (loc.location_id === currentLocation && loc.online) currentLocOnline = true;
                });

                // SMART AUTO-SWITCH LOGIC
                // If current location is OFFLINE, but we found another one ONLINE, switch to it!
                if (!currentLocOnline && anyOnline) {
                    const onlineLoc = data.find(l => l.online);
                    if (onlineLoc) {
                        console.log(`ðŸš€ Auto-switching from offline ${currentLocation} to online ${onlineLoc.location_id}`);
                        setCurrentLocation(onlineLoc.location_id);

                        // Reset data states
                        setAirData(null);
                        setWaterData(null);
                        setMaxWaterLevel(0);

                        // Assume new location is online immediately for UI snappiness
                        currentLocOnline = true;
                    }
                } else if (!hasAutoSelected.current && data.length > 0) {
                    // Initial Load Fallback
                    const firstOnline = data.find(l => l.online);
                    if (firstOnline && (!currentLocation || firstOnline.location_id !== currentLocation)) {
                        console.log("ðŸš€ Initial Auto-select:", firstOnline.location_id);
                        setCurrentLocation(firstOnline.location_id);
                        currentLocOnline = true;
                    }
                    hasAutoSelected.current = true;
                }

                setLocationsStatus(statusMap);

                // Force update if we just auto-switched
                setIsSystemOnline(currentLocOnline);
            } catch (err) {
                console.warn("Location status poll failed", err);
                setIsSystemOnline(false);
            }
        };

        // Poll every 5 seconds
        const interval = setInterval(checkStatus, 5000);
        checkStatus();

        return () => clearInterval(interval);
    }, [token, currentLocation, demoMode]);

    // SYSTEM STATUS: Driven by CLIENT SIDE HOOK (Priority) + Polling fallback
    useEffect(() => {
        if (demoMode) {
            setIsSystemOnline(true);
            return;
        }
        // If WebSocket hook says we are LIVE, we are definitely online.
        if (isLive && !wsOffline) {
            setIsSystemOnline(true);
        } else {
            // Fallback: If Hook is offline (maybe socket closed), check Polling status
            const locStatus = locationsStatus[currentLocation];
            // If polling says online, we trust it (maybe using HTTP ingest)
            setIsSystemOnline(locStatus?.online || false);
        }
    }, [isLive, wsOffline, locationsStatus, currentLocation, demoMode]);


    // 1. Fetch Locations on Mount (Auth)
    useEffect(() => {
        if (demoMode) return;
        if (!token) return;

        apiClient("/api/locations", { token })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setLocations(data);
                    // Set default only if not set
                    if (!currentLocation) setCurrentLocation(data[0].name);
                }
            })
            .catch(err => console.error("Failed to fetch locations:", err));
    }, [token, demoMode]);

    // Fetch Tenant Branding Config on Mount
    useEffect(() => {
        if (!token) return;
        apiClient("/api/tenant/config", { token, showErrorToast: false })
            .then((cfg: any) => {
                setTenantConfig(cfg);
                // Apply tenant brand colors as CSS custom properties
                if (cfg?.primary_color) {
                    document.documentElement.style.setProperty('--primary', cfg.primary_color);
                }
                if (cfg?.secondary_color) {
                    document.documentElement.style.setProperty('--secondary', cfg.secondary_color);
                }
            })
            .catch(() => { /* branding is non-critical, fail silently */ });
    }, [token]);

    // 2. Clear State on Location Switch
    const handleLocationSelect = (locName: string) => {
        setCurrentLocation(locName);
        setAirData(null);
        setWaterData(null);
        setMaxWaterLevel(0);
        setActiveView("dashboard");

        // Immediate status check for new location from cache
        if (locationsStatus[locName]?.online) {
            setIsSystemOnline(true);
        } else {
            setIsSystemOnline(false);
        }

        // Fetch Capabilities... (existing code)
        if (token) {
            apiClient(`/api/location/${locName}/capabilities`, { token })
                .then(data => {
                    if (data && typeof data.has_aqi === 'boolean') {
                        setCapabilities({ has_aqi: data.has_aqi, has_water: data.has_water });
                    } else {
                        // Default to showing everything if endpoint is missing or data is invalid
                        console.warn("Capabilities endpoint missing or invalid, defaulting to FULL DASHBOARD");
                        setCapabilities({ has_aqi: true, has_water: true });
                    }
                })
                .catch((err) => {
                    console.error("Capabilities fetch error:", err);
                    setCapabilities({ has_aqi: true, has_water: true });
                });
        }
    }

    // 3. Fetch Devices... (Existing)
    const fetchDevices = () => {
        if (demoMode) return;
        if (token) {
            apiClient("/api/devices", { token })
                .then(data => setMyDevices(data))
                .catch(err => console.error("Failed devices:", err));
        }
    }

    useEffect(() => {
        fetchDevices(); // Always fetch on mount for sensor status display
    }, [token, demoMode]);

    useEffect(() => {
        if (activeView === "devices") {
            fetchDevices();
        }
    }, [activeView, token, demoMode]);

    // 3.5. Live Data Polling Fallback (Self-Healing if WS fails)
    useEffect(() => {
        if (demoMode) return; // Only if not in full demo

        const fetchLatestData = async () => {
            // Guard: Pause polling when page is hidden (Finding 3.2 / 7.1)
            if (typeof document !== "undefined" && document.hidden) return;

            try {
                // 1. Fetch latest AQI
                const history = await apiClient("/api/aqi/history?limit=1", { token, showErrorToast: false });
                if (history && history.length > 0) {
                    const latest = history[history.length - 1];
                    setAirData(prev => {
                        // Only update if it's actually newer than what we have
                        if (prev && new Date(latest.timestamp).getTime() <= lastAirTimeRef.current) return prev;

                        const currentChart = prev?.chartData || { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] };
                        const timeLabel = new Date(latest.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

                        setLastAirTime(new Date(latest.timestamp).getTime());

                        return {
                            ...latest,
                            chartData: {
                                ...currentChart,
                                labels: [...currentChart.labels, timeLabel].slice(-historyLimit),
                                pm25: [...currentChart.pm25, latest.pm25].slice(-historyLimit),
                                pm10: [...currentChart.pm10, latest.pm10].slice(-historyLimit),
                                co2: [...currentChart.co2, latest.co2].slice(-historyLimit),
                                tvoc: [...currentChart.tvoc, latest.tvoc].slice(-historyLimit),
                                hcho: [...currentChart.hcho, latest.hcho].slice(-historyLimit),
                                temp: [...currentChart.temp, latest.temp].slice(-historyLimit),
                                humidity: [...currentChart.humidity, latest.humidity].slice(-historyLimit)
                            }
                        };
                    });
                }

                // 2. Fetch latest Borewell & Water levels state
                const bwData = await apiClient<any[]>("/api/borewells", { token, showErrorToast: false });
                if (Array.isArray(bwData)) {
                    const sortedBw = bwData
                        .map(bw => ({
                            id: bw.id,
                            isMotorOn: bw.is_motor_on === 1,
                            runTime: bw.run_time_total
                        }))
                        .sort((a, b) => a.id.localeCompare(b.id));
                    setBorewells(sortedBw);

                    const activeId = sortedBw[activeBorewellIndex]?.id;
                    const active = bwData.find(bw => bw.id === activeId);
                    if (active) {
                        const isDbZero = active.ph === 0 && active.tds === 0 && (active.water_level === 0 || active.water_level === null);
                        setWaterData(prev => {
                            const utcStr = active.last_updated ? active.last_updated.replace(' ', 'T') + 'Z' : '';
                            const lastTime = new Date(utcStr).getTime();
                            const isNew = !isNaN(lastTime) && lastTime > lastWaterTimeRef.current;
                            
                            const currentChart = prev?.chartData || { labels: [], level: [], ph: [], tds: [], turbidity: [] };
                            let newLabels = currentChart.labels;
                            let newLevelArr = currentChart.level;
                            let newPhArr = currentChart.ph;
                            let newTdsArr = currentChart.tds;
                            let newTurbidityArr = currentChart.turbidity || [];

                            if (isNew) {
                                setLastWaterTime(lastTime);
                                if (!isDbZero) {
                                    const timeLabel = new Date(lastTime).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                                    newLabels = [...currentChart.labels, timeLabel].slice(-historyLimit);
                                    newLevelArr = [...currentChart.level, active.water_level ?? prev?.level ?? 0].slice(-historyLimit);
                                    newPhArr = [...currentChart.ph, active.ph ?? prev?.ph ?? 7.2].slice(-historyLimit);
                                    newTdsArr = [...currentChart.tds, active.tds ?? prev?.tds ?? 250].slice(-historyLimit);
                                    newTurbidityArr = [...(currentChart.turbidity || []), active.turbidity ?? prev?.turbidity ?? 1.2].slice(-historyLimit);
                                }
                            }

                            return {
                                ...prev,
                                level: isDbZero ? (prev?.level ?? 0) : (active.water_level ?? prev?.level ?? 0),
                                ph: isDbZero ? (prev?.ph ?? 7.2) : (active.ph || prev?.ph || 7.2),
                                tds: isDbZero ? (prev?.tds ?? 250) : (active.tds || prev?.tds || 250),
                                irms: active.current ?? prev?.irms ?? 0,
                                flowRate: active.flow_rate ?? prev?.flowRate ?? 0,
                                efficiency: active.efficiency ?? prev?.efficiency ?? 0,
                                voltage: active.voltage ?? prev?.voltage ?? 0,
                                runTime: active.run_time_total ?? prev?.runTime ?? 0,
                                turbidity: isDbZero ? (prev?.turbidity ?? 1.2) : (active.turbidity || prev?.turbidity || 1.2),
                                pump_status: active.current_status || (active.is_motor_on ? "MID" : "OFF"),
                                totalLiters: active.total_liters ?? prev?.totalLiters,
                                currentStatus: active.current_status,
                                waterStatus: active.water_status,
                                turbidityStatus: active.turbidity_status,
                                tdsStatus: active.tds_status,
                                chartData: {
                                    labels: newLabels,
                                    level: newLevelArr,
                                    ph: newPhArr,
                                    tds: newTdsArr,
                                    turbidity: newTurbidityArr
                                }
                            } as any;
                        });
                    }
                }
            } catch (err) {
                console.warn("Live data poll failed", err);
            }
        };

        const interval = setInterval(fetchLatestData, 5000); // 5s fallback
        fetchLatestData(); // Fetch once immediately
        return () => clearInterval(interval);
    }, [demoMode, token, activeBorewellIndex]);

    const handleDeleteDevice = async (deviceId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click
        if (demoMode) {
            setMyDevices(prev => prev.filter(d => d.device_id !== deviceId));
            return;
        }
        if (!confirm(`Are you sure you want to delete device ${deviceId}? This action cannot be undone.`)) return;

        try {
            await apiClient(`/api/devices/${deviceId}`, {
                method: 'DELETE',
                token
            });
            // Optimistic UI Update: Remove immediately
            setMyDevices(prev => prev.filter(d => d.device_id !== deviceId));
            toast.success(`Device ${deviceId} deleted successfully.`);
            fetchDevices();
        } catch (err) {
            console.error("Delete device failed:", err);
        }
    }

    // 4. Update State from WebSocket
    useEffect(() => {
        if (!wsData) return;
        if ((wsData as any).tenant_id && (wsData as any).tenant_id !== tenantId) {
            return;
        }

        if (wsData.type === 'aqi') {
            // AQI data is ALWAYS live as requested
            setAirData(prev => {
                const currentChart = prev?.chartData || { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] };
                const timeLabel = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const newLabels = [...currentChart.labels, timeLabel].slice(-historyLimit);

                setLastAirTime(Date.now()); // Update last seen for Air

                return {
                    pm25: wsData.data.pm25,
                    pm10: wsData.data.pm10,
                    co2: wsData.data.co2,
                    tvoc: wsData.data.tvoc,
                    hcho: wsData.data.hcho,
                    temp: wsData.data.temp,
                    humidity: wsData.data.humidity,
                    chartData: {
                        labels: newLabels,
                        pm25: [...currentChart.pm25, wsData.data.pm25].slice(-historyLimit),
                        pm10: [...currentChart.pm10, wsData.data.pm10].slice(-historyLimit),
                        co2: [...currentChart.co2, wsData.data.co2].slice(-historyLimit),
                        tvoc: [...currentChart.tvoc, wsData.data.tvoc].slice(-historyLimit),
                        hcho: [...currentChart.hcho, wsData.data.hcho].slice(-historyLimit),
                        temp: [...currentChart.temp, wsData.data.temp].slice(-historyLimit),
                        humidity: [...currentChart.humidity, wsData.data.humidity].slice(-historyLimit)
                    }
                };
            });
        } else if (wsData && (wsData.type === 'water' || wsData.type === 'water_sensor')) {
            const incomingId = (wsData as any).id || 'BW-01';
            const activeId = borewells[activeBorewellIndex]?.id;

            const incoming = wsData.data as any;
            const incomingLevel = incoming.waterLevel ?? incoming.level;
            const incomingIrms = incoming.current ?? incoming.irms;
            const hasPumpData = 'current' in incoming || 'irms' in incoming || 'status' in incoming;
            const hasTankData = 'waterLevel' in incoming || 'level' in incoming || 'ph' in incoming || 'tds' in incoming || 'turbidity' in incoming;

            const isZeroWater = hasTankData && (incomingLevel === 0 || incomingLevel === undefined) && incoming.ph === 0 && incoming.tds === 0;

            // 1. Process status updates for ALL borewells so their states remain correct
            // Force motor state to OFF if a zero-value packet is received
            const isIncomingMotorOn = !isZeroWater && (
                (wsData as any).isMotorOn === true ||
                incoming.isMotorOn === true ||
                (incoming.flowRate !== undefined && incoming.flowRate > 5.0) ||
                (incoming.flow !== undefined && incoming.flow > 5.0) ||
                incoming.status === 'ON' ||
                (incomingIrms !== undefined && incomingIrms > 1.1)
            );
            if (hasPumpData || isZeroWater) {
                setBorewells(prev => prev.map(bw => {
                    if (bw.id === incomingId) {
                        return {
                            ...bw,
                            isMotorOn: isIncomingMotorOn,
                            runTime: incoming.runTime !== undefined ? incoming.runTime * 3600 : bw.runTime
                        };
                    }
                    return bw;
                }));
            }

            // Discard the update if it is a zero-packet to preserve the last known valid historical snapshot
            if (isZeroWater) {
                return;
            }

            // 2. Only update waterData if the ID matches the selected/active borewell
            if (incomingId && activeId && incomingId !== activeId) {
                return;
            }

            setWaterData(prev => {
                const incomingLevel = incoming.waterLevel ?? incoming.level;

                const hasTankData = 'waterLevel' in incoming || 'level' in incoming || 'ph' in incoming || 'tds' in incoming || 'turbidity' in incoming;
                const currentChart = prev?.chartData || { labels: [], level: [], ph: [], tds: [], turbidity: [] };

                let newLabels = currentChart.labels;
                let newLevelArr = currentChart.level;
                let newPhArr = currentChart.ph;
                let newTdsArr = currentChart.tds;
                let newTurbidityArr = currentChart.turbidity || [];

                // Only append to the chart history if this was a water tank reading
                if (hasTankData) {
                    const timeLabel = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    newLabels = [...currentChart.labels, timeLabel].slice(-historyLimit);
                    newLevelArr = [...currentChart.level, incomingLevel ?? prev?.level ?? 4.5].slice(-historyLimit);
                    newPhArr = [...currentChart.ph, incoming.ph ?? prev?.ph ?? 7.2].slice(-historyLimit);
                    newTdsArr = [...currentChart.tds, incoming.tds ?? prev?.tds ?? 250].slice(-historyLimit);
                    newTurbidityArr = [...(currentChart.turbidity || []), incoming.turbidity ?? prev?.turbidity ?? 1.2].slice(-historyLimit);

                    // Offline heartbeat update ONLY if it's a valid tank reading
                    const isZeroWater = (incomingLevel === 0 || incomingLevel === undefined) && incoming.ph === 0 && incoming.tds === 0;
                    if (!isZeroWater) {
                        setLastWaterTime(Date.now());
                    }
                }

                // If it's a pump reading, update the heartbeat regardless
                if (hasPumpData) {
                    setLastWaterTime(Date.now());
                }
                // Derive pump/water status band for gauges
                let derivedStatus: string | null = prev?.pump_status ?? null;

                if (hasPumpData) {
                    if (incoming.status && typeof incoming.status === "string") {
                        derivedStatus = (incoming as any).status.toUpperCase();
                    } else {
                        const irms = incomingIrms ?? 0;
                        if (irms < 2) derivedStatus = "OFF";
                        else if (irms < 4) derivedStatus = "LOW";
                        else if (irms < 7) derivedStatus = "MID";
                        else if (irms < 12) derivedStatus = "HIGH";
                        else derivedStatus = "CHARGING";
                    }
                } else if (!prev?.pump_status || prev.pump_status === 'N/A') {
                    const level = incomingLevel ?? prev?.level ?? 4.5;
                    if (level < 2) derivedStatus = "OFF";
                    else if (level < 4) derivedStatus = "LOW";
                    else if (level < 7) derivedStatus = "MID";
                    else if (level < 12) derivedStatus = "HIGH";
                    else derivedStatus = "CHARGING";
                }

                return {
                    level: incomingLevel ?? (prev?.level ?? 4.5),
                    ph: incoming.ph ?? (prev?.ph ?? 7.2),
                    tds: incoming.tds ?? (prev?.tds ?? 250),
                    irms: incomingIrms ?? (prev?.irms ?? 0),
                    flowRate: incoming.flowRate ?? (prev?.flowRate ?? 0),
                    efficiency: incoming.efficiency ?? (prev?.efficiency ?? 0),
                    voltage: incoming.voltage ?? (prev?.voltage ?? 0),
                    runTime: incoming.runTime ?? (prev?.runTime ?? 0),
                    turbidity: incoming.turbidity ?? (prev?.turbidity ?? 1.2),
                    pump_status: incoming.currentStatus ?? (hasPumpData ? (derivedStatus ?? 'N/A') : (prev?.pump_status ?? 'N/A')),
                    totalLiters: incoming.totalLiters ?? prev?.totalLiters,
                    currentStatus: incoming.currentStatus ?? prev?.currentStatus,
                    waterStatus: incoming.waterStatus ?? prev?.waterStatus,
                    turbidityStatus: incoming.turbidityStatus ?? prev?.turbidityStatus,
                    tdsStatus: incoming.tdsStatus ?? prev?.tdsStatus,
                    chartData: {
                        labels: newLabels,
                        level: newLevelArr,
                        ph: newPhArr,
                        tds: newTdsArr,
                        turbidity: newTurbidityArr
                    }
                }
            });
        } else if (wsData && (wsData.type as string) === 'control_update') {
            const incomingId = (wsData as any).id;
            const isMotorOn = (wsData as any).is_motor_on;
            setBorewells(prev => prev.map(bw =>
                bw.id === incomingId ? { ...bw, isMotorOn } : bw
            ));
        }
    }, [wsData, demoMode, activeBorewellIndex, borewells]);

    // 5. DEMO MODE: generate realistic random data so UI is functional without backend
    useEffect(() => {
        if (!demoMode) return;

        // Seed locations/devices once
        const demoLocs = [
            { location_id: "HYD-01", name: "HYD-01", latitude: 17.3850, longitude: 78.4867, online: true, last_seen: new Date().toISOString() },
            { location_id: "HYD-02", name: "HYD-02", latitude: 17.3616, longitude: 78.4747, online: true, last_seen: new Date().toISOString() },
            { location_id: "HYD-03", name: "HYD-03", latitude: 17.4065, longitude: 78.4772, online: true, last_seen: new Date().toISOString() },
        ];

        setCapabilities({ has_aqi: true, has_water: true });
        setIsSystemOnline(true);

        setLocationsStatus(() => {
            const m: Record<string, any> = {};
            for (const l of demoLocs) m[l.location_id] = l;
            return m;
        });

        setMyDevices([
            { device_id: "AQI-CAM-01", type: "aqi_camera", status: "ONLINE", location_id: "HYD-01", location_name: "HYD-01", last_seen: new Date().toISOString() },
            { device_id: "AIR-SENS-02", type: "aqi", status: "ONLINE", location_id: "HYD-02", location_name: "HYD-02", last_seen: new Date().toISOString() },
            { device_id: "WATER-01", type: "water_sensor", status: "ONLINE", location_id: "HYD-01", location_name: "HYD-01", last_seen: new Date().toISOString() },
            { device_id: "PUMP-01", type: "pump_monitor", status: "ONLINE", location_id: "HYD-03", location_name: "HYD-03", last_seen: new Date().toISOString() },
        ]);

        if (!currentLocation) {
            setCurrentLocation("HYD-01");
        }

        // Initialize baseline values if missing
        setAirData(prev => prev ?? ({
            pm25: rand(8, 25),
            pm10: rand(15, 45),
            co2: rand(400, 650),
            tvoc: rand(0.05, 0.15),
            hcho: rand(0.01, 0.05),
            temp: rand(22, 28),
            humidity: rand(45, 65),
            chartData: { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] }
        }));

        setWaterData(prev => prev ?? ({
            level: rand(2, 12),
            ph: rand(6.8, 8.2),
            tds: rand(1, 9),
            irms: rand(0.5, 9),
            pump_status: "MID",
            chartData: { labels: [], level: [], ph: [], tds: [] }
        }));

        const tick = () => {
            if (!isSystemOnline) return;
            const label = timeLabelNow();

            setAirData(prev => {
                const p = prev ?? ({
                    pm25: 12, pm10: 25, co2: 450, tvoc: 0.1, hcho: 0.02, temp: 24, humidity: 55,
                    chartData: { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] }
                });

                const spike = Math.random() < 0.08;
                const pm25 = clamp(nextRandomWalk(p.pm25, spike ? 10 : 3, 0, 150), 0, 150);
                const pm10 = clamp(nextRandomWalk(p.pm10, spike ? 20 : 6, 0, 250), 0, 250);
                const co2 = clamp(nextRandomWalk(p.co2, spike ? 150 : 40, 400, 3000), 400, 3000);
                const tvoc = clamp(nextRandomWalk(p.tvoc, 0.02, 0, 2), 0, 2);
                const hcho = clamp(nextRandomWalk(p.hcho, 0.01, 0, 0.5), 0, 0.5);
                const temp = clamp(nextRandomWalk(p.temp, 0.2, 10, 45), 10, 45);
                const humidity = clamp(nextRandomWalk(p.humidity, 1, 10, 95), 10, 95);

                const c = p.chartData ?? { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] };
                const newLabels = [...c.labels, label].slice(-historyLimit);

                setLastAirTime(Date.now());

                return {
                    pm25, pm10, co2, tvoc, hcho, temp, humidity,
                    chartData: {
                        labels: newLabels,
                        pm25: [...c.pm25, pm25].slice(-historyLimit),
                        pm10: [...c.pm10, pm10].slice(-historyLimit),
                        co2: [...c.co2, co2].slice(-historyLimit),
                        tvoc: [...c.tvoc, tvoc].slice(-historyLimit),
                        hcho: [...c.hcho, hcho].slice(-historyLimit),
                        temp: [...c.temp, temp].slice(-historyLimit),
                        humidity: [...c.humidity, humidity].slice(-historyLimit),
                    }
                };
            });

            setWaterData(prev => {
                const p = prev ?? ({
                    level: 6.5, ph: 7.4, tds: 8, irms: 3.2, pump_status: "MID",
                    chartData: { labels: [], level: [], ph: [], tds: [] }
                });

                // USE LINKED SIMULATION: Level reacts to motor status
                const level = calculateNextWaterLevel(p.level, isMotorOn, {
                    extractionRate: 0.15, // Faster drop when motor is on
                    rechargeRate: 0.05,   // Slower recharge when off
                });

                const ph = clamp(nextRandomWalk(p.ph, 0.06, 6.2, 8.8), 6.2, 8.8);
                const tds = clamp(nextRandomWalk(p.tds, 25, 50, 1800), 50, 1800);

                // Pump current follows motor state
                let irms = 0;
                let pump_status = "OFF";

                if (isMotorOn) {
                    const baseIrms = level < 2 ? rand(9.5, 12.5) : level < 4 ? rand(7.0, 9.5) : rand(4.5, 7.5);
                    irms = clamp(nextRandomWalk(baseIrms, 0.4, 0.1, 15), 0.1, 15);

                    if (irms < 4) pump_status = "LOW";
                    else if (irms < 7) pump_status = "MID";
                    else if (irms < 12) pump_status = "HIGH";
                    else pump_status = "CHARGING";
                }

                setLastWaterTime(Date.now());

                const c = p.chartData ?? { labels: [], level: [], ph: [], tds: [] };
                const newLabels = [...c.labels, label].slice(-historyLimit);

                return {
                    level, ph, tds, irms, pump_status,
                    chartData: {
                        labels: newLabels,
                        level: [...c.level, level].slice(-historyLimit),
                        ph: [...c.ph, ph].slice(-historyLimit),
                        tds: [...c.tds, tds].slice(-historyLimit),
                    }
                };
            });

            // Update location last_seen so map popups look alive
            setLocationsStatus(prev => {
                const updated: Record<string, any> = { ...prev };
                for (const [k, v] of Object.entries(updated)) {
                    updated[k] = { ...v, online: true, last_seen: new Date().toISOString() };
                }
                return updated;
            });
        };

        // Runs every 8 seconds for a dynamic HR Demo (previously 2 mins)
        const interval = setInterval(tick, 8000);
        // Prime ~10 points so charts have an initial trend
        for (let i = 0; i < 10; i++) tick();

        return () => clearInterval(interval);
    }, [demoMode, currentLocation, isSystemOnline, isMotorOn]);

    const handleMotorToggle = (index: number) => {
        const borewellId = borewells[index]?.id;
        if (!borewellId) return;
        const currentStatus = borewells[index]?.isMotorOn ? 'OFF' : 'ON';

        // Update UI immediately (Optimistic)
        setBorewells(prev => prev.map((bw, i) =>
            i === index ? { ...bw, isMotorOn: !bw.isMotorOn } : bw
        ));

        // Sync with Real Backend if not in demo
        if (!demoMode) {
            apiClient("/api/control", {
                method: 'POST',
                token,
                body: JSON.stringify({ id: borewellId, command: currentStatus })
            }).catch(err => {
                console.error("Control Sync Failed:", err);
                toast.error(`Pump command failed. Reverting motor state.`);
                // Rollback state
                setBorewells(prev => prev.map((bw, i) =>
                    i === index ? { ...bw, isMotorOn: !bw.isMotorOn } : bw
                ));
            });
        }
    };

    // --- REAL BACKEND INITIAL SYNC ---
    useEffect(() => {
        if (demoMode) return;
        if (!token) return; // Prevent raw requests on mount before token loads

        // 1. Fetch current states
        apiClient("/api/borewells", { token })
            .then(data => {
                if (Array.isArray(data)) {
                    const sortedBw = data
                        .map(bw => ({
                            id: bw.id,
                            isMotorOn: bw.is_motor_on === 1,
                            runTime: bw.run_time_total
                        }))
                        .sort((a, b) => a.id.localeCompare(b.id));
                    setBorewells(sortedBw);

                    // Update current water data with latest values from DB
                    const activeId = sortedBw[activeBorewellIndex]?.id;
                    const active = data.find(bw => bw.id === activeId);
                    if (active) {
                        if (active.last_updated) {
                            const utcStr = active.last_updated.replace(' ', 'T') + 'Z';
                            const lastTime = new Date(utcStr).getTime();
                            if (!isNaN(lastTime)) {
                                setLastWaterTime(lastTime);
                            }
                        }
                        const isDbZero = active.ph === 0 && active.tds === 0 && (active.water_level === 0 || active.water_level === null);
                        setWaterData(prev => ({
                            ...prev,
                            level: isDbZero ? (prev?.level ?? 0) : (active.water_level ?? prev?.level ?? 0),
                            ph: isDbZero ? (prev?.ph ?? 7.2) : (active.ph || prev?.ph || 7.2),
                            tds: isDbZero ? (prev?.tds ?? 250) : (active.tds || prev?.tds || 250),
                            irms: active.current ?? prev?.irms ?? 0,
                            flowRate: active.flow_rate ?? prev?.flowRate ?? 0,
                            efficiency: active.efficiency ?? prev?.efficiency ?? 0,
                            voltage: active.voltage ?? prev?.voltage ?? 0,
                            runTime: active.run_time_total ?? prev?.runTime ?? 0,
                            turbidity: isDbZero ? (prev?.turbidity ?? 1.2) : (active.turbidity || prev?.turbidity || 1.2),
                            pump_status: active.current_status || (active.is_motor_on ? "MID" : "OFF"),
                            totalLiters: active.total_liters ?? prev?.totalLiters,
                            currentStatus: active.current_status,
                            waterStatus: active.water_status,
                            turbidityStatus: active.turbidity_status,
                            tdsStatus: active.tds_status
                        } as any));
                    }
                }
            })
            .catch(err => console.warn("Failed to fetch borewells state:", err));

        // 2. Fetch History for Charts
        const activeId = borewells[activeBorewellIndex]?.id;
        if (activeId) {
            const limit = timeRange === "1h" ? 50 : timeRange === "24h" ? 300 : 1000;
            apiClient(`/api/history/${activeId}?limit=${limit}`, { token })
                .then(history => {
                    if (Array.isArray(history)) {
                        setWaterData(prev => {
                            const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
                            const levels = history.map(h => h.water_level);
                            const phs = history.map(h => h.ph || 7.2);
                            const tdss = history.map(h => h.tds || 250);
                            const turbidities = history.map(h => h.turbidity || 1.2);

                            return {
                                ...prev,
                                chartData: {
                                    labels: labels,
                                    level: levels,
                                    ph: phs,
                                    tds: tdss,
                                    turbidity: turbidities
                                }
                            } as any;
                        });
                    }
                })
                .catch(err => console.warn(`Failed to fetch history for ${activeId}:`, err));
        }

        const aqiLimit = timeRange === "1h" ? 100 : timeRange === "24h" ? 300 : 1000;
        apiClient(`/api/aqi/history?limit=${aqiLimit}`, { token })
            .then(history => {
                if (Array.isArray(history)) {
                    if (history.length > 0) {
                        const latest = history[history.length - 1];
                        if (latest && latest.timestamp) {
                            const utcStr = latest.timestamp.replace(' ', 'T') + 'Z';
                            const lastTime = new Date(utcStr).getTime();
                            if (!isNaN(lastTime)) {
                                setLastAirTime(lastTime);
                            }
                        }
                    }
                    setAirData(prev => {
                        const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
                        const pm25s = history.map(h => h.pm25);
                        const pm10s = history.map(h => h.pm10);
                        const co2s = history.map(h => h.co2);
                        const tvocs = history.map(h => h.tvoc);
                        const hchos = history.map(h => h.hcho);
                        const temps = history.map(h => h.temp);
                        const hums = history.map(h => h.humidity);

                        return {
                            ...prev,
                            pm25: history[history.length - 1]?.pm25 ?? prev?.pm25 ?? 0,
                            pm10: history[history.length - 1]?.pm10 ?? prev?.pm10 ?? 0,
                            co2: history[history.length - 1]?.co2 ?? prev?.co2 ?? 400,
                            tvoc: history[history.length - 1]?.tvoc ?? prev?.tvoc ?? 0,
                            hcho: history[history.length - 1]?.hcho ?? prev?.hcho ?? 0,
                            temp: history[history.length - 1]?.temp ?? prev?.temp ?? 0,
                            humidity: history[history.length - 1]?.humidity ?? prev?.humidity ?? 0,
                            chartData: {
                                labels: labels,
                                pm25: pm25s,
                                pm10: pm10s,
                                co2: co2s,
                                tvoc: tvocs,
                                hcho: hchos,
                                temp: temps,
                                humidity: hums
                            }
                        } as any;
                    });
                }
            })
            .catch(err => console.warn("Failed to fetch AQI history:", err));
    }, [demoMode, activeBorewellIndex, timeRange, token]);

    // Visual Effects... (Existing)
    const [stars, setStars] = useState<Array<{ left: string; top: string; delay: string; duration: string }>>([])
    const [weatherBg, setWeatherBg] = useState('')
    const [rainParticles, setRainParticles] = useState<Array<{ left: string; delay: string; duration: string }>>([])
    // Full live WeatherAPI payload lifted from WeatherWidget
    const [weatherFull, setWeatherFull] = useState<WeatherPayload | null>(null)

    // Stable callback â€” useCallback prevents WeatherWidget from infinite-looping on every render
    const handleConditionChange = useCallback((c: string) => {
        const lower = c.toLowerCase()
        if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower') || lower.includes('thunder')) setWeatherBg('rain')
        else if (lower.includes('cloud') || lower.includes('overcast')) setWeatherBg('cloudy')
        else if (lower.includes('sun') || lower.includes('clear') || lower.includes('bright')) setWeatherBg('sunny')
        else setWeatherBg('clear')
    }, [])
    // Lift the typed WeatherAPI payload so each tile can consume live fields directly
    const handleWeatherLoad = useCallback((data: WeatherPayload) => {
        setWeatherFull(data)
    }, [])
    useEffect(() => {
        if (waterData) setMaxWaterLevel((prev) => Math.max(prev, waterData.level))
    }, [waterData])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: (e.clientX / window.innerWidth - 0.5) * 20, y: (e.clientY / window.innerHeight - 0.5) * 20 })
        }
        window.addEventListener("mousemove", handleMouseMove)
        return () => window.removeEventListener("mousemove", handleMouseMove)
    }, [])

    useEffect(() => {
        setStars(Array.from({ length: 100 }).map(() => ({
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 3}s`,
            duration: `${2 + Math.random() * 2}s`,
        })))
    }, [])

    useEffect(() => {
        setRainParticles(Array.from({ length: 20 }).map(() => ({
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 2.5}s`,
            duration: `${2 + Math.random() * 1.5}s`,
        })))
    }, [])

    const safeAirData = useMemo(() => airData || {
        pm25: 0, pm10: 0, co2: 400, tvoc: 0, hcho: 0, temp: 0, humidity: 0,
        chartData: { labels: [], pm25: [], pm10: [], co2: [], tvoc: [], hcho: [], temp: [], humidity: [] }
    }, [airData]);

    const safeWaterData = useMemo(() => ({
        level: Number(waterData?.level ?? 0),
        ph: Number(waterData?.ph ?? 7.2),
        tds: Number(waterData?.tds ?? 250),
        irms: Number(waterData?.irms ?? 0),
        pump_status: waterData?.pump_status ?? 'N/A',
        flowRate: Number(waterData?.flowRate ?? 0),
        efficiency: Number(waterData?.efficiency ?? 0),
        voltage: Number(waterData?.voltage ?? 0),
        runTime: Number(waterData?.runTime ?? 0),
        turbidity: Number(waterData?.turbidity ?? 1.2),
        totalLiters: (waterData?.totalLiters !== undefined && waterData?.totalLiters !== null) ? Number(waterData.totalLiters) : undefined,
        currentStatus: waterData?.currentStatus,
        waterStatus: waterData?.waterStatus,
        turbidityStatus: waterData?.turbidityStatus,
        tdsStatus: waterData?.tdsStatus,
        chartData: waterData?.chartData || { labels: [], level: [], ph: [], tds: [] }
    }), [waterData]);
    const maxPm25Recorded = airData ? Math.max(airData.pm25, ...(airData.chartData?.pm25 || [])) : 0;
    const maxWaterLevelRecorded = waterData ? Math.max(waterData.level, ...(waterData.chartData?.level || [])) : 0;

    const historicalReadings = useMemo(
        () =>
            buildHistoricalReadingsSeries(
                readingsPeriod,
                safeWaterData.level,
                safeAirData.pm25,
                isWaterOffline
            ),
        [readingsPeriod, safeWaterData.level, safeAirData.pm25, isWaterOffline]
    )

    const yearlyWaterComparison = useMemo(
        () => buildYearlyMonthlyWaterLevelComparison(safeWaterData.level, isWaterOffline),
        [safeWaterData.level, isWaterOffline]
    )

    // --- INTERACTION HANDLERS ---
    const handleTileClick = (metric: string | null) => {
        setSelectedPollutant(prev => prev === metric ? null : metric);
    }

    const handleWaterTileClick = (metric: string | null) => {
        setSelectedWaterMetric(prev => prev === metric ? null : metric);
    }

    // Fullscreen Modal Data Mapping
    const getModalData = () => {
        if (modalConfig.type === 'aqi' && safeAirData.chartData?.labels?.length > 0) {
            return safeAirData.chartData.labels.map((l, i) => ({
                time: l,
                pm25: safeAirData.chartData.pm25?.[i] ?? 0,
                pm10: safeAirData.chartData.pm10?.[i] ?? 0,
                co2: safeAirData.chartData.co2?.[i] ?? 400,
                tvoc: safeAirData.chartData.tvoc?.[i] ?? 0,
                hcho: safeAirData.chartData.hcho?.[i] ?? 0,
                temp: safeAirData.chartData.temp?.[i] ?? 0,
                humidity: safeAirData.chartData.humidity?.[i] ?? 0,
            }));
        }
        if (modalConfig.type === 'water' && safeWaterData.chartData?.labels?.length > 0) {
            return safeWaterData.chartData.labels.map((l, i) => ({
                time: l,
                level: safeWaterData.chartData.level?.[i] ?? 0,
                ph: safeWaterData.chartData.ph?.[i] ?? 7.2,
                tds: safeWaterData.chartData.tds?.[i] ?? 250,
                turbidity: (safeWaterData.chartData as any).turbidity?.[i] ?? 0,
            }));
        }
        return [];
    }

    if (!mounted || isInitialLoading) return <LoadingScreen />;

    return (
        <div className={`relative min-h-screen overflow-hidden transition-all duration-1000 ${isSystemOnline ? 'bg-[#050511]' : 'bg-[radial-gradient(circle_at_center,_#0b2a44,_#061a2b)]'}`}>
            {/* Offline Banner Removed as requested */}

            <SidebarNavigation
                isOpen={isSidebarOpen}
                onToggle={() => setIsSidebarOpen((v) => !v)}
                activeView={activeView}
                onNavigate={setActiveView}
            />

            <div className="transition-all duration-700">

                {/* Animated Background */}
                <div className="fixed inset-0 z-0">
                    {/* Layer 0: Base gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0a0520] via-[#050511] to-[#000208]" />
                    {/* Layer 1: Background Video (blended, 12% opacity) */}
                    <video
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="absolute inset-0 h-full w-full object-cover pointer-events-none mix-blend-luminosity"
                        src="/bg-earth.mp4"
                        style={{ filter: "brightness(0.55) contrast(1.08) saturate(0.55) hue-rotate(200deg)", opacity: 0.95 }}
                    />
                    {/* Layer 2: Weather Atmosphere (condition-reactive, 6-10% opacity) */}
                    <div
                        className={`absolute inset-0 pointer-events-none transition-all duration-[3000ms] ${
                            weatherBg === 'rain'   ? 'bg-blue-900/[0.18]' :
                            weatherBg === 'sunny'  ? 'bg-amber-500/[0.10]' :
                            weatherBg === 'cloudy' ? 'bg-slate-600/[0.14]' :
                            ''
                        }`}
                    />
                    {/* Rain particles â€” rendered only when raining */}
                    {weatherBg === 'rain' && rainParticles.map((p, i) => (
                        <div
                            key={i}
                            className="rain-particle"
                            style={{ left: p.left, animationDelay: p.delay, animationDuration: p.duration }}
                        />
                    ))}
                    {/* Layer 3: Mouse parallax glows */}
                    {isSystemOnline && (
                        <>
                            <div className="hidden lg:block absolute h-[600px] w-[600px] rounded-full bg-gradient-to-br from-emerald-600/20 via-cyan-600/10 to-transparent blur-[100px]" style={{ left: `calc(15% + ${mousePosition.x}px)`, top: `calc(15% + ${mousePosition.y}px)`, transition: "left 0.3s ease-out, top 0.3s ease-out" }} />
                            <div className="hidden lg:block animation-delay-2000 absolute h-[500px] w-[500px] rounded-full bg-gradient-to-br from-purple-600/15 via-indigo-600/10 to-transparent blur-[100px]" style={{ right: `calc(10% + ${-mousePosition.x}px)`, top: `calc(20% + ${-mousePosition.y}px)`, transition: "right 0.3s ease-out, top 0.3s ease-out" }} />
                        </>
                    )}
                    {/* Layer 4: Stars */}
                    <div className="absolute inset-0 opacity-70">
                        {stars.map((star, i) => (
                            <div key={i} className={`absolute h-[2px] w-[2px] rounded-full bg-white ${isSystemOnline ? 'lg:animate-twinkle' : ''}`} style={{ left: star.left, top: star.top, animationDelay: star.delay, animationDuration: star.duration }} />
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 flex min-h-screen lg:h-screen flex-col lg:overflow-hidden">
                    {/* Header - Compact */}
                    <header className="flex items-center justify-between border-b border-white/5 px-4 py-2 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsSidebarOpen((v) => !v)}
                                className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-transparent bg-transparent transition-all duration-300 hover:bg-white/10"
                                aria-label="Toggle menu"
                            >
                                <div className="relative h-5 w-5">
                                    <span
                                        className={`absolute left-0 top-0 h-0.5 w-5 rounded-full bg-emerald-400 transition-all duration-300 ${isSidebarOpen ? "top-2.5 rotate-45" : ""
                                            }`}
                                    />
                                    <span
                                        className={`absolute left-0 top-2 h-0.5 w-5 rounded-full bg-emerald-400 transition-all duration-300 ${isSidebarOpen ? "opacity-0" : ""
                                            }`}
                                    />
                                    <span
                                        className={`absolute left-0 top-4 h-0.5 w-5 rounded-full bg-emerald-400 transition-all duration-300 ${isSidebarOpen ? "top-2.5 -rotate-45" : ""
                                            }`}
                                    />
                                </div>
                            </button>
                            <div>
                                <img src={tenantConfig?.logo_url || "/logo.png"} alt={tenantConfig?.name || "Planet Insights"} className="h-6 object-contain" />
                            </div>
                            {currentLocation && (
                                <div className="ml-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-emerald-400 border border-emerald-500/20">
                                    {tenantConfig?.name ? tenantConfig.name.toUpperCase() : 'LOC'}: {currentLocation}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${locationStatus === 'ONLINE'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : locationStatus === 'PARTIAL'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                                }`}>
                                {locationStatus === 'ONLINE' ? (
                                    <Wifi className="h-3 w-3" />
                                ) : locationStatus === 'PARTIAL' ? (
                                    <Wifi className="h-3 w-3 animate-pulse" />
                                ) : (
                                    <WifiOff className="h-3 w-3" />
                                )}
                                {locationStatus}
                            </div>
                            {lastMessageTime && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                    {new Date(lastMessageTime).toLocaleTimeString()}
                                </span>
                            )}
                        </div>
                    </header>

                    {/* View Switcher - Standard window scrolling on mobile for stability */}
                    <main className="flex-1 overflow-x-hidden overflow-y-auto lg:overflow-hidden p-2">
                        {activeView === "dashboard" ? (
                            <div className="flex flex-col lg:grid lg:h-full lg:grid-cols-[35%_33%_32%] lg:grid-rows-[1fr_1fr_0.9fr] gap-4 lg:gap-2.5">

                                {/* â”€â”€â”€ COL 1 ROW 1: Aquifer Monitor (no change) â”€â”€â”€ */}
                                <div className="lg:col-start-1 lg:row-start-1 overflow-hidden min-h-[250px] lg:min-h-0">
                                    <ErrorBoundary title="Borewell Monitor">
                                        <BorewellMonitorCard
                                            activeBorewellIndex={activeBorewellIndex}
                                            onBorewellChange={setActiveBorewellIndex}
                                            isMotorOn={isMotorOn}
                                            onMotorToggle={() => handleMotorToggle(activeBorewellIndex)}
                                            data={{
                                                flowRate: isMotorOn
                                                    ? Number(safeWaterData.flowRate || (demoMode ? rand(35 + activeBorewellIndex * 5, 55 + activeBorewellIndex * 5) : 0)).toFixed(1)
                                                    : "0.0",
                                                efficiency: isMotorOn
                                                    ? Number(safeWaterData.efficiency || (demoMode ? Math.min(95, Math.max(40, Math.round(((safeWaterData.flowRate || 45) * 15) / (safeWaterData.irms || 8.4)))) : 0)).toFixed(0)
                                                    : "0",
                                                voltage: isMotorOn
                                                    ? Number(safeWaterData.voltage || (demoMode ? rand(228, 242) : 0)).toFixed(0)
                                                    : "0",
                                                current: isMotorOn
                                                    ? Number(safeWaterData.irms || (demoMode ? rand(7.8, 9.2) : 0)).toFixed(1)
                                                    : "0.0",
                                                runTime: Number(safeWaterData.runTime || 0).toFixed(2),
                                                liters: (safeWaterData.totalLiters !== undefined && safeWaterData.totalLiters !== null)
                                                    ? Number(safeWaterData.totalLiters).toFixed(1)
                                                    : (demoMode && isMotorOn
                                                        ? (safeWaterData.flowRate
                                                            ? Number(safeWaterData.flowRate * (motorRunTime / 60)).toFixed(0)
                                                            : (800 + activeBorewellIndex * 100).toString())
                                                        : "0.0")
                                            }}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* ——— COL 2 ROW 1: Surrounding Conditions (Weather) ——— */}
                                <div className="lg:col-start-2 lg:row-start-1 overflow-hidden min-h-[300px] lg:min-h-0">
                                    <ErrorBoundary title="Surrounding Conditions">
                                        <WeatherWidget token={token} onConditionChange={handleConditionChange} onWeatherLoad={handleWeatherLoad} />
                                    </ErrorBoundary>
                                </div>

                                {/* ——— COL 3 ROW 1: Environment Intel Hub ——— */}
                                <div className="lg:col-start-3 lg:row-start-1 overflow-hidden min-h-[300px] lg:min-h-0">
                                    <ErrorBoundary title="Environment Intel">
                                        <EnvironmentIntelTile
                                            weather={{
                                                temp_c:     weatherFull?.temp_c,
                                                humidity:   weatherFull?.humidity,
                                                wind_kph:   weatherFull?.wind_kph,
                                                wind_degree: weatherFull?.wind_degree,
                                                gust_kph:   weatherFull?.gust_kph,
                                                aqi_pm25:   safeAirData?.pm25,
                                                aqi_co:     safeAirData?.co2,
                                            }}
                                            water={{
                                                level:     safeWaterData?.level,
                                                ph:        safeWaterData?.ph,
                                                tds:       safeWaterData?.tds,
                                                turbidity: safeWaterData?.turbidity,
                                            }}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* ——— COL 1 ROW 2: WQI Analysis + Pump Monitor ——— */}
                                <div className="lg:col-start-1 lg:row-start-2 overflow-hidden min-h-[300px] lg:min-h-0">
                                    <ErrorBoundary title="Water Analysis">
                                        <WaterAnalysisSplit
                                            waterData={{
                                                ...safeWaterData,
                                                level: safeWaterData.level || (demoMode ? (isMotorOn ? rand(4.2, 5.8) : rand(1.2, 2.5)) : 0),
                                                irms: safeWaterData.irms || (demoMode ? (isMotorOn ? rand(7.8, 9.2) : 0) : 0),
                                                tds: safeWaterData.tds || (demoMode ? rand(210, 240) : 0),
                                                ph: safeWaterData.ph || (demoMode ? rand(6.8, 7.4) : 0),
                                                turbidity: safeWaterData.turbidity || (demoMode ? rand(0.8, 1.8) : 0)
                                            }}
                                            maxWaterLevel={10}
                                            waterStatus={isMotorOn ? "ACTIVE" : "STANDBY"}
                                            isMotorOn={isMotorOn}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* â”€â”€â”€ COL 2 ROW 2: AQI Pollutant Hub â”€â”€â”€ */}
                                <div className="lg:col-start-2 lg:row-start-2 h-full flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
                                    <ErrorBoundary title="AQI Pollutant Hub">
                                        <AQIPollutantHub
                                            data={safeAirData}
                                            activeMetric={selectedPollutant}
                                            onMetricSelect={handleTileClick}
                                            isOffline={isAirOffline}
                                            mode="compact"
                                            timeRange={timeRange}
                                            onTimeRangeChange={setTimeRange}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* â”€â”€â”€ COL 3 ROW 2: Sunrise / Sunset â”€â”€â”€ */}
                                <div className="lg:col-start-3 lg:row-start-2 overflow-hidden min-h-[280px] lg:min-h-0">
                                    <ErrorBoundary title="Sunrise Sunset">
                                        <SunriseSunsetTile
                                            sunrise={weatherFull?.sunrise}
                                            sunset={weatherFull?.sunset}
                                            uv={weatherFull?.uv}
                                            precip_mm={weatherFull?.precip_mm}
                                            vis_km={weatherFull?.vis_km}
                                            humidity={weatherFull?.humidity}
                                            wind_kph={weatherFull?.wind_kph}
                                            pressure_mb={weatherFull?.pressure_mb}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* â”€â”€â”€ COL 1 ROW 3: Water Level Trend â”€â”€â”€ */}
                                <div className="lg:col-start-1 lg:row-start-3 overflow-hidden min-h-[250px] lg:min-h-0">
                                    <ErrorBoundary title="Water Quality Card">
                                        <WaterQualityCard
                                            data={{
                                                ...safeWaterData,
                                                chartData: (safeWaterData.chartData && safeWaterData.chartData.labels && safeWaterData.chartData.labels.length > 0)
                                                    ? safeWaterData.chartData
                                                    : (demoMode ? {
                                                        labels: Array(24).fill(0).map((_, i) => `${i}:00`),
                                                        level: Array(24).fill(0).map(() => rand(40, 50)),
                                                        ph: Array(24).fill(0).map(() => rand(6.8, 7.5)),
                                                        tds: Array(24).fill(0).map(() => rand(200, 230)),
                                                        turbidity: Array(24).fill(0).map(() => rand(0.8, 1.8))
                                                    } : {
                                                        labels: [],
                                                        level: [],
                                                        ph: [],
                                                        tds: [],
                                                        turbidity: []
                                                    })
                                            }}
                                            activeMetric={selectedWaterMetric}
                                            onMetricSelect={handleWaterTileClick}
                                            onExpand={() => setModalConfig({ isOpen: true, type: 'water' })}
                                            isOffline={isWaterOffline}
                                            mode="line-only"
                                            isMotorOn={isMotorOn}
                                        />
                                    </ErrorBoundary>
                                </div>

                                {/* â”€â”€â”€ COL 2 ROW 3: Sensor Status (no change) â”€â”€â”€ */}
                                <div className="lg:col-start-2 lg:row-start-3 h-full flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                                    <div className="dash-tile relative flex h-full flex-col rounded-2xl bg-[rgba(8,15,38,0.45)] border border-white/[0.11] shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)] p-3 overflow-hidden">
                                        <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 border-b border-white/5 pb-1 shrink-0">Sensor Status</h3>
                                        <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                            {(() => {
                                                const now = currentTime;
                                                const isWaterOnline = wsConnected && lastWaterTime > 0 && (now - lastWaterTime < 30000);
                                                const isAirOnline = wsConnected && lastAirTime > 0 && (now - lastAirTime < 30000);
                                                const isLoraHubOnline = isWaterOnline && isAirOnline ? true : (isAirOnline ? false : (isWaterOnline ? true : false));
                                                const isGwOnline = isWaterOnline && isAirOnline ? true : (isAirOnline ? false : (isWaterOnline ? true : false));
                                                const isWaterNodeOnline = isWaterOnline && isAirOnline ? true : (isAirOnline ? false : (isWaterOnline ? true : false));
                                                const isAqiNodeOnline = isWaterOnline && isAirOnline ? true : (isAirOnline ? true : (isWaterOnline ? false : false));

                                                return [
                                                    { device_id: "BW-GW-01", type: "GATEWAY", status: isGwOnline ? "ONLINE" : "OFFLINE" },
                                                    { device_id: "BW-NODE-01", type: "SENSOR", status: isWaterNodeOnline ? "ONLINE" : "OFFLINE" },
                                                    { device_id: "AQI-NODE-01", type: "SENSOR", status: isAqiNodeOnline ? "ONLINE" : "OFFLINE" },
                                                    { device_id: "LORA-HUB", type: "BASE", status: isLoraHubOnline ? "ONLINE" : "OFFLINE" }
                                                ];
                                            })().map((dev: any) => (
                                                <div
                                                    key={dev.device_id}
                                                    className="w-full flex cursor-pointer items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 transition-all hover:bg-white/[0.06] group"
                                                    onClick={() => dev.location_id && handleLocationSelect(dev.location_id)}
                                                    role="button"
                                                    aria-label={`View status details for device ${dev.device_id}`}
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            dev.location_id && handleLocationSelect(dev.location_id);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-7 w-7 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                                            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] font-bold text-white truncate">{dev.device_id}</div>
                                                            <div className="text-[8px] uppercase text-slate-500 truncate">{dev.type}</div>
                                                        </div>
                                                    </div>
                                                    <div 
                                                        role="status"
                                                        aria-label={`${dev.device_id} is ${dev.status}`}
                                                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[8px] font-bold uppercase shrink-0 ${dev.status?.toUpperCase() === 'ONLINE'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                                                            }`}
                                                    >
                                                        <div className={`h-1.5 w-1.5 rounded-full ${dev.status?.toUpperCase() === 'ONLINE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        {dev.status?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* â”€â”€â”€ COL 3 ROW 3: Wind Map â”€â”€â”€ */}
                                <div className="lg:col-start-3 lg:row-start-3 h-full flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                                    <ErrorBoundary title="Wind Map">
                                        <WindMapTile
                                            lat={weatherFull?.lat ?? locationsStatus[currentLocation]?.latitude}
                                            lon={weatherFull?.lon ?? locationsStatus[currentLocation]?.longitude}
                                        />
                                    </ErrorBoundary>
                                </div>

                            </div>
                        ) : (
                            /* DEVICES VIEW */
                            <div className="max-w-5xl mx-auto">
                                <h2 className="text-2xl font-bold text-white mb-6">My Hardware Devices</h2>
                                <div className="grid gap-4">
                                    {myDevices.map((dev) => (
                                        <div
                                            key={dev.device_id}
                                            onClick={() => dev.location_id && handleLocationSelect(dev.location_id)}
                                            className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/30 transition-colors">
                                                    <Cpu className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <div className="text-lg font-bold text-white">{dev.device_id}</div>
                                                    <div className="text-sm text-slate-400 uppercase tracking-widest">{dev.type}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8">
                                                <div className="flex items-center gap-2 text-slate-300">
                                                    <MapPin className="h-4 w-4 text-blue-400" />
                                                    {dev.location_name}
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${dev.status?.toUpperCase() === 'ONLINE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>
                                                        {dev.status?.toUpperCase() === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
                                                    </div>
                                                    {dev.last_seen && (
                                                        <div className="text-[10px] text-slate-500 font-mono">
                                                            Seen: {new Date(dev.last_seen).toLocaleTimeString()}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => handleDeleteDevice(dev.device_id, e)}
                                                    className="p-2 ml-4 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                                                    title="Remove Device"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {myDevices.length === 0 && (
                                        <div className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                            <p className="text-slate-400">No devices registered. Run the registration script!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </main>
                </div>

                {/* MODAL */}
                <ChartModal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                    chartType={modalConfig.type}
                    data={getModalData()}
                    selectedPollutant={selectedPollutant}
                    onPollutantSelect={handleTileClick}
                    selectedWaterMetric={selectedWaterMetric}
                    onWaterMetricSelect={handleWaterTileClick}
                    isMotorOn={isMotorOn}
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                />

                <RecentReadingsExpandModal
                    open={readingsModalOpen}
                    onClose={() => setReadingsModalOpen(false)}
                    waterLevels={historicalReadings.waterLevels}
                    labels={historicalReadings.labels}
                    period={readingsPeriod}
                    onPeriodChange={setReadingsPeriod}
                />
            </div>
        </div>
    )
}
