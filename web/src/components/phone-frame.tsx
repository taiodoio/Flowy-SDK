"use client"

import React from "react"

interface PhoneFrameProps {
  width?: number
  children: React.ReactNode
  label?: string
  className?: string
}

const ASPECT = 19.5 / 9 // modern iPhone aspect ratio for screen area

export function PhoneFrame({ width = 280, children, label, className = "" }: PhoneFrameProps) {
  // Outer device frame including bezel
  const bezel = 12
  const outerW = width + bezel * 2
  const innerH = Math.round(width * ASPECT)
  const outerH = innerH + bezel * 2

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {label && (
        <span className="text-xs text-[var(--text-tertiary)] truncate max-w-[260px]" title={label}>
          {label}
        </span>
      )}

      <div
        className="relative shrink-0"
        style={{ width: outerW, height: outerH }}
      >
        {/* Side buttons */}
        <div className="absolute -left-[3px] top-[80px] w-[3px] h-7 rounded-l bg-[var(--border-strong)]" aria-hidden />
        <div className="absolute -left-[3px] top-[120px] w-[3px] h-12 rounded-l bg-[var(--border-strong)]" aria-hidden />
        <div className="absolute -left-[3px] top-[180px] w-[3px] h-12 rounded-l bg-[var(--border-strong)]" aria-hidden />
        <div className="absolute -right-[3px] top-[140px] w-[3px] h-20 rounded-r bg-[var(--border-strong)]" aria-hidden />

        {/* Outer frame */}
        <div
          className="absolute inset-0 rounded-[44px] shadow-2xl"
          style={{
            background: "linear-gradient(160deg, #4b5563 0%, #374151 52%, #4b5563 100%)",
            padding: bezel,
          }}
        >
          {/* Inner bezel ring */}
          <div
            className="relative w-full h-full rounded-[34px] overflow-hidden border border-black/40 dark:border-white/10"
            style={{ background: "#000" }}
          >
            {/* Screen */}
            <div className="absolute inset-0 overflow-hidden">
              {children}
            </div>

            {/* Dynamic island */}
            <div
              className="absolute left-1/2 -translate-x-1/2 top-2 h-[22px] w-[88px] rounded-full bg-black z-30 ring-1 ring-black/60 shadow-inner"
              aria-hidden
            />

            {/* Home indicator */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-1.5 h-[4px] w-[34%] rounded-full bg-white/70 z-30 mix-blend-difference"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  )
}
