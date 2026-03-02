"use client"

import { useEffect, useMemo, useState } from "react"

interface DemoGeneratingAnimationProps {
  steps: string[]
  onComplete: () => void
}

export function DemoGeneratingAnimation({ steps, onComplete }: DemoGeneratingAnimationProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const progress = useMemo(() => {
    if (steps.length === 0) return 100
    if (currentStep >= steps.length) return 100
    return ((currentStep + 1) / steps.length) * 100
  }, [currentStep, steps.length])

  useEffect(() => {
    if (currentStep >= steps.length) {
      onComplete()
      return
    }

    const stepDuration = 800
    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1)
    }, stepDuration)

    return () => clearTimeout(timer)
  }, [currentStep, steps.length, onComplete])

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-[#E5E5EA]">
        <div
          className="h-full rounded-full bg-[#0071E3] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="h-6">
        {currentStep < steps.length && (
          <p className="animate-in fade-in text-[14px] font-medium text-[#1D1D1F]">
            {steps[currentStep]}
          </p>
        )}
      </div>
      <p className="text-[12px] text-[#6E6E73]">
        Step {Math.min(currentStep + 1, steps.length)} of {steps.length}
      </p>
    </div>
  )
}
