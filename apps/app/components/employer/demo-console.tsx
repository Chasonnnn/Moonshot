"use client"

import { useCallback, useEffect, useMemo, useState, useTransition, type FocusEvent } from "react"

import {
  loadLiveModelOptions,
  prepareDemoPreview,
  runDemoAutoComplete,
  runDemoFastPath,
  type DemoExecutionMode,
  type LiveCoDesignPromptBundle,
  type LiveModelOption,
  type DemoPreviewRubric,
  type DemoPreviewVariant,
  type DemoStageDiagnostic,
} from "@/actions/pilot"
import { loadReportDetailSnapshot, type ReportDetailSnapshot } from "@/actions/reports"
import { DemoGeneratingAnimation } from "@/components/employer/demo-generating-animation"
import { DemoTemplateCard } from "@/components/employer/demo-template-card"
import { ReportReviewConsole } from "@/components/employer/report-review-console"
import { Button, buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_CASE_TEMPLATES } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES, type DemoDifficultyLevel, type DemoFixtureData } from "@/lib/moonshot/demo-fixtures"
import type { DemoRunPhase, PilotSnapshot } from "@/lib/moonshot/pilot-flow"
import { cn } from "@/lib/utils"

const PHASE_STEPS: { key: DemoRunPhase; label: string }[] = [
  { key: "idle", label: "Select Role" },
  { key: "co_design", label: "Co-Design Loop" },
  { key: "generating", label: "Generating" },
  { key: "preview", label: "Preview & Confirm" },
  { key: "session_ready", label: "Candidate Session" },
  { key: "report", label: "Report" },
]

const GENERATING_STEPS = [
  "Synthesizing role requirements and JD constraints...",
  "Building variant catalog and round progression...",
  "Compiling rubric bullet criteria and score bands...",
  "Preparing deterministic simulation artifacts...",
]

const LIVE_OPERATOR_MODEL = "anthropic/claude-opus-4-6"

interface LiveModelPreset {
  key: string
  label: string
  reasoningLabel: "thinking" | "xhigh" | "fast"
  reasoningEffort: "high" | "xhigh" | "low"
  preferredIds: string[]
}

interface LiveCoDesignDraft {
  jobDescription: string
  sampleTasksText: string
  rubricBlueprintText: string
  difficultyLadderText: string
  agentNotesText: string
}

type CoDesignEditorKey =
  | "job_description"
  | "sample_tasks"
  | "rubric_blueprint"
  | "difficulty_ladder"
  | "agent_notes"

const LIVE_MODEL_PRESETS: LiveModelPreset[] = [
  {
    key: "opus_46_thinking",
    label: "Opus 4.6 (thinking)",
    reasoningLabel: "thinking",
    reasoningEffort: "high",
    preferredIds: [
      "anthropic/claude-opus-4-6",
      "anthropic.claude-4.6-opus",
      "anthropic/claude-4.6-opus",
      "bedrock/global.anthropic.claude-opus-4-6-v1",
      "bedrock/us.anthropic.claude-opus-4-6-v1",
    ],
  },
  {
    key: "codex_53_xhigh",
    label: "Codex 5.3 (xhigh)",
    reasoningLabel: "xhigh",
    reasoningEffort: "xhigh",
    preferredIds: [
      "gpt-5.3-codex",
      "openai.gpt-5.3-codex",
      "openai/gpt-5.3-codex",
      "azure/gpt-5.3-codex",
      "azure_ai/gpt-5.3-codex",
    ],
  },
  {
    key: "chatgpt_52_xhigh",
    label: "ChatGPT 5.2 (xhigh)",
    reasoningLabel: "xhigh",
    reasoningEffort: "xhigh",
    preferredIds: [
      "chatgpt/gpt-5.2",
      "openai.gpt-5.2-chat",
      "openai.gpt-5.2",
      "openai/gpt-5.2-chat",
      "openai/gpt-5.2",
      "azure/gpt-5.2-chat-2025-12-11",
      "azure/gpt-5.2-chat",
      "azure/gpt-5.2",
    ],
  },
  {
    key: "chatgpt_53_fast",
    label: "ChatGPT 5.3 (fast)",
    reasoningLabel: "fast",
    reasoningEffort: "low",
    preferredIds: [
      "chatgpt/gpt-5.3",
      "openai.gpt-5.3",
      "openai/gpt-5.3",
      "openai.gpt-5-chat",
      "openai/gpt-5-chat",
      "azure/gpt-5-chat",
    ],
  },
  {
    key: "gemini_31_pro_preview",
    label: "Gemini 3.1 Pro Preview",
    reasoningLabel: "thinking",
    reasoningEffort: "high",
    preferredIds: [
      "gemini/gemini-3.1-pro-preview",
      "google.gemini-3.1-pro-preview",
      "google/gemini-3.1-pro-preview",
      "vertex_ai/gemini-3.1-pro-preview",
      "nto.google.gemini-3.1-pro-preview",
    ],
  },
  {
    key: "gemini_31_lite",
    label: "Gemini 3.1 Lite",
    reasoningLabel: "fast",
    reasoningEffort: "low",
    preferredIds: [
      "gemini/gemini-3.1-flash-lite-preview",
      "google.gemini-3.1-flash-lite-preview",
      "google/gemini-3.1-flash-lite-preview",
      "vertex_ai/gemini-3.1-flash-lite-preview",
      "nto.google.gemini-3.1-flash-lite-preview",
    ],
  },
]

const LIVE_STAGES: Array<{
  stage: DemoStageDiagnostic["stage"]
  label: string
}> = [
  { stage: "worker_health", label: "Worker Health" },
  { stage: "create_case", label: "Create Case" },
  { stage: "generate", label: "Live Generate" },
  { stage: "publish", label: "Publish Family" },
  { stage: "create_session", label: "Create Session" },
  { stage: "score", label: "Live Score" },
  { stage: "export", label: "Export Report" },
]

function resolvePresetModelId(preset: LiveModelPreset, availableModelIds: Set<string>): string {
  const resolved = preset.preferredIds.find((id) => availableModelIds.has(id))
  return resolved ?? preset.preferredIds[0]
}

function toLineList(values: string[]): string {
  return values.join("\n")
}

function toDifficultyLine(level: DemoDifficultyLevel): string {
  return `${level.level} | ${level.focus} | ${level.expectation}`
}

function buildLiveCoDesignDraft(fixture: DemoFixtureData | null): LiveCoDesignDraft {
  if (!fixture) {
    return {
      jobDescription: "",
      sampleTasksText: "",
      rubricBlueprintText: "",
      difficultyLadderText: "",
      agentNotesText: "",
    }
  }
  return {
    jobDescription: fixture.jobDescription,
    sampleTasksText: toLineList(fixture.coDesignBundle.sampleTasks),
    rubricBlueprintText: toLineList(fixture.coDesignBundle.rubricBlueprint),
    difficultyLadderText: fixture.coDesignBundle.difficultyLadder.map((level) => toDifficultyLine(level)).join("\n"),
    agentNotesText: toLineList(fixture.coDesignBundle.agentNotes),
  }
}

function parseLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function parseDifficultyLadder(input: string): {
  levels: LiveCoDesignPromptBundle["difficultyLadder"]
  invalidLineCount: number
} {
  const levels: LiveCoDesignPromptBundle["difficultyLadder"] = []
  let invalidLineCount = 0
  input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => {
      const parts = line.split("|").map((part) => part.trim())
      if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
        invalidLineCount += 1
        return
      }
      levels.push({
        level: parts[0],
        focus: parts[1],
        expectation: parts.slice(2).join(" | "),
      })
    })
  return { levels, invalidLineCount }
}

function phaseForStepIndicator(phase: DemoRunPhase): DemoRunPhase {
  if (phase === "playing") return "session_ready"
  return phase
}

function phaseIndex(phase: DemoRunPhase): number {
  const normalized = phaseForStepIndicator(phase)
  const idx = PHASE_STEPS.findIndex((s) => s.key === normalized)
  return idx >= 0 ? idx : 0
}

function StepIndicator({ phase }: { phase: DemoRunPhase }) {
  const active = phaseIndex(phase)
  return (
    <div className="flex items-center gap-1">
      {PHASE_STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div
            className={`flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors ${
              i < active
                ? "bg-[#34C759]/10 text-[#34C759]"
                : i === active
                  ? "bg-[#0071E3] text-white"
                  : "bg-[#F5F5F7] text-[#86868B]"
            }`}
          >
            {i < active ? "\u2713 " : ""}
            {step.label}
          </div>
          {i < PHASE_STEPS.length - 1 && (
            <div className={`mx-1 h-px w-4 ${i < active ? "bg-[#34C759]" : "bg-[#D2D2D7]"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export function DemoConsole({ snapshot }: { snapshot: PilotSnapshot }) {
  const [phase, setPhase] = useState<DemoRunPhase>("idle")
  const [demoMode, setDemoMode] = useState<DemoExecutionMode>("fixture")
  const [templateId, setTemplateId] = useState<string>(DEMO_CASE_TEMPLATES[0].id)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [candidateUrl, setCandidateUrl] = useState<string | null>(null)
  const [taskFamilyId, setTaskFamilyId] = useState<string | null>(null)
  const [generatedVariantCount, setGeneratedVariantCount] = useState<number | null>(null)
  const [previewCaseId, setPreviewCaseId] = useState<string | null>(null)
  const [previewTaskFamilyId, setPreviewTaskFamilyId] = useState<string | null>(null)
  const [livePreviewVariants, setLivePreviewVariants] = useState<DemoPreviewVariant[]>([])
  const [livePreviewRubric, setLivePreviewRubric] = useState<DemoPreviewRubric[]>([])
  const [liveCatalogOptions, setLiveCatalogOptions] = useState<LiveModelOption[]>([
    { id: LIVE_OPERATOR_MODEL, label: LIVE_OPERATOR_MODEL },
  ])
  const [liveAvailableModelIds, setLiveAvailableModelIds] = useState<string[]>([LIVE_OPERATOR_MODEL])
  const [selectedLivePresetKey, setSelectedLivePresetKey] = useState<string>(LIVE_MODEL_PRESETS[0].key)
  const [liveCoDesignDraft, setLiveCoDesignDraft] = useState<LiveCoDesignDraft>(() =>
    buildLiveCoDesignDraft(DEMO_FIXTURES[DEMO_CASE_TEMPLATES[0].id] ?? null),
  )
  const [activeCoDesignEditor, setActiveCoDesignEditor] = useState<CoDesignEditorKey | null>(null)
  const [liveModelOptionsError, setLiveModelOptionsError] = useState<string | null>(null)
  const [stageDiagnostics, setStageDiagnostics] = useState<DemoStageDiagnostic[]>([])
  const [activeLiveStage, setActiveLiveStage] = useState<DemoStageDiagnostic["stage"] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportSnapshot, setReportSnapshot] = useState<ReportDetailSnapshot | null>(null)
  const [skillFilter, setSkillFilter] = useState<string>("all")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")

  const [isPreviewPending, startPreviewTransition] = useTransition()
  const [isFastPathPending, startFastPathTransition] = useTransition()
  const [isAutoCompletePending, startAutoCompleteTransition] = useTransition()
  const [isReportLoading, startReportTransition] = useTransition()
  const [isModelCatalogPending, startModelCatalogTransition] = useTransition()

  const fixture = DEMO_FIXTURES[templateId] ?? null
  const candidateAutoplayUrl = candidateUrl ? `${candidateUrl}?autoplay=true` : null
  const previewVariantCatalog = demoMode === "live" ? livePreviewVariants : (fixture?.variantCatalog ?? [])
  const previewRubric = demoMode === "live" ? livePreviewRubric : (fixture?.rubric ?? [])
  const isLiveOperationPending = demoMode === "live" && (isPreviewPending || isFastPathPending || isAutoCompletePending)

  const diagnosticsByStage = useMemo(() => {
    const map = new Map<DemoStageDiagnostic["stage"], DemoStageDiagnostic>()
    stageDiagnostics.forEach((item) => map.set(item.stage, item))
    return map
  }, [stageDiagnostics])

  const uniqueSkills = useMemo(
    () => ["all", ...new Set(previewVariantCatalog.map((item) => item.skill))],
    [previewVariantCatalog],
  )
  const uniqueDifficulties = useMemo(
    () => ["all", ...new Set(previewVariantCatalog.map((item) => item.difficultyLevel))],
    [previewVariantCatalog],
  )

  const filteredVariants = useMemo(() => {
    return previewVariantCatalog.filter((item) => {
      if (skillFilter !== "all" && item.skill !== skillFilter) return false
      if (difficultyFilter !== "all" && item.difficultyLevel !== difficultyFilter) return false
      return true
    })
  }, [previewVariantCatalog, skillFilter, difficultyFilter])

  const liveStageRows = useMemo(() => {
    return LIVE_STAGES.map((stageMeta) => {
      const diagnostic = diagnosticsByStage.get(stageMeta.stage) ?? null
      const status =
        isLiveOperationPending && activeLiveStage === stageMeta.stage
          ? "running"
          : diagnostic?.status === "ok"
            ? "ok"
            : diagnostic?.status === "error"
              ? "error"
              : "idle"
      return {
        ...stageMeta,
        status,
        diagnostic,
      }
    })
  }, [activeLiveStage, diagnosticsByStage, isLiveOperationPending])

  const selectedLivePreset = useMemo(
    () => LIVE_MODEL_PRESETS.find((preset) => preset.key === selectedLivePresetKey) ?? LIVE_MODEL_PRESETS[0],
    [selectedLivePresetKey],
  )
  const selectedLiveModel = useMemo(
    () => resolvePresetModelId(selectedLivePreset, new Set(liveAvailableModelIds)),
    [liveAvailableModelIds, selectedLivePreset],
  )
  const liveCoDesignParse = useMemo(() => {
    const jobDescription = liveCoDesignDraft.jobDescription.trim()
    const sampleTasks = parseLines(liveCoDesignDraft.sampleTasksText)
    const rubricBlueprint = parseLines(liveCoDesignDraft.rubricBlueprintText)
    const agentNotes = parseLines(liveCoDesignDraft.agentNotesText)
    const parsedDifficulty = parseDifficultyLadder(liveCoDesignDraft.difficultyLadderText)
    const bundle: LiveCoDesignPromptBundle = {
      jobDescription,
      sampleTasks,
      rubricBlueprint,
      difficultyLadder: parsedDifficulty.levels,
      agentNotes,
    }
    const errors: string[] = []
    if (!jobDescription) {
      errors.push("Detailed job description is required.")
    }
    if (sampleTasks.length === 0) {
      errors.push("Add at least one sample task.")
    }
    if (rubricBlueprint.length === 0) {
      errors.push("Add at least one rubric blueprint bullet.")
    }
    if (parsedDifficulty.invalidLineCount > 0) {
      errors.push(
        `Fix ${parsedDifficulty.invalidLineCount} difficulty line(s). Use: Level | Focus | Expectation.`,
      )
    }
    if (parsedDifficulty.levels.length === 0) {
      errors.push("Add at least one designed difficulty level.")
    }
    if (agentNotes.length === 0) {
      errors.push("Add at least one agent co-design note.")
    }
    return {
      bundle,
      error: errors.length ? errors[0] : null,
    }
  }, [liveCoDesignDraft])
  const liveCoDesignBundle = liveCoDesignParse.bundle
  const liveCoDesignError = liveCoDesignParse.error

  const refreshLiveModelCatalog = useCallback(() => {
    startModelCatalogTransition(async () => {
      const result = await loadLiveModelOptions()
      setLiveCatalogOptions(result.options)
      setLiveAvailableModelIds(result.availableModelIds)
      setLiveModelOptionsError(result.error)
    })
  }, [startModelCatalogTransition])

  const handleCoDesignCardBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextFocusTarget = event.relatedTarget as Node | null
    if (!nextFocusTarget || !event.currentTarget.contains(nextFocusTarget)) {
      setActiveCoDesignEditor(null)
    }
  }, [])

  const handleTemplateSelect = useCallback((id: string) => {
    if (phase !== "idle") return
    setTemplateId(id)
    setLiveCoDesignDraft(buildLiveCoDesignDraft(DEMO_FIXTURES[id] ?? null))
    setActiveCoDesignEditor(null)
    setSkillFilter("all")
    setDifficultyFilter("all")
    setPreviewCaseId(null)
    setPreviewTaskFamilyId(null)
    setLivePreviewVariants([])
    setLivePreviewRubric([])
    setStageDiagnostics([])
  }, [phase])

  const handleGenerateComplete = useCallback(() => {
    setPhase("preview")
    setError(null)
    setSkillFilter("all")
    setDifficultyFilter("all")
    if (demoMode !== "live") {
      setPreviewCaseId(null)
      setPreviewTaskFamilyId(null)
      setLivePreviewVariants([])
      setLivePreviewRubric([])
      setStageDiagnostics([])
      return
    }
    startPreviewTransition(async () => {
      setActiveLiveStage("generate")
      try {
        const prepared = await prepareDemoPreview(
          templateId,
          "live",
          selectedLiveModel,
          selectedLivePreset.reasoningEffort,
          liveCoDesignBundle,
        )
        setStageDiagnostics(prepared.diagnostics)
        if (prepared.error) {
          setError(prepared.error)
          setPreviewCaseId(null)
          setPreviewTaskFamilyId(null)
          setLivePreviewVariants([])
          setLivePreviewRubric([])
          return
        }
        setPreviewCaseId(prepared.caseId)
        setPreviewTaskFamilyId(prepared.taskFamilyId)
        setGeneratedVariantCount(prepared.generatedVariantCount)
        setLivePreviewVariants(prepared.variants)
        setLivePreviewRubric(prepared.rubric)
      } finally {
        setActiveLiveStage(null)
      }
    })
  }, [demoMode, liveCoDesignBundle, selectedLiveModel, selectedLivePreset.reasoningEffort, templateId])

  const handleConfirmAndStart = useCallback(() => {
    setPhase("session_ready")
    setError(null)
    startFastPathTransition(async () => {
      if (demoMode === "live") {
        setActiveLiveStage("create_session")
      }
      try {
        const result = await runDemoFastPath(templateId, {
          mode: demoMode,
          preparedCaseId: demoMode === "live" ? previewCaseId : null,
          preparedTaskFamilyId: demoMode === "live" ? previewTaskFamilyId : null,
          preparedVariantCount: demoMode === "live" ? livePreviewVariants.length : null,
          previewDiagnostics: demoMode === "live" ? stageDiagnostics : null,
          liveModelOverride: demoMode === "live" ? selectedLiveModel : null,
          liveReasoningEffort: demoMode === "live" ? selectedLivePreset.reasoningEffort : null,
          liveCoDesignBundle: demoMode === "live" ? liveCoDesignBundle : null,
        })
        setStageDiagnostics(result.diagnostics)
        if (result.error) {
          setError(result.error)
          return
        }
        setSessionId(result.sessionId)
        setCandidateUrl(result.candidateUrl)
        setTaskFamilyId(result.taskFamilyId)
        setGeneratedVariantCount(result.generatedVariantCount)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fast-path failed")
      } finally {
        if (demoMode === "live") {
          setActiveLiveStage(null)
        }
      }
    })
  }, [
    demoMode,
    livePreviewVariants.length,
    previewCaseId,
    previewTaskFamilyId,
    selectedLiveModel,
    selectedLivePreset.reasoningEffort,
    stageDiagnostics,
    templateId,
    liveCoDesignBundle,
  ])

  const handleWatchAutoPlay = useCallback(() => {
    if (!sessionId) return
    setPhase("playing")
  }, [sessionId])

  const handleSkipToReport = useCallback(() => {
    if (!sessionId) return
    setError(null)
    startAutoCompleteTransition(async () => {
      if (demoMode === "live") {
        setActiveLiveStage("score")
      }
      try {
        const result = await runDemoAutoComplete(
          sessionId,
          templateId,
          demoMode,
          demoMode === "live" ? selectedLiveModel : null,
          demoMode === "live" ? selectedLivePreset.reasoningEffort : null,
        )
        setStageDiagnostics((prev) => [...prev, ...result.diagnostics])
        if (result.error) {
          setError(result.error)
          return
        }
        setPhase("report")
        startReportTransition(async () => {
          try {
            const snap = await loadReportDetailSnapshot(sessionId)
            setReportSnapshot(snap)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load report")
          }
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Auto-complete failed")
      } finally {
        if (demoMode === "live") {
          setActiveLiveStage(null)
        }
      }
    })
  }, [demoMode, selectedLiveModel, selectedLivePreset.reasoningEffort, sessionId, templateId])

  const handleAutoPlayComplete = useCallback(() => {
    handleSkipToReport()
  }, [handleSkipToReport])

  const handleReset = useCallback(() => {
    setPhase("idle")
    setDemoMode("fixture")
    setTemplateId(DEMO_CASE_TEMPLATES[0].id)
    setSessionId(null)
    setCandidateUrl(null)
    setTaskFamilyId(null)
    setGeneratedVariantCount(null)
    setPreviewCaseId(null)
    setPreviewTaskFamilyId(null)
    setLivePreviewVariants([])
    setLivePreviewRubric([])
    setLiveCatalogOptions([{ id: LIVE_OPERATOR_MODEL, label: LIVE_OPERATOR_MODEL }])
    setLiveAvailableModelIds([LIVE_OPERATOR_MODEL])
    setSelectedLivePresetKey(LIVE_MODEL_PRESETS[0].key)
    setLiveCoDesignDraft(buildLiveCoDesignDraft(DEMO_FIXTURES[DEMO_CASE_TEMPLATES[0].id] ?? null))
    setActiveCoDesignEditor(null)
    setLiveModelOptionsError(null)
    setStageDiagnostics([])
    setActiveLiveStage(null)
    setError(null)
    setReportSnapshot(null)
    setSkillFilter("all")
    setDifficultyFilter("all")
  }, [])

  useEffect(() => {
    if (phase !== "playing") return
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (typeof event.data !== "object" || event.data === null) return
      if (!("type" in event.data) || !("sessionId" in event.data)) return
      const payload = event.data as { type?: unknown; sessionId?: unknown }
      if (payload.type !== "moonshot.autoplay_complete") return
      if (typeof payload.sessionId !== "string" || payload.sessionId !== sessionId) return
      handleAutoPlayComplete()
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [phase, handleAutoPlayComplete, sessionId])

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">Demo Console</h2>
          <p className="mt-1 text-[13px] text-[#6E6E73]">
            Guided simulation: role select, co-design, generate, preview variants, run candidate rounds, then review evaluation.
          </p>
          <div className="mt-3 inline-flex rounded-full border border-[#D2D2D7] bg-white p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDemoMode("fixture")
                setActiveLiveStage(null)
                setActiveCoDesignEditor(null)
                setLiveModelOptionsError(null)
              }}
              disabled={phase !== "idle"}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium",
                demoMode === "fixture" ? "bg-[#1D1D1F] text-white hover:bg-[#2C2C2E]" : "text-[#1D1D1F]",
              )}
            >
              Fixture
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDemoMode("live")
                setStageDiagnostics([])
                setActiveLiveStage(null)
                setActiveCoDesignEditor(null)
                refreshLiveModelCatalog()
              }}
              disabled={phase !== "idle"}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium",
                demoMode === "live" ? "bg-[#1D1D1F] text-white hover:bg-[#2C2C2E]" : "text-[#1D1D1F]",
              )}
            >
              Live (LiteLLM)
            </Button>
          </div>
        </div>
        {!snapshot.ok && (
          <div className="rounded-lg border border-[#FF9F0A]/40 bg-[#FF9F0A]/10 px-3 py-1.5 text-[12px] text-[#A05A00]">
            Backend disconnected
          </div>
        )}
      </div>

      <div className="mb-6 overflow-x-auto">
        <StepIndicator phase={phase} />
      </div>

      {demoMode === "live" && (
        <div className="mb-6 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#0A4A8A]">Operators Panel</p>
              <p className="mt-1 text-[12px] text-[#1D1D1F]">
                Model: {selectedLiveModel} · Reasoning: {selectedLivePreset.reasoningLabel}
              </p>
              <p className="text-[12px] text-[#1D1D1F]">Live stage status updates are shown below.</p>
            </div>
            <div className="min-w-[260px] rounded-lg border border-[#D2D2D7] bg-white p-3">
              <label htmlFor="live-model-preset" className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
                Agent Profile
              </label>
              <Select
                value={selectedLivePresetKey}
                onValueChange={(value) => {
                  if (value) {
                    setSelectedLivePresetKey(value)
                  }
                }}
                disabled={isLiveOperationPending || isModelCatalogPending}
              >
                <SelectTrigger
                  id="live-model-preset"
                  aria-label="Agent Profile"
                  className="mt-1 h-8 w-full rounded-md border border-[#D2D2D7] px-2 text-[12px] text-[#1D1D1F] disabled:opacity-60"
                >
                  <SelectValue placeholder="Select profile" />
                </SelectTrigger>
                <SelectContent>
                  {LIVE_MODEL_PRESETS.map((preset) => (
                    <SelectItem key={preset.key} value={preset.key}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-[#6E6E73]">
                {liveAvailableModelIds.includes(selectedLiveModel)
                  ? "Official LiteLLM model ID resolved."
                  : "Using preferred alias; verify availability in LiteLLM catalog."}
              </p>
              <p className="mt-0.5 text-[11px] text-[#8E8E93]">Catalog aliases loaded: {liveCatalogOptions.length}</p>
              {liveModelOptionsError && (
                <p className="mt-1 text-[11px] text-[#8E8E93]">LiteLLM catalog lookup unavailable. Falling back to aliases.</p>
              )}
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#D2D2D7] bg-white">
            <table className="min-w-full text-left text-[12px]">
              <thead className="bg-[#F5F5F7] text-[#4D4D52]">
                <tr>
                  <th className="px-3 py-2 font-medium">Stage</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {liveStageRows.map((row) => (
                  <tr key={row.stage} className="border-t border-[#F0F0F2]">
                    <td className="px-3 py-2 text-[#1D1D1F]">{row.label}</td>
                    <td className="px-3 py-2 text-[#1D1D1F]">
                      {row.status}
                      {row.diagnostic ? ` (${row.diagnostic.latency_ms}ms)` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-4">
          <p className="text-[13px] font-medium text-[#FF3B30]">Error</p>
          <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
          <Button
            onClick={() => setError(null)}
            variant="link"
            size="xs"
            className="mt-2 px-0 text-[12px] font-medium text-[#0071E3]"
          >
            Dismiss
          </Button>
        </div>
      )}

      {stageDiagnostics.length > 0 && (
        <div className="mb-6 rounded-xl border border-[#E5E5EA] bg-[#FAFAFB] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Stage Diagnostics</p>
          <div className="mt-2 space-y-2">
            {stageDiagnostics.map((diag, idx) => (
              <div key={`${diag.stage}-${diag.job_id ?? "none"}-${idx}`} className="rounded-lg bg-white px-3 py-2 text-[12px]">
                <p className="font-medium text-[#1D1D1F]">
                  {diag.stage} · {diag.status}
                </p>
                <p className="text-[#4D4D52]">
                  {diag.detail} ({diag.latency_ms}ms)
                  {diag.model ? ` · model=${diag.model}` : ""}
                  {diag.job_id ? ` · job=${diag.job_id}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "idle" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {DEMO_CASE_TEMPLATES.map((tpl) => (
              <DemoTemplateCard
                key={tpl.id}
                template={tpl}
                selected={templateId === tpl.id}
                onSelect={() => handleTemplateSelect(tpl.id)}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => setPhase("co_design")}
              disabled={!snapshot.ok}
              className="h-10 px-5 text-[14px] font-medium"
            >
              Start Demo
            </Button>
          </div>
        </div>
      )}

      {phase === "co_design" && fixture && (
        <div className="space-y-4">
          <div
            className={cn("rounded-xl border border-[#E5E5EA] p-6", demoMode === "live" ? "cursor-text" : "")}
            onClick={demoMode === "live" ? () => setActiveCoDesignEditor("job_description") : undefined}
            onBlur={demoMode === "live" ? handleCoDesignCardBlur : undefined}
          >
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Detailed Job Description</p>
            {demoMode === "live" && activeCoDesignEditor === "job_description" ? (
              <div className="space-y-2">
                <Textarea
                  id="live-co-design-job-description"
                  value={liveCoDesignDraft.jobDescription}
                  onChange={(event) =>
                    setLiveCoDesignDraft((prev) => ({ ...prev, jobDescription: event.target.value }))
                  }
                  autoFocus
                  aria-label="Detailed Job Description"
                  className="min-h-[90px] rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]"
                />
              </div>
            ) : (
              <p className="text-[14px] leading-relaxed text-[#1D1D1F]">
                {demoMode === "live" ? liveCoDesignBundle.jobDescription : fixture.jobDescription}
              </p>
            )}
            {demoMode === "live" && activeCoDesignEditor !== "job_description" && (
              <p className="mt-2 text-[11px] text-[#6E6E73]">Click card to edit.</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={cn("rounded-xl border border-[#E5E5EA] p-6", demoMode === "live" ? "cursor-text" : "")}
              onClick={demoMode === "live" ? () => setActiveCoDesignEditor("sample_tasks") : undefined}
              onBlur={demoMode === "live" ? handleCoDesignCardBlur : undefined}
            >
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Sample Tasks</p>
              {demoMode === "live" && activeCoDesignEditor === "sample_tasks" ? (
                <div className="space-y-2">
                  <Textarea
                    id="live-co-design-sample-tasks"
                    value={liveCoDesignDraft.sampleTasksText}
                    onChange={(event) =>
                      setLiveCoDesignDraft((prev) => ({ ...prev, sampleTasksText: event.target.value }))
                    }
                    autoFocus
                    aria-label="Sample Tasks"
                    className="min-h-[120px] rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]"
                  />
                  <p className="text-[11px] text-[#6E6E73]">One bullet per line.</p>
                </div>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
                  {(demoMode === "live" ? liveCoDesignBundle.sampleTasks : fixture.coDesignBundle.sampleTasks).map((task) => (
                    <li key={task}>{task}</li>
                  ))}
                </ul>
              )}
              {demoMode === "live" && activeCoDesignEditor !== "sample_tasks" && (
                <p className="mt-2 text-[11px] text-[#6E6E73]">Click card to edit.</p>
              )}
            </div>
            <div
              className={cn("rounded-xl border border-[#E5E5EA] p-6", demoMode === "live" ? "cursor-text" : "")}
              onClick={demoMode === "live" ? () => setActiveCoDesignEditor("rubric_blueprint") : undefined}
              onBlur={demoMode === "live" ? handleCoDesignCardBlur : undefined}
            >
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Rubric Blueprint</p>
              {demoMode === "live" && activeCoDesignEditor === "rubric_blueprint" ? (
                <div className="space-y-2">
                  <Textarea
                    id="live-co-design-rubric-blueprint"
                    value={liveCoDesignDraft.rubricBlueprintText}
                    onChange={(event) =>
                      setLiveCoDesignDraft((prev) => ({ ...prev, rubricBlueprintText: event.target.value }))
                    }
                    autoFocus
                    aria-label="Rubric Blueprint"
                    className="min-h-[120px] rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]"
                  />
                  <p className="text-[11px] text-[#6E6E73]">One bullet per line.</p>
                </div>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
                  {(demoMode === "live" ? liveCoDesignBundle.rubricBlueprint : fixture.coDesignBundle.rubricBlueprint).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {demoMode === "live" && activeCoDesignEditor !== "rubric_blueprint" && (
                <p className="mt-2 text-[11px] text-[#6E6E73]">Click card to edit.</p>
              )}
            </div>
          </div>

          <div
            className={cn("rounded-xl border border-[#E5E5EA] p-6", demoMode === "live" ? "cursor-text" : "")}
            onClick={demoMode === "live" ? () => setActiveCoDesignEditor("difficulty_ladder") : undefined}
            onBlur={demoMode === "live" ? handleCoDesignCardBlur : undefined}
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Designed Incremental Difficulty Levels</p>
            {demoMode === "live" && activeCoDesignEditor === "difficulty_ladder" && (
              <div className="mb-3 space-y-2">
                <Textarea
                  id="live-co-design-difficulty-ladder"
                  value={liveCoDesignDraft.difficultyLadderText}
                  onChange={(event) =>
                    setLiveCoDesignDraft((prev) => ({ ...prev, difficultyLadderText: event.target.value }))
                  }
                  autoFocus
                  aria-label="Designed Incremental Difficulty Levels"
                  className="min-h-[120px] rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]"
                />
                <p className="text-[11px] text-[#6E6E73]">Use one line per level: `Level | Focus | Expectation`.</p>
              </div>
            )}
            <div className="grid gap-2 md:grid-cols-4">
              {(demoMode === "live" ? liveCoDesignBundle.difficultyLadder : fixture.coDesignBundle.difficultyLadder).map((level) => (
                <div key={level.level} className="rounded-lg bg-[#F5F5F7] p-3">
                  <p className="text-[12px] font-semibold text-[#1D1D1F]">{level.level}</p>
                  <p className="mt-0.5 text-[12px] text-[#4D4D52]">{level.focus}</p>
                  <p className="mt-1 text-[11px] text-[#6E6E73]">{level.expectation}</p>
                </div>
              ))}
            </div>
            {demoMode === "live" && activeCoDesignEditor !== "difficulty_ladder" && (
              <p className="mt-2 text-[11px] text-[#6E6E73]">Click card to edit.</p>
            )}
          </div>

          <div
            className={cn("rounded-xl border border-[#E5E5EA] p-6", demoMode === "live" ? "cursor-text" : "")}
            onClick={demoMode === "live" ? () => setActiveCoDesignEditor("agent_notes") : undefined}
            onBlur={demoMode === "live" ? handleCoDesignCardBlur : undefined}
          >
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Agent Co-Design Notes</p>
            {demoMode === "live" && activeCoDesignEditor === "agent_notes" ? (
              <div className="space-y-2">
                <Textarea
                  id="live-co-design-agent-notes"
                  value={liveCoDesignDraft.agentNotesText}
                  onChange={(event) =>
                    setLiveCoDesignDraft((prev) => ({ ...prev, agentNotesText: event.target.value }))
                  }
                  autoFocus
                  aria-label="Agent Co-Design Notes"
                  className="min-h-[100px] rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]"
                />
                <p className="text-[11px] text-[#6E6E73]">One bullet per line.</p>
              </div>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
                {(demoMode === "live" ? liveCoDesignBundle.agentNotes : fixture.coDesignBundle.agentNotes).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            {demoMode === "live" && activeCoDesignEditor !== "agent_notes" && (
              <p className="mt-2 text-[11px] text-[#6E6E73]">Click card to edit.</p>
            )}
          </div>

          {demoMode === "live" && (
            <div className="rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] p-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">
                Live Response Contract (Locked Schema)
              </p>
              <ul className="list-disc space-y-1 pl-4 text-[12px] text-[#1D1D1F]">
                <li>`variants[]` fields: `prompt`, `skill`, `difficulty_level`, `round_hint`, `estimated_minutes`, `deliverables[]`, `artifact_refs[]`</li>
                <li>`rubric.dimensions[]` fields: `key`, `anchor`, `evaluation_points[]`, `evidence_signals[]`, `common_failure_modes[]`, `score_bands{}`</li>
                <li>No answer leakage; safe simulation content only.</li>
              </ul>
            </div>
          )}

          {demoMode === "live" && liveCoDesignError && (
            <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 px-3 py-2 text-[12px] text-[#C1271A]">
              {liveCoDesignError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setPhase("idle")}
              variant="outline"
              className="h-10 px-5 text-[14px] font-medium"
            >
              Back
            </Button>
            <Button
              onClick={() => setPhase("generating")}
              disabled={demoMode === "live" && !!liveCoDesignError}
              className="h-10 px-5 text-[14px] font-medium"
            >
              Continue to Generate
            </Button>
          </div>
        </div>
      )}

      {phase === "generating" && (
        <div className="rounded-xl border border-[#E5E5EA] p-8">
          <DemoGeneratingAnimation steps={GENERATING_STEPS} onComplete={handleGenerateComplete} />
        </div>
      )}

      {phase === "preview" && (fixture || demoMode === "live") && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E5E5EA] p-6">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Task Prompt</p>
            <p className="text-[14px] leading-relaxed text-[#1D1D1F]">
              {fixture?.taskPrompt ??
                "Live mode preview is generated from the selected role context and surfaced below."}
            </p>
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-6">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Variant Catalog</p>
                <p className="text-[12px] text-[#6E6E73]">
                  Showing {filteredVariants.length} of {previewVariantCatalog.length} variants
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={skillFilter}
                  onValueChange={(value) => {
                    if (value) setSkillFilter(value)
                  }}
                >
                  <SelectTrigger aria-label="Skill Filter" className="h-7 min-w-[140px] rounded-md px-2 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {uniqueSkills.map((skill) => (
                      <SelectItem key={skill} value={skill}>
                        {skill === "all" ? "All skills" : skill}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={difficultyFilter}
                  onValueChange={(value) => {
                    if (value) setDifficultyFilter(value)
                  }}
                >
                  <SelectTrigger aria-label="Difficulty Filter" className="h-7 min-w-[150px] rounded-md px-2 text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {uniqueDifficulties.map((difficulty) => (
                      <SelectItem key={difficulty} value={difficulty}>
                        {difficulty === "all" ? "All difficulty" : difficulty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {demoMode === "live" && isPreviewPending && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#D2D2D7] bg-[#F5F5F7] px-3 py-2">
                <Spinner className="h-4 w-4 text-[#0071E3]" />
                <p className="text-[12px] text-[#4D4D52]">Generating live variants and rubric...</p>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-[#E5E5EA]">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-[#F5F5F7] text-[#4D4D52]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Variant</th>
                    <th className="px-3 py-2 font-medium">Skill</th>
                    <th className="px-3 py-2 font-medium">Difficulty</th>
                    <th className="px-3 py-2 font-medium">Round</th>
                    <th className="px-3 py-2 font-medium">Prompt Summary</th>
                    <th className="px-3 py-2 font-medium">Deliverables</th>
                    <th className="px-3 py-2 font-medium">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((variant) => (
                    <tr key={variant.id} className="border-t border-[#F0F0F2] align-top">
                      <td className="px-3 py-2 font-mono text-[#1D1D1F]">{variant.id}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.skill}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.difficultyLevel}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.roundHint}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.promptSummary}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.deliverables.join(", ")}</td>
                      <td className="px-3 py-2 text-[#1D1D1F]">{variant.estimatedMinutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E5EA] p-6">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">Rubric Dimensions</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {previewRubric.map((dim) => (
                <div key={dim.key} className="rounded-lg bg-[#F5F5F7] p-3">
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">{dim.key.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 text-[12px] text-[#4D4D52]">{dim.anchor}</p>
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-[#6E6E73]">
                    {dim.evaluationPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleConfirmAndStart}
              disabled={
                isPreviewPending ||
                (demoMode === "live" &&
                  (!previewCaseId || !previewTaskFamilyId || previewVariantCatalog.length === 0))
              }
              className="h-10 px-5 text-[14px] font-medium"
            >
              Confirm &amp; Start Session
            </Button>
          </div>
        </div>
      )}

      {phase === "session_ready" && (
        <div className="rounded-xl border border-[#E5E5EA] p-8">
          {isFastPathPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">Setting up assessment session...</p>
              <p className="text-[12px] text-[#6E6E73]">
                {demoMode === "live"
                  ? "Preparing live-generated task family, publishing, and candidate handoff."
                  : "Creating fixture-backed task family, publishing, and preparing candidate handoff."}
              </p>
            </div>
          ) : sessionId ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-[#34C759]/10 p-3">
                <svg className="h-6 w-6 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-[#1D1D1F]">Session ready</p>
              <p className="text-[12px] text-[#6E6E73] text-center">
                Generated task family {taskFamilyId ?? "n/a"} with {generatedVariantCount ?? "n/a"} variants.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  onClick={handleWatchAutoPlay}
                  className="h-10 px-5 text-[14px] font-medium"
                >
                  Watch Auto-Play
                </Button>
                {candidateUrl && (
                  <a
                    href={candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5 text-[14px] font-medium")}
                  >
                    Open in New Tab
                  </a>
                )}
                <Button
                  onClick={handleSkipToReport}
                  variant="outline"
                  className="h-10 px-5 text-[14px] font-medium"
                >
                  Skip to Report
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-[14px] text-[#FF3B30]">Session creation failed.</p>
              <Button
                onClick={() => setPhase("preview")}
                variant="link"
                size="sm"
                className="text-[13px] font-medium text-[#0071E3]"
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === "playing" && sessionId && (
        <div className="space-y-4">
          {isAutoCompletePending ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">Completing session and generating report...</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-[#E5E5EA]">
                <iframe
                  src={candidateAutoplayUrl ?? `/session/${sessionId}?autoplay=true`}
                  className="h-[680px] w-full border-0"
                  title="Candidate Session Auto-Play"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                {candidateUrl && (
                  <a
                    href={candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-5 text-[14px] font-medium")}
                  >
                    Open in New Tab
                  </a>
                )}
                <Button
                  onClick={handleSkipToReport}
                  variant="outline"
                  className="h-10 px-5 text-[14px] font-medium"
                >
                  Skip to Report
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "report" && (
        <div className="space-y-4">
          {isReportLoading || !reportSnapshot ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
              <Spinner className="h-8 w-8 text-[#0071E3]" />
              <p className="text-[14px] font-medium text-[#1D1D1F]">Loading report...</p>
            </div>
          ) : sessionId ? (
            <ReportReviewConsole sessionId={sessionId} snapshot={reportSnapshot} />
          ) : null}
          <div className="flex justify-center pt-2">
            <Button
              onClick={handleReset}
              variant="outline"
              className="h-10 px-5 text-[14px] font-medium"
            >
              Start New Demo
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
