"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export function DynamicTitle() {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return

    const host = window.location.hostname.toLowerCase()
    const targetTitle = host.includes("trifecta") ? "Trifecta Insights" : "Fern Insights"

    const applyTitle = () => {
      if (document.title !== targetTitle) {
        document.title = targetTitle
      }
    }

    applyTitle()

    // Watch <title> tag in <head> so Next.js hydration never reverts Trifecta Insights
    const titleEl = document.querySelector("title")
    let observer: MutationObserver | null = null
    if (titleEl) {
      observer = new MutationObserver(() => applyTitle())
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true })
    }

    // Hydration guard for initial seconds
    const interval = setInterval(applyTitle, 400)
    const timeout = setTimeout(() => clearInterval(interval), 3000)

    return () => {
      observer?.disconnect()
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pathname])

  return null
}
