import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useTelemetry } from "@/hooks/use-telemetry"

describe("useTelemetry", () => {
  const mockIngestEvents = vi.fn().mockResolvedValue({ accepted: 1 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockApi = { ingestEvents: mockIngestEvents } as any

  beforeEach(() => {
    vi.useFakeTimers()
    mockIngestEvents.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("batches events and flushes after 10s", () => {
    const { result } = renderHook(() => useTelemetry(mockApi))

    act(() => {
      result.current.track("click", { target: "btn" })
      result.current.track("view", {})
    })

    // Not flushed yet
    expect(mockIngestEvents).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockIngestEvents).toHaveBeenCalledTimes(1)
    const events = mockIngestEvents.mock.calls[0][0]
    expect(events).toHaveLength(2)
    expect(events[0].event_type).toBe("click")
    expect(events[1].event_type).toBe("view")
  })

  it("does not flush when buffer is empty", () => {
    renderHook(() => useTelemetry(mockApi))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockIngestEvents).not.toHaveBeenCalled()
  })

  it("re-queues events on flush failure", async () => {
    mockIngestEvents.mockRejectedValueOnce(new Error("network error"))

    const { result } = renderHook(() => useTelemetry(mockApi))

    act(() => {
      result.current.track("event1", {})
    })

    // First flush fails
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    // Wait for the rejected promise to settle
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    // Second flush should retry the events
    mockIngestEvents.mockResolvedValueOnce({ accepted: 1 })
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockIngestEvents).toHaveBeenCalledTimes(2)
    expect(mockIngestEvents.mock.calls[1][0]).toHaveLength(1)
  })

  it("flushes on beforeunload", () => {
    const { result } = renderHook(() => useTelemetry(mockApi))

    act(() => {
      result.current.track("final_event", {})
    })

    act(() => {
      window.dispatchEvent(new Event("beforeunload"))
    })

    expect(mockIngestEvents).toHaveBeenCalledTimes(1)
  })
})
