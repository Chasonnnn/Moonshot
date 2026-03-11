"use client"

import { useEffect, useMemo, useState } from "react"

interface DemoGeneratingAnimationProps {
  steps: string[]
  onComplete: () => void
}

export function DemoGeneratingAnimation({ steps, onComplete }: DemoGeneratingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const progress = useMemo(() => {
    if (steps.length === 0) return 100
    if (currentStep >= steps.length) return 100
    return ((currentStep + 1) / steps.length) * 100
  }, [currentStep, steps.length])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (currentStep >= steps.length) {
      onComplete()
      return
    }

    const stepDuration = prefersReducedMotion ? 120 : 800
    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1)
    }, stepDuration)

    return () => clearTimeout(timer)
  }, [currentStep, onComplete, prefersReducedMotion, steps.length])

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[var(--ops-border-soft)]">
        <div
          className="h-full rounded-full bg-[var(--ops-accent)] transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress / 100})`, transformOrigin: "left center" }}
        />
      </div>
      <div className="h-6">
        {currentStep < steps.length && (
          <p className={`${prefersReducedMotion ? "" : "animate-in fade-in "}text-[14px] font-medium text-[var(--ops-text)]`}>
            {steps[currentStep]}
          </p>
        )}
      </div>
      <p className="text-[12px] text-[var(--ops-text-subtle)]">
        Step {Math.min(currentStep + 1, steps.length)} of {steps.length}
      </p>
    </div>
  )
}
