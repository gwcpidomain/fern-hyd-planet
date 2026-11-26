import { useEffect, useState, useRef } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

type RealtimeData = {
    location_id: string;
    device_id: string;
    type: "aqi" | "water" | "heartbeat" | "water_sensor" | "aqi_camera";
    timestamp: string;
    data: Record<string, number>;
};

export function useRealtimeData(locationId: string, token: string | null, tenantId?: string) {
    const [data, setData] = useState<RealtimeData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [isOffline, setIsOffline] = useState(true);
    const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const lastMessageRef = useRef<number>(0);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Guard: Do not attempt WebSocket connection without a valid location and token
        if (!locationId || !token) {
            setIsLive(false);
            setIsOffline(true);
            return;
        }

        const apiBase = getApiBaseUrl();
        const wsBase = apiBase.replace(/^http/, "ws"); // http->ws, https->wss
        const tokenQuery = `?token=${encodeURIComponent(token)}`;
        const wsUrl = `${wsBase}${tokenQuery}`;

        let reconnectAttempts = 0;

        const connect = () => {
            console.log(`🔌 Connecting to WS: ${wsUrl.split('?')[0]}`);
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log("✅ WebSocket Connected");
                setIsConnected(true);
                reconnectAttempts = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const payload: RealtimeData = JSON.parse(event.data);
                    
                    lastMessageRef.current = Date.now();
                    setLastMessageTime(Date.now());
                    setIsLive(true);
                    setIsOffline(false);

                    if (payload.type !== 'heartbeat') {
                        // Only process messages belonging to this tenant.
                        // Messages with no tenant_id (legacy / simulator) always pass through.
                        const msgTenant = (payload as any).tenant_id;
                        if (!msgTenant || !tenantId || msgTenant === tenantId) {
                            setData(payload);
                        }
                    }
                } catch (err) {
                    console.error("❌ Error parsing WS message:", err);
                }
            };

            ws.onclose = (event: CloseEvent) => {
                console.log(`❌ WebSocket Disconnected (code: ${event.code})`);
                setIsConnected(false);
                setIsLive(false);

                // If unauthorized (4001), server rejected token — do not reconnect in a loop
                if (event.code === 4001) {
                    console.warn("🚫 WebSocket unauthorized (4001). Reconnect paused until authentication is refreshed.");
                    return;
                }

                // Queue auto-reconnect with exponential backoff (max 30s)
                const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000);
                reconnectAttempts++;
                console.log(`🔄 Attempting reconnect in ${delay}ms...`);
                reconnectTimeoutRef.current = setTimeout(connect, delay);
            };

            ws.onerror = () => {
                // NOTE: Browser WebSocket onerror events do not expose error details for security reasons.
                // The connection will be closed and automatically reconnected via onclose → reconnect logic.
                console.warn(`⚠️ WebSocket connection failed (${wsUrl.split('?')[0]}). Reconnect queued...`);
                ws.close();
            };
        };

        connect();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    // PHASE 4 FIX: locationId is NOT used in the WS URL (URL is just ?token=...).
    // Keeping locationId here caused ws.close() + reconnect every time the user
    // switched borewell tabs or the initial location auto-corrected HYD-01 -> FERN-01.
    // Removed locationId from deps: socket now lives for the token lifetime only.
    }, [token]);

    // Single consolidated liveness checker
    useEffect(() => {
        const checkLiveness = () => {
            const now = Date.now();
            if (!lastMessageRef.current) {
                setIsLive(false);
                setIsOffline(true);
                return;
            }
            const diff = now - lastMessageRef.current;
            const offlineThreshold = 20000; // 20s
            setIsLive(diff < offlineThreshold);
            setIsOffline(diff >= offlineThreshold);
        };

        const interval = setInterval(checkLiveness, 2000); // Check every 2s
        checkLiveness();

        return () => clearInterval(interval);
    }, []);

    return { data, isConnected, isLive, lastMessageTime, isOffline };
}
