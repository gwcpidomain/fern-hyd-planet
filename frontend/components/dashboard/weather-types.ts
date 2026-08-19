export interface HourlyWeatherSlot {
  time: string
  time_epoch: number
  temp_c: number
  condition: string
  icon: string
  precip_chance: number
}

export interface ForecastDay {
  date: string
  max_c: number
  min_c: number
  condition: string
  icon: string
  rain_chance: number
}

export interface WeatherPayload {
  location: string
  region: string
  country: string
  lat?: number
  lon?: number
  temp_c: number
  feelslike_c: number
  condition: string
  condition_icon?: string | null
  wind_kph: number
  wind_dir: string
  humidity: number
  uv: number
  precip_mm: number
  vis_km: number
  pressure_mb: number
  cloud: number
  pm25: number
  pm10: number
  aqi_index: number
  hourly?: HourlyWeatherSlot[]
  forecast?: ForecastDay[]
  sunrise?: string | null
  sunset?: string | null
  fetchedAt: string
  cached?: boolean
  stale?: boolean
}

export function normalizeWeatherIconUrl(icon?: string | null): string | null {
  if (!icon) return null
  if (icon.startsWith("//")) return `https:${icon}`
  return icon.startsWith("http") ? icon : `https:${icon}`
}

export function formatForecastDate(dateOnly: string, index: number): string {
  if (index === 0) return "Today"

  const date = new Date(`${dateOnly}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return dateOnly

  const dateLabel = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
  const weekday = date.toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  })

  return `${dateLabel}, ${weekday}`
}
