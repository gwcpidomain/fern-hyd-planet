"use client"

import { useEffect } from "react"

export function DynamicTitle() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase()
      if (host.includes("trifecta")) {
        document.title = "Trifecta Insights"
      } else if (host.includes("fern")) {
        document.title = "Fern Insights"
      }
    }
  }, [])

  return null
}
