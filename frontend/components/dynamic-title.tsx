"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function DynamicTitle() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase()
      const title = host.includes("trifecta") ? "Trifecta Insights" : "Fern Insights"
      document.title = title
    }
  }, [pathname])

  return null
}
