"use client"

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
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
  setSubmitted: Dispatch<SetStateAction<boolean>>
  finalResponse: string
  setFinalResponse: Dispatch<SetStateAction<string>>
  remainingSeconds: number | null
  isExpired: boolean
  track: (eventType: string, payload?: Record<string, unknown>) => void
  mode: SessionMode
  isAiDisabled: boolean
  autoPlay: boolean
  fixtureData: DemoFixtureData | null
  coachMessages: CoachChatMessage[]
  pushCoachMessage: (msg: CoachChatMessage) => void
  currentRoundIndex: number
  setCurrentRoundIndex: (index: number) => void
  totalRounds: number
  deliverableContent: string
  setDeliverableContent: Dispatch<SetStateAction<string>>
  deliverableArtifacts: string[]
  setDeliverableArtifacts: Dispatch<SetStateAction<string[]>>
  deliverableId: string | null
  setDeliverableId: Dispatch<SetStateAction<string | null>>
  deliverableStatus: "draft" | "submitted" | null
  setDeliverableStatus: Dispatch<SetStateAction<"draft" | "submitted" | null>>
  parts: Array<{
    id: string
    title: string
    description: string
    part_type?: string
    time_limit_minutes?: number
    deliverable_type?: string
  }>
  activePart: number
  setActivePart: (index: number) => void
  activePartRemainingSeconds: number | null
  isActivePartExpired: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)
const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_PARTS: Array<{
  id: string
  title: string
  description: string
  part_type?: string
  time_limit_minutes?: number
  deliverable_type?: string
}> = []

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
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const totalRounds = fixtureData?.rounds.length ?? 0
  const [deliverableContent, setDeliverableContent] = useState(
    session.final_response ?? ""
  )
  const [deliverableArtifacts, setDeliverableArtifacts] = useState<string[]>(EMPTY_STRING_ARRAY)
  const [deliverableId, setDeliverableId] = useState<string | null>(null)
  const [deliverableStatus, setDeliverableStatus] = useState<"draft" | "submitted" | null>(null)
  const parts = useMemo(
    () => fixtureData?.parts ?? EMPTY_PARTS,
    [fixtureData?.parts]
  )
  const [activePart, setActivePartState] = useState(0)
  const [partStartTimes, setPartStartTimes] = useState<Record<number, string>>(
    () => ({ 0: session.created_at })
  )

  const activePartStart = partStartTimes[activePart] ?? session.created_at
  const activePartTimeLimit = parts[activePart]?.time_limit_minutes ?? null
  const {
    remainingSeconds: activePartRemainingSeconds,
    isExpired: isActivePartExpired,
  } = useCountdown(activePartStart, activePartTimeLimit)

  useEffect(() => {
    let cancelled = false
    const hydrateDeliverable = async () => {
      try {
        const response = await api.listDeliverables()
        if (cancelled || response.items.length === 0) return
        const latest = [...response.items].sort((a, b) => {
          const aTs = new Date(a.updated_at).getTime()
          const bTs = new Date(b.updated_at).getTime()
          return bTs - aTs
        })[0]
        setDeliverableId(latest.id)
        setDeliverableStatus(latest.status)
        setDeliverableArtifacts(latest.embedded_artifacts ?? EMPTY_STRING_ARRAY)
        setDeliverableContent((prev) => prev.trim() || latest.content_markdown || "")
      } catch {
        // Deliverables are optional for non-case sessions.
      }
    }
    void hydrateDeliverable()
    return () => {
      cancelled = true
    }
  }, [api])

  useEffect(() => {
    if (parts.length === 0) {
      if (activePart !== 0) {
        setActivePartState(0)
      }
      return
    }
    if (activePart >= parts.length) {
      setActivePartState(parts.length - 1)
    }
  }, [activePart, parts.length])

  const setActivePart = useCallback(
    (index: number) => {
      if (parts.length === 0) return
      const nextIndex = Math.min(Math.max(0, index), parts.length - 1)
      setPartStartTimes((prev) =>
        prev[nextIndex] ? prev : { ...prev, [nextIndex]: new Date().toISOString() }
      )
      setActivePartState(nextIndex)
    },
    [parts.length]
  )

  useEffect(() => {
    if (!isActivePartExpired || parts.length === 0) return
    if (activePart >= parts.length - 1) return
    const nextIndex = activePart + 1
    setPartStartTimes((prev) => ({
      ...prev,
      [nextIndex]: prev[nextIndex] ?? new Date().toISOString(),
    }))
    setActivePartState(nextIndex)
  }, [activePart, isActivePartExpired, parts.length])

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
      currentRoundIndex,
      setCurrentRoundIndex,
      totalRounds,
      deliverableContent,
      setDeliverableContent,
      deliverableArtifacts,
      setDeliverableArtifacts,
      deliverableId,
      setDeliverableId,
      deliverableStatus,
      setDeliverableStatus,
      parts,
      activePart,
      setActivePart,
      activePartRemainingSeconds,
      isActivePartExpired,
    }),
    [
      session,
      api,
      isSubmitted,
      finalResponse,
      remainingSeconds,
      isExpired,
      track,
      mode,
      isAiDisabled,
      autoPlay,
      fixtureData,
      coachMessages,
      pushCoachMessage,
      currentRoundIndex,
      totalRounds,
      deliverableContent,
      deliverableArtifacts,
      deliverableId,
      deliverableStatus,
      parts,
      activePart,
      setActivePart,
      activePartRemainingSeconds,
      isActivePartExpired,
    ]
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
