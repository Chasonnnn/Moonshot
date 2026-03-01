import { useState, useEffect } from "react"

interface CountdownState {
  remainingSeconds: number | null
  isExpired: boolean
}

export function useCountdown(
  createdAt: string,
  timeLimitMinutes: number | null
): CountdownState {
  const [state, setState] = useState<CountdownState>(() => {
    if (timeLimitMinutes == null) {
      return { remainingSeconds: null, isExpired: false }
    }
    return computeState(createdAt, timeLimitMinutes)
  })

  useEffect(() => {
    if (timeLimitMinutes == null) return

    const interval = setInterval(() => {
      setState(computeState(createdAt, timeLimitMinutes))
    }, 1000)

    return () => clearInterval(interval)
  }, [createdAt, timeLimitMinutes])

  return state
}

function computeState(createdAt: string, timeLimitMinutes: number): CountdownState {
  const deadlineMs = new Date(createdAt).getTime() + timeLimitMinutes * 60 * 1000
  const remaining = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000))
  return {
    remainingSeconds: remaining,
    isExpired: remaining <= 0,
  }
}
