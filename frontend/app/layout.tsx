import React from "react"
import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { DynamicTitle } from "@/components/dynamic-title"

const montserrat = {
  className: "font-sans",
  variable: "--font-montserrat"
};

export const metadata: Metadata = {
  title: "Fern Insights",
  description: "Real-time environmental monitoring dashboard for air quality and groundwater levels",
  generator: "v0.app",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts loaded in browser to avoid Next.js compiler download blocks */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
          rel="stylesheet"
        />
        {/* Synchronous script to set correct tab title before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var h = window.location.hostname.toLowerCase();
                document.title = h.includes("trifecta") ? "Trifecta Insights" : "Fern Insights";
              } catch(e) {}
            `,
          }}
        />
        {/* Leaflet CSS — must be in global head for reliable tile rendering */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className={`${montserrat.className} ${montserrat.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <DynamicTitle />
            {children}
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
