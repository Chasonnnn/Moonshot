import { useRef, useEffect, useCallback } from "react"

interface TelemetryApi {
  ingestEvents(events: Array<{ event_type: string; payload: Record<string, unknown> }>): Promise<unknown>
}

export function useTelemetry(api: TelemetryApi) {
  const bufferRef = useRef<Array<{ event_type: string; payload: Record<string, unknown> }>>([])

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return

    const events = [...bufferRef.current]
    bufferRef.current = []

    api.ingestEvents(events).catch(() => {
      // Re-queue on failure
      bufferRef.current = [...events, ...bufferRef.current]
    })
  }, [api])

  useEffect(() => {
    const interval = setInterval(flush, 10000)

    const handleBeforeUnload = () => flush()
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [flush])

  const track = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      bufferRef.current.push({ event_type: eventType, payload })
    },
    []
  )

  return { track }
}
