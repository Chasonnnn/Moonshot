"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react"
import { CandidateApiClient } from "@/lib/moonshot/candidate-client"
import { useCountdown } from "@/hooks/use-countdown"
import { useTelemetry } from "@/hooks/use-telemetry"
import type { CandidateSession, SessionMode } from "@/lib/moonshot/types"
import type { DemoFixtureData } from "@/lib/moonshot/demo-fixtures"

export interface CoachChatMessage {
  role: "user" | "coach"
  content: string
  allowed?: boolean
  policyReason?: string
  policyMeta?: {
    policy_decision_code: string | null
    policy_version: string | null
    policy_hash: string | null
    blocked_rule_id: string | null
  }
  feedbackGiven?: "up" | "down" | null
}

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
  autoPlay: boolean
  fixtureData: DemoFixtureData | null
  coachMessages: CoachChatMessage[]
  pushCoachMessage: (msg: CoachChatMessage) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  session,
  autoPlay = false,
  fixtureData = null,
  children,
}: {
  session: CandidateSession
  autoPlay?: boolean
  fixtureData?: DemoFixtureData | null
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

  const [coachMessages, setCoachMessages] = useState<CoachChatMessage[]>([])
  const pushCoachMessage = useCallback((msg: CoachChatMessage) => {
    setCoachMessages((prev) => [...prev, msg])
  }, [])

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
      autoPlay,
      fixtureData,
      coachMessages,
      pushCoachMessage,
    }),
    [session, api, isSubmitted, finalResponse, remainingSeconds, isExpired, track, mode, isAiDisabled, autoPlay, fixtureData, coachMessages, pushCoachMessage]
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
