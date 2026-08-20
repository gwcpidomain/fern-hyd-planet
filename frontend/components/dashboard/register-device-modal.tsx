"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { getApiBaseUrl } from "@/lib/api-url"
import { X, Cpu, MapPin, Loader2 } from "lucide-react"

interface RegisterDeviceModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function RegisterDeviceModal({ isOpen, onClose, onSuccess }: RegisterDeviceModalProps) {
    const { token } = useAuth()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form State
    const [deviceId, setDeviceId] = useState("")
    const [deviceType, setDeviceType] = useState("aqi-monitor") // Default
    const [locationName, setLocationName] = useState("")
    const [locationArea, setLocationArea] = useState("")
    const [lat, setLat] = useState("")
    const [lng, setLng] = useState("")

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            // Helper to get API URL
            const baseUrl = getApiBaseUrl()
            const apiUrl = `${baseUrl}/api/devices/register`

            // Construct payload matching backend RegisterDevicePayload
            const payload = {
                device_id: deviceId,
                device_type: deviceType, // Backend expects 'device_type', frontend state is 'deviceType'
                // owner_email is not needed if using token auth
                location_input: {
                    area: locationArea,
                    site_type: "STATION", // Defaulting to STATION since form doesn't have it. User's 'Location Name' is better as label.
                    label: locationName,
                    latitude: parseFloat(lat),
                    longitude: parseFloat(lng)
                }
            }

            const res = await fetch(apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (!res.ok) {
                // Handle different error formats (string, object, array of Pydantic errors)
                let errorMessage = "Registration failed";
                if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errorMessage = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        // Pydantic validation errors
                        errorMessage = data.detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join(', ');
                    } else if (typeof data.detail === 'object') {
                        errorMessage = JSON.stringify(data.detail);
                    }
                }
                throw new Error(errorMessage)
            }

            // Success
            onSuccess()
            onClose()
            // Reset form
            setDeviceId("")
            setLocationName("")
            setLat("")
            setLng("")

        } catch (err: any) {
            console.error("Registration Error:", err)
            setError(err.message || "An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Cpu className="h-5 w-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Register New Device</h2>
                            <p className="text-xs text-slate-400 uppercase tracking-widest">Expand Your Network</p>
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Device ID */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Serial ID</label>
                            <input
                                required
                                value={deviceId}
                                onChange={e => setDeviceId(e.target.value)}
                                placeholder="e.g. ESP32-AQI-001"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                            />
                        </div>

                        {/* Device Type */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Device Type</label>
                            <select
                                value={deviceType}
                                onChange={e => setDeviceType(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                            >
                                <option value="aqi-monitor">Air Quality Monitor</option>
                                <option value="water-monitor">Water Quality Monitor</option>
                                <option value="hybrid">Hybrid System</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Location Name */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location Name</label>
                                <input
                                    required
                                    value={locationName}
                                    onChange={e => setLocationName(e.target.value)}
                                    placeholder="e.g. Home Lab"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                            {/* Area */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Area / City</label>
                                <input
                                    required
                                    value={locationArea}
                                    onChange={e => setLocationArea(e.target.value)}
                                    placeholder="e.g. New York"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {/* Lat */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latitude</label>
                                <input
                                    required
                                    type="number"
                                    step="any"
                                    value={lat}
                                    onChange={e => setLat(e.target.value)}
                                    placeholder="0.0000"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                            {/* Lng */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Longitude</label>
                                <input
                                    required
                                    type="number"
                                    step="any"
                                    value={lng}
                                    onChange={e => setLng(e.target.value)}
                                    placeholder="0.0000"
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 mt-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Register Device"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
