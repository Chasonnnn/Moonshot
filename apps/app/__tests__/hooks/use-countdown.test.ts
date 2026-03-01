import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCountdown } from "@/hooks/use-countdown"

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns null when time_limit_minutes is null", () => {
    const { result } = renderHook(() =>
      useCountdown("2024-01-01T00:00:00Z", null)
    )
    expect(result.current.remainingSeconds).toBeNull()
    expect(result.current.isExpired).toBe(false)
  })

  it("computes remaining seconds from created_at + limit", () => {
    const now = new Date("2024-01-01T00:30:00Z")
    vi.setSystemTime(now)

    const { result } = renderHook(() =>
      useCountdown("2024-01-01T00:00:00Z", 60)
    )
    // 60 min limit, 30 min elapsed → 30 min = 1800s remaining
    expect(result.current.remainingSeconds).toBe(1800)
    expect(result.current.isExpired).toBe(false)
  })

  it("ticks down every second", () => {
    vi.setSystemTime(new Date("2024-01-01T00:30:00Z"))

    const { result } = renderHook(() =>
      useCountdown("2024-01-01T00:00:00Z", 60)
    )
    expect(result.current.remainingSeconds).toBe(1800)

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current.remainingSeconds).toBe(1795)
  })

  it("sets isExpired when time hits 0", () => {
    // 1 minute limit, 59 seconds elapsed
    vi.setSystemTime(new Date("2024-01-01T00:00:59Z"))

    const { result } = renderHook(() =>
      useCountdown("2024-01-01T00:00:00Z", 1)
    )
    expect(result.current.remainingSeconds).toBe(1)
    expect(result.current.isExpired).toBe(false)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.isExpired).toBe(true)
  })

  it("does not go below 0", () => {
    // Already past deadline
    vi.setSystemTime(new Date("2024-01-01T02:00:00Z"))

    const { result } = renderHook(() =>
      useCountdown("2024-01-01T00:00:00Z", 60)
    )
    expect(result.current.remainingSeconds).toBe(0)
    expect(result.current.isExpired).toBe(true)
  })
})
