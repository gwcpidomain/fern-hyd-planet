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
        if (!locationId) {
            setIsLive(false);
            setIsOffline(true);
            return;
        }

        const apiBase = getApiBaseUrl();
        const wsBase = apiBase.replace(/^http/, "ws"); // http->ws, https->wss
        const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : "";
        const wsUrl = `${wsBase}${tokenQuery}`;

        let reconnectAttempts = 0;

        const connect = () => {
            console.log(`🔌 Connecting to WS: ${wsUrl}`);
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

            ws.onclose = () => {
                console.log("❌ WebSocket Disconnected");
                setIsConnected(false);
                setIsLive(false);

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
    }, [locationId, token]);

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
