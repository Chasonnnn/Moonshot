"use client"

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react"
import { CandidateApiClient } from "@/lib/moonshot/candidate-client"
import { useCountdown } from "@/hooks/use-countdown"
import { useTelemetry } from "@/hooks/use-telemetry"
import type { CandidateSession, SessionMode } from "@/lib/moonshot/types"

interface SessionContextValue {
  session: CandidateSession
  api: CandidateApiClient
  isSubmitted: boolean
  setSubmitted: (v: boolean) => void
  finalResponse: string
  setFinalResponse: (v: string) => void
  remainingSeconds: number | null
  isExpired: boolean
  track: (eventType: string, payload?: Record<string, unknown>) => void
  mode: SessionMode
  isAiDisabled: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: CandidateSession
  children: ReactNode
}) {
  const api = useMemo(
    () => new CandidateApiClient(session.id),
    [session.id]
  )
  const [isSubmitted, setSubmitted] = useState(session.status === "submitted")
  const [finalResponse, setFinalResponse] = useState(
    session.final_response ?? ""
  )
  const { remainingSeconds, isExpired } = useCountdown(
    session.created_at,
    session.policy.time_limit_minutes
  )
  const { track } = useTelemetry(api)

  const mode: SessionMode = session.policy.coach_mode ?? "practice"
  const isAiDisabled = mode === "assessment_no_ai"

  const value = useMemo(
    () => ({
      session,
      api,
      isSubmitted,
      setSubmitted,
      finalResponse,
      setFinalResponse,
      remainingSeconds,
      isExpired,
      track,
      mode,
      isAiDisabled,
    }),
    [session, api, isSubmitted, finalResponse, remainingSeconds, isExpired, track, mode, isAiDisabled]
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider")
  }
  return ctx
}
