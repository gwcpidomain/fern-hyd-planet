/**
 * India State-Level AQI Data (Demo Mode)
 * In production, this would be fetched from CPCB or a similar API.
 */

export interface IndianStateAQI {
  name: string
  code: string
  aqi: number
  category: string
}

// Realistic demo AQI data for Indian states
// Based on typical seasonal averages (post-monsoon)
const STATE_AQI_DATA: Record<string, number> = {
  "Andhra Pradesh": 72,
  "Arunachal Pradesh": 28,
  "Assam": 65,
  "Bihar": 178,
  "Chhattisgarh": 95,
  "Goa": 38,
  "Gujarat": 110,
  "Haryana": 195,
  "Himachal Pradesh": 45,
  "Jharkhand": 142,
  "Karnataka": 85,
  "Kerala": 42,
  "Madhya Pradesh": 105,
  "Maharashtra": 118,
  "Manipur": 48,
  "Meghalaya": 35,
  "Mizoram": 30,
  "Nagaland": 40,
  "Odisha": 88,
  "Punjab": 168,
  "Rajasthan": 135,
  "Sikkim": 25,
  "Tamil Nadu": 78,
  "Telangana": 92,
  "Tripura": 55,
  "Uttar Pradesh": 210,
  "Uttarakhand": 68,
  "West Bengal": 145,
  "Delhi": 285,
  "Jammu & Kashmir": 58,
  "Ladakh": 22,
}

// City-level averages for comparison strip
export const CITY_AQI: Record<string, { city: string; state: string; aqi: number }> = {
  "HYD-01": { city: "Hyderabad", state: "Telangana", aqi: 78 },
  "HYD-02": { city: "Hyderabad", state: "Telangana", aqi: 82 },
  "HYD-03": { city: "Hyderabad", state: "Telangana", aqi: 75 },
  "DEL-01": { city: "Delhi", state: "Delhi", aqi: 285 },
  "MUM-01": { city: "Mumbai", state: "Maharashtra", aqi: 115 },
  "FERN-01": { city: "Hyderabad", state: "Telangana", aqi: 78 },
  "TRIFECTA-01": { city: "Bengaluru", state: "Karnataka", aqi: 85 }
}

export function getIndianStateAQI(stateName: string): number {
  return STATE_AQI_DATA[stateName] ?? 50
}

export function getIndiaAvgAQI(): number {
  const values = Object.values(STATE_AQI_DATA)
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

export function getCityAQI(locationId: string): { city: string; state: string; aqi: number } {
  return CITY_AQI[locationId] ?? { city: "Unknown", state: "Unknown", aqi: 50 }
}

export function getStateAQIForLocation(locationId: string): number {
  const cityInfo = CITY_AQI[locationId]
  if (!cityInfo) return 50
  return STATE_AQI_DATA[cityInfo.state] ?? 50
}

export function getAQICategory(aqi: number): { label: string; color: string; bgColor: string } {
  if (aqi <= 50) return { label: "Good", color: "#10b981", bgColor: "rgba(16, 185, 129, 0.15)" }
  if (aqi <= 100) return { label: "Moderate", color: "#f59e0b", bgColor: "rgba(245, 158, 11, 0.15)" }
  if (aqi <= 150) return { label: "Unhealthy (SG)", color: "#f97316", bgColor: "rgba(249, 115, 22, 0.15)" }
  if (aqi <= 200) return { label: "Unhealthy", color: "#ef4444", bgColor: "rgba(239, 68, 68, 0.15)" }
  if (aqi <= 300) return { label: "Very Unhealthy", color: "#a855f7", bgColor: "rgba(168, 85, 247, 0.15)" }
  return { label: "Hazardous", color: "#991b1b", bgColor: "rgba(153, 27, 27, 0.15)" }
}

/** Globe polygon fill color based on AQI — subtle translucent overlay */
export function getAQIHeatColor(aqi: number): string {
  if (aqi <= 50) return "rgba(16, 185, 129, 0.25)"    // Green
  if (aqi <= 100) return "rgba(245, 158, 11, 0.28)"   // Amber
  if (aqi <= 150) return "rgba(249, 115, 22, 0.30)"    // Orange
  if (aqi <= 200) return "rgba(239, 68, 68, 0.32)"     // Red
  if (aqi <= 300) return "rgba(168, 85, 247, 0.35)"    // Purple
  return "rgba(153, 27, 27, 0.38)"                      // Maroon
}
