"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

interface EnvironmentalCoreProps {
  aqi: number | null
  lastUpdate: string
  maxPm25?: number
  currentPm25?: number
  maxWaterLevel?: number
  currentWaterLevel?: number
  waterStatus?: string
  isOffline?: boolean
  compact?: boolean
}

// Circular gauge component for PM2.5 and CO2
function CircularGauge({
  label,
  value,
  unit,
  subValue,
  segments,
  size = 'md',
}: {
  label: string
  value: number
  unit: string
  subValue?: number
  segments: { color: string; percent: number; label?: string }[]
  size?: 'sm' | 'md'
}) {
  const totalPercent = segments.reduce((acc, s) => acc + s.percent, 0)
  let currentAngle = -90 // Start from top

  return (
    <div className={`relative ${size === 'sm' ? 'h-20 w-20' : 'h-32 w-32'}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        {/* Colored segments */}
        {segments.map((segment, i) => {
          const angle = (segment.percent / totalPercent) * 360
          const startAngle = currentAngle
          currentAngle += angle

          const startRad = (startAngle * Math.PI) / 180
          const endRad = (currentAngle * Math.PI) / 180

          const x1 = 50 + 42 * Math.cos(startRad)
          const y1 = 50 + 42 * Math.sin(startRad)
          const x2 = 50 + 42 * Math.cos(endRad)
          const y2 = 50 + 42 * Math.sin(endRad)

          const largeArc = angle > 180 ? 1 : 0

          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={segment.color}
              strokeWidth="8"
              strokeLinecap="round"
              className="drop-shadow-lg"
              style={{
                filter: `drop-shadow(0 0 6px ${segment.color})`
              }}
            />
          )
        })}
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-medium uppercase tracking-wider text-amber-400 ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}`}>{label}</span>
        <span className={`font-bold text-white ${size === 'sm' ? 'text-sm' : 'text-xl'}`}>{value}</span>
        <span className={`text-slate-400 ${size === 'sm' ? 'text-[7px]' : 'text-[9px]'}`}>{unit}</span>
        {subValue !== undefined && (
          <span className={`text-emerald-400 ${size === 'sm' ? 'text-[8px]' : 'text-[10px]'}`}>{subValue}</span>
        )}
      </div>
    </div>
  )
}

// Flat semicircular speedometer gauge (matches reference image)
export function SpeedometerGauge({
  value,
  maxValue,
  status,
  irms = 0,
  pumpStatus = 'N/A',
  isMotorOn = false,
}: {
  value: number
  maxValue: number
  status?: string
  irms?: number
  pumpStatus?: string
  isMotorOn?: boolean
}) {
  const maxAmps = 15;
  // Guard: irms may arrive as null/undefined from DB — coerce to safe number
  const safeIrms = Number.isFinite(Number(irms)) ? Number(irms) : 0;

  // 4 color-coded zones: Left→Right = CRITICAL → LOW → MID → HIGH based on Amps
  const zones = [
    { label: "CHARGING", from: 0, to: 0.25, color: "#d91536e8" },   // Vibrant Red (Off/dry run)
    { label: "LOW", from: 0.25, to: 0.5, color: "#f3f627f8" },      // Warm Orange
    { label: "MID", from: 0.5, to: 0.75, color: "#377deeff" },      // Bright Blue (Normal operation)
    { label: "HIGH", from: 0.75, to: 1, color: "#22c55eff" },       // Vivid Green
  ];

  // Map status string → ratio (center of the zone)
  const statusToRatio: Record<string, number> = {
    "OFF": 0.125,
    "CHARGING": 0.125,
    "CRITICAL": 0.30,  // Added: below 4A but motor running
    "LOW": 0.375,
    "MID": 0.625,
    "HIGH": 0.875,
  };

  // If motor is confirmed ON (by flow) but amps read below threshold,
  // override the status so the gauge doesn't show CHARGING/OFF.
  const resolvedPumpStatus = (isMotorOn && (pumpStatus === 'OFF' || pumpStatus === 'N/A' || !pumpStatus))
    ? 'LOW'
    : (pumpStatus || status || 'OFF');

  // Priority: use the resolved status string from pump monitor, fallback to current load ratio
  const activeStatusStr = resolvedPumpStatus.toUpperCase();
  const ratio = statusToRatio[activeStatusStr] ?? (safeIrms / maxAmps);

  const activeZone = zones.find(z => ratio >= z.from && ratio < z.to) || zones[zones.length - 1];
  // When motor is on but status is overridden, display ON instead of LOW
  const activeStatus = (isMotorOn && (pumpStatus === 'OFF' || pumpStatus === 'N/A' || !pumpStatus))
    ? 'ON'
    : activeStatusStr;

  // Needle angle: semi-circle from 180° (left) to 0° (right)
  const needleAngle = 180 - (ratio * 180);

  const cx = 175, cy = 160, r = 130;

  // Helper: arc path for a zone
  function arcPath(fromRatio: number, toRatio: number) {
    const startAngle = Math.PI - (fromRatio * Math.PI); // 180° to 0°
    const endAngle = Math.PI - (toRatio * Math.PI);
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy - r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy - r * Math.sin(endAngle);
    const sweep = (toRatio - fromRatio) > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${sweep} 1 ${x2} ${y2}`;
  }

  // Needle tip position
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = 100;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy - needleLen * Math.sin(needleRad);
  return (
    <div className="flex flex-col items-center justify-between w-full h-full px-2 gap-0.5 pt-1.5 sm:pt-2 scale-95 sm:scale-100 transform origin-center">
      {/* Gauge in the Center */}
      <div className="relative h-[55%] min-h-[80px] sm:min-h-[95px] w-full flex items-center justify-center overflow-visible mt-1 sm:mt-1.5">
        <svg viewBox="0 25 360 150" className="h-full w-full drop-shadow-[0_0_15px_rgba(30,41,59,0.3)]">
          {/* Glow filters for each zone */}
          <defs>
            {zones.map((z) => (
              <filter key={z.label} id={`glow-${z.label}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feFlood floodColor={z.color} floodOpacity="0.6" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {/* Background arc */}
          <path
            d={arcPath(0, 1)}
            fill="none"
            stroke="rgba(30,41,59,0.7)"
            strokeWidth="34"
            strokeLinecap="butt"
          />

          {/* Colored zone arcs */}
          {zones.map((z) => (
            <path
              key={z.label}
              d={arcPath(z.from, z.to)}
              fill="none"
              stroke={z.color}
              strokeWidth="32"
              strokeLinecap="butt"
              opacity={activeStatus === z.label ? 1 : 0.4}
              filter={activeStatus === z.label ? `url(#glow-${z.label})` : undefined}
              style={{ transition: "all 0.4s ease" }}
            />
          ))}

          {/* Zone separators — transparent so colored arcs flow seamlessly */}
          {[0.25, 0.5, 0.75].map((tick) => {
            const angle = Math.PI - (tick * Math.PI);
            const x1 = cx + (r - 20) * Math.cos(angle);
            const y1 = cy - (r - 20) * Math.sin(angle);
            const x2 = cx + (r + 20) * Math.cos(angle);
            const y2 = cy - (r + 20) * Math.sin(angle);
            return (
              <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="4" />
            );
          })}

          {/* Needle */}
          <line
            x1={cx} y1={cy}
            x2={nx} y2={ny}
            stroke="#f8fafc"
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Center hub */}
          <circle cx={cx} cy={cy} r="14" fill="#0f172a" stroke="#334155" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="7" fill="#38bdf8" />

          {/* Zone labels */}
          <text x="50" y="170" textAnchor="start" className="text-[10.5px] font-bold" fill="#ef4444">CHARGING</text>
          <text x="135" y="75" textAnchor="middle" className="text-[10.5px] font-bold" fill="#eab308">LOW</text>
          <text x="215" y="75" textAnchor="middle" className="text-[10.5px] font-bold" fill="#3b82f6">MID</text>
          <text x="310" y="170" textAnchor="end" className="text-[10.5px] font-bold" fill="#22c55e">HIGH</text>
        </svg>
      </div>

      {/* Horizontal Info Bar at the Bottom */}
      <div className="flex flex-row justify-around items-center w-full px-2 mt-1 gap-2 relative z-10 border-t border-white/[0.05] pt-1.5 pb-0.5">
        <div className="flex flex-col items-center text-center flex-1">
          <span className="text-[8.5px] font-medium text-slate-400 uppercase tracking-wider leading-none mb-1">
            IRMS
          </span>
          <span className="text-[12px] font-bold font-mono text-white leading-none whitespace-nowrap">
            {safeIrms.toFixed(1)}<span className="text-[8.5px] font-normal text-slate-400 ml-0.5">A</span>
          </span>
        </div>
        <div className="flex flex-col items-center text-center flex-1">
          <span className="text-[8.5px] font-medium text-slate-400 uppercase tracking-wider leading-none mb-1">
            Status
          </span>
          <span 
            className="text-[12px] font-bold uppercase tracking-tight leading-none whitespace-nowrap"
            style={{ color: activeZone.color }}
          >
            {activeStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EnvironmentalCore({
  aqi,
  lastUpdate,
  maxPm25 = 0,
  currentPm25 = 0,
  maxWaterLevel = 0,
  currentWaterLevel = 0,
  waterStatus,
  waterIrms = 0,
  waterPumpStatus = 'N/A',
  isOffline = false,
  compact = false,
}: {
  aqi: number
  lastUpdate: string
  maxPm25?: number
  currentPm25?: number
  maxWaterLevel?: number
  currentWaterLevel?: number
  waterStatus?: string
  waterIrms?: number
  waterPumpStatus?: string
  isOffline?: boolean
  compact?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentTime, setCurrentTime] = useState(lastUpdate)

  useEffect(() => {
    // If we have a valid time passed in lastUpdate, use it. 
    // Otherwise fallback to clock? The prompt implies "Freeze last known values" when offline.
    // If online, we might want real clock? 
    // Existing code had a clock interval.
    // Let's keep the clock BUT if offline, maybe we shouldn't update?
    // User requirement: "Freeze last known values" -> implies timestamp too.

    if (isOffline) return; // Don't update clock if offline

    const interval = setInterval(() => {
      const now = new Date()
      setCurrentTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [isOffline])

  useEffect(() => {
    // If lastUpdate changes (new packet), update the display time immediately
    if (lastUpdate && lastUpdate !== "--:--") {
      setCurrentTime(lastUpdate);
    }
  }, [lastUpdate]);

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.z = 6

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    // Create wireframe sphere (like a globe with lat/long lines)
    const sphereRadius = 1.4

    // Main glowing core (inner)
    const coreGeometry = new THREE.SphereGeometry(sphereRadius * 0.95, 64, 64)
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff44,
      transparent: true,
      opacity: 0.15,
    })
    const core = new THREE.Mesh(coreGeometry, coreMaterial)
    scene.add(core)

    // Wireframe sphere - latitude lines
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    })

    // Create latitude circles
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * Math.PI
      const y = sphereRadius * Math.cos(angle)
      const radius = sphereRadius * Math.sin(angle)

      if (radius > 0.01) {
        const circleGeometry = new THREE.BufferGeometry()
        const points = []
        for (let j = 0; j <= 64; j++) {
          const theta = (j / 64) * Math.PI * 2
          points.push(new THREE.Vector3(
            radius * Math.cos(theta),
            y,
            radius * Math.sin(theta)
          ))
        }
        circleGeometry.setFromPoints(points)
        const circle = new THREE.Line(circleGeometry, wireframeMaterial)
        scene.add(circle)
      }
    }

    // Create longitude lines (meridians)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const arcGeometry = new THREE.BufferGeometry()
      const points = []
      for (let j = 0; j <= 64; j++) {
        const phi = (j / 64) * Math.PI
        points.push(new THREE.Vector3(
          sphereRadius * Math.sin(phi) * Math.cos(angle),
          sphereRadius * Math.cos(phi),
          sphereRadius * Math.sin(phi) * Math.sin(angle)
        ))
      }
      arcGeometry.setFromPoints(points)
      const arc = new THREE.Line(arcGeometry, wireframeMaterial)
      scene.add(arc)
    }

    // Energy swirl particles (cyan trails around the sphere)
    const swirlCount = 3
    const swirls: THREE.Line[] = []

    for (let s = 0; s < swirlCount; s++) {
      const swirlGeometry = new THREE.BufferGeometry()
      const swirlPoints = []
      const swirlRadius = sphereRadius * 1.3 + s * 0.15
      const turns = 2 + s * 0.5

      for (let i = 0; i <= 200; i++) {
        const t = i / 200
        const angle = t * Math.PI * 2 * turns
        const y = (t - 0.5) * sphereRadius * 1.5
        const r = swirlRadius * (1 - Math.abs(t - 0.5) * 0.3)

        swirlPoints.push(new THREE.Vector3(
          r * Math.cos(angle),
          y,
          r * Math.sin(angle)
        ))
      }
      swirlGeometry.setFromPoints(swirlPoints)

      const swirlMaterial = new THREE.LineBasicMaterial({
        color: s === 0 ? 0x00ffff : (s === 1 ? 0x00ff88 : 0x88ffff),
        transparent: true,
        opacity: 0.6 - s * 0.15,
        linewidth: 1
      })

      const swirl = new THREE.Line(swirlGeometry, swirlMaterial)
      swirl.rotation.x = Math.PI / 2 + (s * 0.1)
      scene.add(swirl)
      swirls.push(swirl)
    }

    // Glowing particles around the sphere
    const particleCount = 150
    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const particleSizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = sphereRadius * (0.9 + Math.random() * 0.8)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
      particleSizes[i] = Math.random() * 0.05 + 0.02
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))

    // Create glowing particle texture
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    gradient.addColorStop(0, 'rgba(0, 255, 136, 1)')
    gradient.addColorStop(0.3, 'rgba(0, 255, 136, 0.8)')
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)

    const particleTexture = new THREE.CanvasTexture(canvas)

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.08,
      map: particleTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

    // Outer glow effect
    const outerGlowGeometry = new THREE.SphereGeometry(sphereRadius * 1.6, 32, 32)
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    })
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial)
    scene.add(outerGlow)

    // Green reflection plane at bottom
    const reflectionGeometry = new THREE.PlaneGeometry(6, 2)
    const reflectionMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    })
    const reflection = new THREE.Mesh(reflectionGeometry, reflectionMaterial)
    reflection.rotation.x = -Math.PI / 2
    reflection.position.y = -2
    scene.add(reflection)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x00ff88, 0.3)
    scene.add(ambientLight)

    const pointLight = new THREE.PointLight(0x00ff88, 2, 10)
    pointLight.position.set(0, 0, 3)
    scene.add(pointLight)

    // Animation loop
    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // CHECK OFFLINE STATE
      // We read a ref or we can't easily read the prop inside this closure if it changes?
      // Actually `useEffect` dependencies should technically handle restart if `isOffline` changes.
      // But restarting the whole Three.js scene is expensive. 
      // A better way is to use a ref for isOffline.

      // However, since we are doing a full component rewrite, let's keep it simple:
      // If `isOffline` changes, `useEffect` re-runs, recreating the scene. 
      // This is acceptable for a status change that doesn't happen 60fps.
      // EXCEPT: We don't want to destroy the scene just to pause.
      // So let's use a MutableRefObject for `isOffline` to access it in the loop without re-running effect.
    }

    // BUT, wait. I am inside `useEffect(() => { ... }, [])` - empty deps (or restricted).
    // I should add `isOffline` to a ref if I want to use it in the loop without finding.

    const animateLoop = () => {
      animationId = requestAnimationFrame(animateLoop)

      if (isOfflineRef.current) {
        renderer.render(scene, camera)
        return
      }

      // Rotate core and wireframe
      core.rotation.y += 0.005

      // Rotate swirls
      swirls.forEach((swirl, i) => {
        swirl.rotation.z += 0.01 * (i % 2 === 0 ? 1 : -1)
        swirl.rotation.y += 0.005
      })

      // Animate particles
      particles.rotation.y += 0.003
      particles.rotation.x += 0.001

      // Pulsing glow
      const pulse = Math.sin(Date.now() * 0.002) * 0.03 + 0.15
      coreMaterial.opacity = pulse
      outerGlowMaterial.opacity = pulse * 0.3

      renderer.render(scene, camera)
    }
    animateLoop()

    // Handle resize
    const handleResize = () => {
      const newWidth = container.clientWidth
      const newHeight = container.clientHeight
      camera.aspect = newWidth / newHeight
      camera.updateProjectionMatrix()
      renderer.setSize(newWidth, newHeight)
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationId)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, []) // We depend on [] is unsafe if we access props.

  // We need a ref for isOffline to communicate with the requestAnimationFrame loop
  const isOfflineRef = useRef(isOffline)
  useEffect(() => {
    isOfflineRef.current = isOffline;
  }, [isOffline])


  // PM2.5 gauge segments
  const pm25Segments = [
    { color: "#22c55e", percent: 21, label: "21%" },
    { color: "#84cc16", percent: 8 },
    { color: "#fbbf24", percent: 99, label: "99%" },
    { color: "#f97316", percent: 27 },
    { color: "#ef4444", percent: 2, label: "2%" },
  ]

  return (
    <div className="card-vibrant card-core relative flex h-full flex-col items-center justify-start overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 animate-blob rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="animation-delay-2000 absolute -right-1/4 top-1/4 h-1/2 w-1/2 animate-blob rounded-full bg-cyan-500/20 blur-3xl" />
      </div>

      <h2 className={`relative z-10 ${compact ? 'mb-0 text-sm' : 'mb-2 text-lg'} bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-400 bg-clip-text text-center font-semibold tracking-wider text-transparent`}>
        Environmental Core
      </h2>

      <div className="relative z-10 flex w-full items-center justify-center gap-4 flex-1">
        {/* 3D Sphere */}
        <div
          ref={containerRef}
          className={`relative flex-shrink-0 ${compact ? 'h-full w-full' : 'h-[320px] w-[320px]'}`}
        />

        {/* Circular Gauges — hidden in compact */}
        {!compact && (
          <div className="flex flex-col gap-4">
            <CircularGauge
              label="PM2.5"
              value={Math.round(maxPm25)}
              unit="µg/m³"
              subValue={Number.isFinite(currentPm25) ? Number(currentPm25?.toFixed(2)) : undefined}
              segments={pm25Segments}
              size="md"
            />
            <div className="flex flex-col items-center gap-1">
              <CircularGauge
                label="Water"
                value={Number.isFinite(currentWaterLevel) ? Number(currentWaterLevel.toFixed(1)) : 0}
                unit="ft"
                segments={[
                  { color: "#22c55e", percent: 33, label: "33%" },
                  { color: "#84cc16", percent: 37, label: "37%" },
                  { color: "#fbbf24", percent: 8 },
                  { color: "#f97316", percent: 7, label: "7%" },
                  { color: "#ef4444", percent: 88 },
                ]}
                size="md"
              />
              <span className="text-[10px] text-slate-400">
                highest: {Number.isFinite(maxWaterLevel) ? maxWaterLevel.toFixed(1) : "0.0"} ft
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom info — hidden in compact mode */}
      {!compact && (
        <div className="relative z-10 mt-0.5 w-full pb-4">
          <div className="text-center mb-18">
            <h3 className="text-sm font-medium uppercase tracking-widest text-slate-300">
              Last Recorded AQI Mix
            </h3>
            <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Last update: <span className={`font-bold ${isOffline ? 'text-red-400' : 'text-amber-400'}`}>{currentTime}</span>
            </p>
          </div>

          {/* Speedometer Gauge */}
          <div className="flex flex-col items-center gap-2">
            <SpeedometerGauge
              value={Number.isFinite(currentWaterLevel) ? Number(currentWaterLevel.toFixed(2)) : 0}
              maxValue={Number.isFinite(maxWaterLevel) ? Number(maxWaterLevel.toFixed(2)) : 0}
              status={waterStatus}
              irms={waterIrms}
              pumpStatus={waterPumpStatus}
            />
          </div>
        </div>
      )}

      {/* Animated border */}
      <div className={`pointer-events-none absolute inset-0 rounded-2xl border ${isOffline ? 'border-red-500/20' : 'border-emerald-500/20'} transition-colors duration-500`} />
    </div>
  )
}
