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
import { DEMO_CASE_TEMPLATES, type DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"
import type {
  CandidateSession,
  CandidateWorkspaceTab,
  OralClipType,
  OralDefenseRequirement,
  OralPromptConfig,
  OralResponse,
  CandidateWorkspaceAvailability,
  SessionMode,
} from "@/lib/moonshot/types"
import type { DemoFixtureData } from "@/lib/moonshot/demo-fixtures"

export interface CoachChatMessage {
  id?: string
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
  activeTemplateId: string | null
  activeTemplate: DemoCaseTemplate | null
  workspaceAvailability: CandidateWorkspaceAvailability
  activeWorkspace: CandidateWorkspaceTab
  setActiveWorkspace: (workspace: CandidateWorkspaceTab) => void
  oralResponses: OralResponse[]
  setOralResponses: Dispatch<SetStateAction<OralResponse[]>>
  refreshOralResponses: () => Promise<void>
  oralResponsesLoaded: boolean
  oralResponsesError: string | null
  setOralResponsesError: Dispatch<SetStateAction<string | null>>
  oralRequirement: OralDefenseRequirement
  oralPrompts: OralPromptConfig[]
  latestOralResponses: Partial<Record<OralClipType, OralResponse>>
  missingOralClipTypes: OralClipType[]
  missingOralPromptLabels: string[]
  isOralComplete: boolean
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

const DEFAULT_ORAL_CLIP_TYPES: OralClipType[] = ["presentation", "follow_up_1", "follow_up_2"]
const EMPTY_ORAL_RESPONSES: OralResponse[] = []
const DEFAULT_ORAL_REQUIREMENT: OralDefenseRequirement = {
  required: false,
  requiredClipTypes: [],
  weight: 0,
}
const CORE_WORKSPACE_TABS: CandidateWorkspaceTab[] = ["data", "sql", "python", "dashboard", "report"]
const OPTIONAL_WORKSPACE_TAB_TO_FLAG: Array<[CandidateWorkspaceTab, keyof CandidateWorkspaceAvailability]> = [
  ["spreadsheet", "spreadsheet"],
  ["bi", "bi"],
  ["slides", "slides"],
  ["oral", "oral"],
]
const ORAL_REQUIREMENTS_BY_TEMPLATE: Partial<Record<string, OralDefenseRequirement>> = {
  tpl_data_analyst: { required: true, requiredClipTypes: DEFAULT_ORAL_CLIP_TYPES, weight: 0.15 },
  tpl_jda_quality: { required: true, requiredClipTypes: DEFAULT_ORAL_CLIP_TYPES, weight: 0.2 },
  tpl_jda_ambiguity: { required: true, requiredClipTypes: DEFAULT_ORAL_CLIP_TYPES, weight: 0.2 },
  tpl_revops_forecast_variance: { required: true, requiredClipTypes: DEFAULT_ORAL_CLIP_TYPES, weight: 0.15 },
}
const ORAL_PROMPT_COPY_BY_TEMPLATE: Partial<Record<string, Record<OralClipType, { title: string; prompt: string; questionId?: string }>>> = {
  tpl_data_analyst: {
    presentation: {
      title: "Findings presentation",
      prompt: "Present the root cause, strongest evidence, recommendation, and the main caveat in a concise three-minute readout.",
    },
    follow_up_1: {
      title: "Follow-up 1",
      prompt: "What is the single strongest piece of evidence supporting your root-cause conclusion?",
      questionId: "q-1",
    },
    follow_up_2: {
      title: "Follow-up 2",
      prompt: "What would you validate next before scaling the recommendation?",
      questionId: "q-2",
    },
  },
  tpl_jda_quality: {
    presentation: {
      title: "Owner-ready readout",
      prompt: "Walk through the discrepancy, likely source of failure, and the exact escalation recommendation as if you were briefing an owner.",
    },
    follow_up_1: {
      title: "Follow-up 1",
      prompt: "How did you separate ETL bug evidence from a raw data-quality issue?",
      questionId: "q-1",
    },
    follow_up_2: {
      title: "Follow-up 2",
      prompt: "Who should own the next step and what would trigger a higher-severity escalation?",
      questionId: "q-2",
    },
  },
  tpl_jda_ambiguity: {
    presentation: {
      title: "Stakeholder response readout",
      prompt: "Present your scoped response, core assumptions, and the bounded next-step plan you would give the VP.",
    },
    follow_up_1: {
      title: "Follow-up 1",
      prompt: "Which assumption did you default, and why was it safe enough to proceed with it?",
      questionId: "q-1",
    },
    follow_up_2: {
      title: "Follow-up 2",
      prompt: "What specific signal would make you escalate instead of continuing with the default plan?",
      questionId: "q-2",
    },
  },
}

function createCoachMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `coach-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeOralClipType(value: string): OralClipType | null {
  if (value === "presentation" || value === "follow_up_1" || value === "follow_up_2") {
    return value
  }
  return null
}

function resolveTemplateId(session: CandidateSession): string | null {
  const templateId = session.policy.demo_template_id
  return typeof templateId === "string" && templateId.trim().length > 0 ? templateId.trim() : null
}

function resolveOralRequirement(
  session: CandidateSession,
  fixtureData: DemoFixtureData | null,
  activeTemplate: DemoCaseTemplate | null,
  templateId: string | null
): OralDefenseRequirement {
  const requiredFlag = session.policy.oral_defense_required
  const clipTypesFromPolicy = Array.isArray(session.policy.oral_required_clip_types)
    ? session.policy.oral_required_clip_types
        .map((item) => normalizeOralClipType(String(item).trim()))
        .filter((item): item is OralClipType => item !== null)
    : []

  if (typeof requiredFlag === "boolean") {
    return {
      required: requiredFlag,
      requiredClipTypes: clipTypesFromPolicy.length > 0 ? clipTypesFromPolicy : DEFAULT_ORAL_CLIP_TYPES,
      weight: typeof session.policy.oral_weight === "number" ? session.policy.oral_weight : requiredFlag ? 0.15 : 0,
    }
  }

  if (fixtureData?.oralWorkspace) {
    const clipTypes = fixtureData.oralWorkspace.prompts
      .map((prompt) => normalizeOralClipType(prompt.clipType))
      .filter((item): item is OralClipType => item !== null)
    return {
      required: fixtureData.oralWorkspace.required,
      requiredClipTypes: clipTypes.length > 0 ? clipTypes : DEFAULT_ORAL_CLIP_TYPES,
      weight: fixtureData.oralWorkspace.weight,
    }
  }

  if (activeTemplate?.requiresOralDefense && templateId) {
    return ORAL_REQUIREMENTS_BY_TEMPLATE[templateId] ?? {
      required: true,
      requiredClipTypes: DEFAULT_ORAL_CLIP_TYPES,
      weight: 0.15,
    }
  }

  if (templateId && ORAL_REQUIREMENTS_BY_TEMPLATE[templateId]) {
    return ORAL_REQUIREMENTS_BY_TEMPLATE[templateId] as OralDefenseRequirement
  }

  return DEFAULT_ORAL_REQUIREMENT
}

function buildOralPrompts(
  session: CandidateSession,
  fixtureData: DemoFixtureData | null,
  activeTemplate: DemoCaseTemplate | null,
  templateId: string | null,
  oralRequirement: OralDefenseRequirement
): OralPromptConfig[] {
  if (fixtureData?.oralWorkspace?.prompts?.length) {
    return fixtureData.oralWorkspace.prompts
  }
  if (!oralRequirement.required || oralRequirement.requiredClipTypes.length === 0) {
    return []
  }

  const copy = templateId ? ORAL_PROMPT_COPY_BY_TEMPLATE[templateId] : undefined
  const presentationPrompt = activeTemplate?.candidateAsk ?? session.task_prompt

  return oralRequirement.requiredClipTypes.map((clipType, index) => {
    const promptCopy = copy?.[clipType]
    if (clipType === "presentation") {
      return {
        clipType,
        title: promptCopy?.title ?? "Presentation",
        prompt: promptCopy?.prompt ?? presentationPrompt,
        maxDurationSeconds: 180,
      }
    }

    return {
      clipType,
      title: promptCopy?.title ?? `Follow-up ${index}`,
      prompt: promptCopy?.prompt ?? "Record a concise oral defense of your reasoning and next steps.",
      questionId: promptCopy?.questionId ?? (clipType === "follow_up_1" ? "q-1" : "q-2"),
      maxDurationSeconds: 60,
    }
  })
}

function normalizeOralRequirementKey(clipType: string, questionId: string | null | undefined): OralClipType | null {
  if (clipType === "presentation") {
    return "presentation"
  }
  if (clipType === "follow_up_1" || clipType === "follow_up_2") {
    return clipType
  }
  if (clipType === "follow_up") {
    const normalizedQuestionId = (questionId ?? "").trim().toLowerCase()
    if (normalizedQuestionId === "q-1" || normalizedQuestionId === "1" || normalizedQuestionId === "follow_up_1") {
      return "follow_up_1"
    }
    if (normalizedQuestionId === "q-2" || normalizedQuestionId === "2" || normalizedQuestionId === "follow_up_2") {
      return "follow_up_2"
    }
  }
  return null
}

function buildLatestOralResponses(responses: OralResponse[]): Partial<Record<OralClipType, OralResponse>> {
  const latest: Partial<Record<OralClipType, OralResponse>> = {}
  responses.forEach((response) => {
    if (response.status !== "transcribed") {
      return
    }
    const key = normalizeOralRequirementKey(response.clip_type, response.question_id)
    if (key) {
      const existing = latest[key]
      if (!existing) {
        latest[key] = response
        return
      }
      const existingTimestamp = Date.parse(existing.updated_at || existing.created_at || "")
      const responseTimestamp = Date.parse(response.updated_at || response.created_at || "")
      if (Number.isNaN(existingTimestamp) || (!Number.isNaN(responseTimestamp) && responseTimestamp >= existingTimestamp)) {
        latest[key] = response
      }
    }
  })
  return latest
}

function resolveWorkspaceAvailability(
  activeTemplate: DemoCaseTemplate | null,
  fixtureData: DemoFixtureData | null,
  oralRequirement: OralDefenseRequirement
): CandidateWorkspaceAvailability {
  const workspaceModes = new Set(activeTemplate?.workspaceModes ?? [])
  const toolActions = fixtureData?.rounds.flatMap((round) => round.toolActions ?? []) ?? []
  const hasToolAction = (tool: "spreadsheet" | "bi" | "slides" | "oral") =>
    toolActions.some((action) => action.tool === tool)
  return {
    spreadsheet: workspaceModes.has("spreadsheet") || Boolean(fixtureData?.spreadsheetWorkspace) || hasToolAction("spreadsheet"),
    bi: workspaceModes.has("bi") || Boolean(fixtureData?.biWorkspace) || hasToolAction("bi"),
    slides: workspaceModes.has("slides") || Boolean(fixtureData?.slidesWorkspace) || hasToolAction("slides"),
    oral: workspaceModes.has("oral") || Boolean(fixtureData?.oralWorkspace) || oralRequirement.required || hasToolAction("oral"),
  }
}

function resolveAvailableWorkspaceTabs(
  workspaceAvailability: CandidateWorkspaceAvailability,
): CandidateWorkspaceTab[] {
  const tabs = [...CORE_WORKSPACE_TABS]
  OPTIONAL_WORKSPACE_TAB_TO_FLAG.forEach(([tab, flag]) => {
    if (workspaceAvailability[flag]) {
      tabs.splice(tabs.length - 1, 0, tab)
    }
  })
  return tabs
}

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
  const activeTemplateId = useMemo(() => resolveTemplateId(session), [session])
  const activeTemplate = useMemo(
    () => DEMO_CASE_TEMPLATES.find((item) => item.id === activeTemplateId) ?? null,
    [activeTemplateId]
  )

  const [coachMessages, setCoachMessages] = useState<CoachChatMessage[]>([])
  const pushCoachMessage = useCallback((msg: CoachChatMessage) => {
    setCoachMessages((prev) => [...prev, { ...msg, id: msg.id ?? createCoachMessageId() }])
  }, [])
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const totalRounds = fixtureData?.rounds.length ?? 0
  const [deliverableContent, setDeliverableContent] = useState(
    session.final_response ?? ""
  )
  const [deliverableArtifacts, setDeliverableArtifacts] = useState<string[]>(EMPTY_STRING_ARRAY)
  const [deliverableId, setDeliverableId] = useState<string | null>(null)
  const [deliverableStatus, setDeliverableStatus] = useState<"draft" | "submitted" | null>(null)
  const [oralResponses, setOralResponses] = useState<OralResponse[]>(EMPTY_ORAL_RESPONSES)
  const [oralResponsesLoaded, setOralResponsesLoaded] = useState(false)
  const [oralResponsesError, setOralResponsesError] = useState<string | null>(null)
  const parts = useMemo(
    () => fixtureData?.parts ?? EMPTY_PARTS,
    [fixtureData?.parts]
  )
  const oralRequirement = useMemo(
    () => resolveOralRequirement(session, fixtureData, activeTemplate, activeTemplateId),
    [activeTemplate, activeTemplateId, fixtureData, session]
  )
  const oralPrompts = useMemo(
    () => buildOralPrompts(session, fixtureData, activeTemplate, activeTemplateId, oralRequirement),
    [activeTemplate, activeTemplateId, fixtureData, oralRequirement, session]
  )
  const latestOralResponses = useMemo(
    () => buildLatestOralResponses(oralResponses),
    [oralResponses]
  )
  const missingOralClipTypes = useMemo(() => {
    if (!oralRequirement.required || oralRequirement.requiredClipTypes.length === 0) {
      return []
    }
    return oralRequirement.requiredClipTypes.filter((clipType) => !latestOralResponses[clipType])
  }, [latestOralResponses, oralRequirement.required, oralRequirement.requiredClipTypes])
  const missingOralPromptLabels = useMemo(
    () =>
      oralPrompts
        .filter((prompt) => missingOralClipTypes.includes(prompt.clipType))
        .map((prompt) => prompt.title),
    [missingOralClipTypes, oralPrompts]
  )
  const isOralComplete = !oralRequirement.required || missingOralClipTypes.length === 0
  const workspaceAvailability = useMemo(
    () => resolveWorkspaceAvailability(activeTemplate, fixtureData, oralRequirement),
    [activeTemplate, fixtureData, oralRequirement]
  )
  const [activeWorkspace, setActiveWorkspaceState] = useState<CandidateWorkspaceTab>("data")
  const availableWorkspaceTabs = useMemo(
    () => resolveAvailableWorkspaceTabs(workspaceAvailability),
    [workspaceAvailability]
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

  const refreshOralResponses = useCallback(async () => {
    try {
      const response = await api.listOralResponses()
      setOralResponses(response.items)
      setOralResponsesError(null)
    } catch (error) {
      setOralResponsesError(error instanceof Error ? error.message : "Failed to load oral responses.")
      throw error
    } finally {
      setOralResponsesLoaded(true)
    }
  }, [api])

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
    let cancelled = false
    const hydrateOralResponses = async () => {
      try {
        const response = await api.listOralResponses()
        if (!cancelled) {
          setOralResponses(response.items)
          setOralResponsesError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setOralResponsesError(error instanceof Error ? error.message : "Failed to load oral responses.")
        }
      } finally {
        if (!cancelled) {
          setOralResponsesLoaded(true)
        }
      }
    }
    void hydrateOralResponses()
    return () => {
      cancelled = true
    }
  }, [api])

  useEffect(() => {
    if (availableWorkspaceTabs.includes(activeWorkspace)) {
      return
    }
    setActiveWorkspaceState("data")
  }, [activeWorkspace, availableWorkspaceTabs])

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
  const setActiveWorkspace = useCallback((workspace: CandidateWorkspaceTab) => {
    setActiveWorkspaceState(workspace)
  }, [])

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
      activeTemplateId,
      activeTemplate,
      workspaceAvailability,
      activeWorkspace,
      setActiveWorkspace,
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
      oralResponses,
      setOralResponses,
      refreshOralResponses,
      oralResponsesLoaded,
      oralResponsesError,
      setOralResponsesError,
      oralRequirement,
      oralPrompts,
      latestOralResponses,
      missingOralClipTypes,
      missingOralPromptLabels,
      isOralComplete,
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
      activeTemplateId,
      activeTemplate,
      workspaceAvailability,
      activeWorkspace,
      setActiveWorkspace,
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
      oralResponses,
      refreshOralResponses,
      oralResponsesLoaded,
      oralResponsesError,
      oralRequirement,
      oralPrompts,
      latestOralResponses,
      missingOralClipTypes,
      missingOralPromptLabels,
      isOralComplete,
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
