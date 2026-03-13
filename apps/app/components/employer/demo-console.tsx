"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  type ReactNode,
  type RefObject,
} from "react"

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
import {
  DemoErrorBanner,
  LiveProofPanel,
  type LiveProofPanelState,
  StageDiagnosticsPanel,
  StepIndicator,
} from "@/components/employer/demo-console-fragments"
import { DemoGeneratingAnimation } from "@/components/employer/demo-generating-animation"
import { DemoTemplateCard } from "@/components/employer/demo-template-card"
import { ReportReviewConsole } from "@/components/employer/report-review-console"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { DEMO_CASE_TEMPLATES, type DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"
import { DEMO_FIXTURES, getRoundToolActions, type DemoDifficultyLevel, type DemoFixtureData, type DemoToolType } from "@/lib/moonshot/demo-fixtures"
import type { DemoRunPhase, PilotSnapshot } from "@/lib/moonshot/pilot-flow"
import { cn } from "@/lib/utils"

const FLAGSHIP_TEMPLATE_ID = "tpl_jda_first_hour"
const SECOND_SKIN_TEMPLATE_ID = "tpl_customer_support_judgment"

const GENERATING_STEPS = [
  "Synthesizing role requirements and JD constraints...",
  "Building variant catalog and round progression...",
  "Compiling rubric bullet criteria and score bands...",
  "Preparing deterministic simulation artifacts...",
]

const LIVE_OPERATOR_MODEL = "anthropic/claude-opus-4-6"
const INITIAL_TEMPLATE_ID = FLAGSHIP_TEMPLATE_ID
const INITIAL_LIVE_CATALOG_OPTIONS: LiveModelOption[] = [{ id: LIVE_OPERATOR_MODEL, label: LIVE_OPERATOR_MODEL }]

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

interface DemoConsoleRunState {
  phase: DemoRunPhase
  demoMode: DemoExecutionMode
  templateId: string
  sessionId: string | null
  candidateUrl: string | null
  taskFamilyId: string | null
  generatedVariantCount: number | null
  error: string | null
  reportSnapshot: ReportDetailSnapshot | null
}

interface DemoConsoleLiveState {
  catalogOptions: LiveModelOption[]
  availableModelIds: string[]
  selectedPresetKey: string
  coDesignDraft: LiveCoDesignDraft
  activeEditor: CoDesignEditorKey | null
  modelOptionsError: string | null
  stageDiagnostics: DemoStageDiagnostic[]
  activeStage: DemoStageDiagnostic["stage"] | null
  previewCaseId: string | null
  previewTaskFamilyId: string | null
  previewVariants: DemoPreviewVariant[]
  previewRubric: DemoPreviewRubric[]
}

interface DemoConsoleFilterState {
  skill: string
  difficulty: string
}

interface DemoConsoleState {
  run: DemoConsoleRunState
  live: DemoConsoleLiveState
  filters: DemoConsoleFilterState
}

type DemoConsoleAction =
  | { type: "patch_run"; patch: Partial<DemoConsoleRunState> }
  | { type: "patch_live"; patch: Partial<DemoConsoleLiveState> }
  | { type: "patch_filters"; patch: Partial<DemoConsoleFilterState> }
  | { type: "append_stage_diagnostics"; diagnostics: DemoStageDiagnostic[] }
  | { type: "select_template"; templateId: string }
  | { type: "set_demo_mode"; demoMode: DemoExecutionMode }
  | { type: "set_live_draft_field"; field: keyof LiveCoDesignDraft; value: string }
  | { type: "reset" }

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

function buildFixtureLivePromptBundle(fixture: DemoFixtureData | null): LiveCoDesignPromptBundle | null {
  if (!fixture) {
    return null
  }
  return {
    jobDescription: fixture.jobDescription,
    sampleTasks: fixture.coDesignBundle.sampleTasks,
    rubricBlueprint: fixture.coDesignBundle.rubricBlueprint,
    difficultyLadder: fixture.coDesignBundle.difficultyLadder,
    agentNotes: fixture.coDesignBundle.agentNotes,
  }
}

function getTemplateById(templateId: string): DemoCaseTemplate | null {
  return DEMO_CASE_TEMPLATES.find((item) => item.id === templateId) ?? null
}

const TOOL_LABELS: Record<DemoToolType, string> = {
  sql: "SQL",
  python: "Python",
  r: "R",
  dashboard: "Dashboard",
  spreadsheet: "Spreadsheet",
  bi: "BI",
  slides: "Slides",
  oral: "Oral",
}

function uniqueToolLabels(fixture: DemoFixtureData | null): string[] {
  if (!fixture) {
    return []
  }
  return [...new Set(fixture.rounds.flatMap((round) => getRoundToolActions(round).map((action) => TOOL_LABELS[action.tool])))]
}

function uniqueRoundArtifacts(fixture: DemoFixtureData | null, roundIndex: number): string[] {
  if (!fixture) {
    return []
  }
  const round = fixture.rounds[roundIndex]
  if (!round) {
    return []
  }
  return [
    ...new Set([
      ...round.mockedArtifacts,
      ...getRoundToolActions(round).flatMap((action) => action.artifactRefs ?? []),
    ]),
  ]
}

function countFixtureArtifacts(fixture: DemoFixtureData | null): number {
  if (!fixture) {
    return 0
  }
  return fixture.rounds.reduce(
    (total, round, index) => total + uniqueRoundArtifacts(fixture, index).length,
    0,
  )
}

function formatStageLabel(stage: DemoStageDiagnostic["stage"]): string {
  return stage.replace(/_/g, " ")
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

function createInitialState(templateId: string = INITIAL_TEMPLATE_ID): DemoConsoleState {
  return {
    run: {
      phase: "idle",
      demoMode: "fixture",
      templateId,
      sessionId: null,
      candidateUrl: null,
      taskFamilyId: null,
      generatedVariantCount: null,
      error: null,
      reportSnapshot: null,
    },
    live: {
      catalogOptions: INITIAL_LIVE_CATALOG_OPTIONS,
      availableModelIds: [LIVE_OPERATOR_MODEL],
      selectedPresetKey: LIVE_MODEL_PRESETS[0].key,
      coDesignDraft: buildLiveCoDesignDraft(DEMO_FIXTURES[templateId] ?? null),
      activeEditor: null,
      modelOptionsError: null,
      stageDiagnostics: [],
      activeStage: null,
      previewCaseId: null,
      previewTaskFamilyId: null,
      previewVariants: [],
      previewRubric: [],
    },
    filters: {
      skill: "all",
      difficulty: "all",
    },
  }
}

function demoConsoleReducer(state: DemoConsoleState, action: DemoConsoleAction): DemoConsoleState {
  switch (action.type) {
    case "patch_run":
      return { ...state, run: { ...state.run, ...action.patch } }
    case "patch_live":
      return { ...state, live: { ...state.live, ...action.patch } }
    case "patch_filters":
      return { ...state, filters: { ...state.filters, ...action.patch } }
    case "append_stage_diagnostics":
      return {
        ...state,
        live: {
          ...state.live,
          stageDiagnostics: [...state.live.stageDiagnostics, ...action.diagnostics],
        },
      }
    case "select_template":
      return {
        run: {
          ...state.run,
          templateId: action.templateId,
          sessionId: null,
          candidateUrl: null,
          taskFamilyId: null,
          generatedVariantCount: null,
          error: null,
          reportSnapshot: null,
        },
        live: {
          ...state.live,
          coDesignDraft: buildLiveCoDesignDraft(DEMO_FIXTURES[action.templateId] ?? null),
          activeEditor: null,
          modelOptionsError: null,
          stageDiagnostics: [],
          activeStage: null,
          previewCaseId: null,
          previewTaskFamilyId: null,
          previewVariants: [],
          previewRubric: [],
        },
        filters: {
          skill: "all",
          difficulty: "all",
        },
      }
    case "set_demo_mode":
      return {
        ...state,
        run: {
          ...state.run,
          demoMode: action.demoMode,
        },
        live: {
          ...state.live,
          activeEditor: null,
          modelOptionsError: null,
          stageDiagnostics: [],
          activeStage: null,
          previewCaseId: null,
          previewTaskFamilyId: null,
          previewVariants: [],
          previewRubric: [],
        },
        filters: {
          skill: "all",
          difficulty: "all",
        },
      }
    case "set_live_draft_field":
      return {
        ...state,
        live: {
          ...state.live,
          coDesignDraft: {
            ...state.live.coDesignDraft,
            [action.field]: action.value,
          },
        },
      }
    case "reset":
      return createInitialState()
  }
}

function EvaluationPreviewPanel({
  fixture,
  previewVariantCount,
  previewRubricCount,
}: {
  fixture: DemoFixtureData | null
  previewVariantCount: number
  previewRubricCount: number
}) {
  if (!fixture) {
    return null
  }
  const stageLabel = fixture.parts.length > 0 ? "Stages" : "Rounds"
  const progressionLabel = fixture.parts.length > 0 ? "Stage progression" : "Round progression"
  const progressionCountLabel = fixture.parts.length > 0 ? "stages" : "rounds"

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-4">
        {[
          { label: "Variants", value: String(previewVariantCount) },
          { label: stageLabel, value: String(fixture.rounds.length) },
          { label: "Rubric dimensions", value: String(previewRubricCount) },
          { label: "Tool families", value: String(uniqueToolLabels(fixture).length || fixture.evaluationBundle.toolProficiency.length) },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{item.label}</p>
            <p className="mt-2 text-[24px] font-semibold tracking-tight text-[#0F172A]">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">{progressionLabel}</p>
              <p className="mt-1 text-[13px] text-[#475569]">Show the audience how the difficulty and deliverables build over the session.</p>
            </div>
            <Badge variant="outline" className="border-[#BFDBFE] bg-[#EFF6FF] text-[11px] text-[#1D4ED8]">
              {fixture.rounds.length} {progressionCountLabel}
            </Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {fixture.rounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-[12px] font-semibold text-[#0F172A]">{round.title}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{round.objective}</p>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Deliverables</p>
                <p className="mt-1 text-[12px] text-[#0F172A]">{round.deliverables.join(" · ")}</p>
                {getRoundToolActions(round).length > 0 ? (
                  <>
                    <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Tool trace</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {getRoundToolActions(round).map((action) => (
                        <span key={`${round.id}:${action.tool}:${action.label}`} className="rounded-full border border-[#DBEAFE] bg-white px-2.5 py-1 text-[11px] text-[#1D4ED8]">
                          {TOOL_LABELS[action.tool]}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Tool proficiency forecast</p>
          <div className="mt-4 space-y-3">
            {fixture.evaluationBundle.toolProficiency.map((tool) => (
              <div key={tool.tool}>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="font-medium text-[#0F172A]">{TOOL_LABELS[tool.tool] ?? tool.tool}</span>
                  <span className="text-[#475569]">{tool.score}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#E2E8F0]">
                  <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${tool.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Co-design alignment</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {fixture.evaluationBundle.coDesignAlignment.map((item) => (
              <div key={item.dimension} className="rounded-xl bg-[#F8FAFC] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#0F172A]">{item.dimension}</p>
                  <Badge variant="outline" className="border-[#D1FAE5] bg-[#ECFDF5] text-[11px] text-[#047857]">
                    {item.score}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-[#475569]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Trigger rationale to preview</p>
          <div className="mt-4 space-y-3">
            {fixture.evaluationBundle.triggerRationale.map((item) => (
              <div key={item.code} className="rounded-xl bg-[#F8FAFC] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-[#0F172A]">{item.code}</span>
                  <Badge variant="outline" className="border-[#DBEAFE] bg-[#EFF6FF] text-[11px] text-[#1D4ED8]">
                    {item.impact}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-[#475569]">{item.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateTraceRail({ fixture }: { fixture: DemoFixtureData | null }) {
  if (!fixture) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Evidence to call out live</p>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#0F172A]">
          {fixture.evaluationBundle.agentNarrative.map((item) => (
            <li key={item} className="rounded-xl bg-[#F8FAFC] px-3 py-2">{item}</li>
          ))}
        </ul>
      </div>
      {fixture.rounds.map((round) => (
        <div key={round.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-[#0F172A]">{round.title}</p>
            <Badge variant="outline" className="border-[#CBD5E1] bg-[#F8FAFC] text-[11px] text-[#475569]">
              {round.deliverables.length} deliverables
            </Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{round.objective}</p>
          {getRoundToolActions(round).length > 0 ? (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Tool trace</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getRoundToolActions(round).map((action) => (
                  <span key={`${round.id}:${action.tool}:${action.label}`} className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] text-[#1D4ED8]">
                    {TOOL_LABELS[action.tool]} · {action.label}
                  </span>
                ))}
              </div>
            </>
          ) : null}
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Artifacts to mention</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {uniqueRoundArtifacts(fixture, fixture.rounds.indexOf(round)).slice(0, 5).map((artifact) => (
              <span key={artifact} className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] text-[#1D4ED8]">
                {artifact}
              </span>
            ))}
          </div>
          {getRoundToolActions(round)
            .filter((action) => action.tool === "oral" && action.transcriptExcerpt)
            .map((action) => (
              <div key={`${round.id}:${action.label}:transcript`} className="mt-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">Transcript highlight</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#166534]">{action.transcriptExcerpt}</p>
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}

function StrategyTeaserSection({
  template,
  fixture,
}: {
  template: DemoCaseTemplate | null
  fixture: DemoFixtureData | null
}) {
  if (!template || !fixture) {
    return null
  }

  return (
    <div className="rounded-[32px] border border-[#0F766E]/20 bg-[linear-gradient(145deg,rgba(15,118,110,0.08),rgba(255,255,255,0.96))] p-6 shadow-[0_20px_40px_rgba(15,118,110,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0F766E]">Second skin</p>
          <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-[#0F172A]">{template.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-[#334155]">{template.heroDescription}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#0F172A]">{template.candidateAsk}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {template.teaserStats.map((stat) => (
            <div key={stat.label} className="min-w-[120px] rounded-2xl border border-[#99F6E4]/40 bg-white/90 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0F766E]">{stat.label}</p>
              <p className="mt-1 text-[18px] font-semibold text-[#0F172A]">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-[#D1FAE5] bg-white/90 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0F766E]">Program arc</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {fixture.parts.map((part) => (
              <div key={part.id} className="rounded-xl bg-[#F0FDFA] px-4 py-3">
                <p className="text-[12px] font-semibold text-[#0F172A]">{part.title}</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{part.description}</p>
                <p className="mt-2 text-[11px] text-[#0F766E]">{part.time_limit_minutes} min · {part.deliverable_type}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#D1FAE5] bg-white/90 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0F766E]">Why the same engine transfers</p>
          <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-[#0F172A]">
            {template.trustHighlights.map((item) => (
              <li key={item} className="rounded-xl bg-[#F0FDFA] px-3 py-2">{item}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {template.artifacts.map((artifact) => (
              <span key={artifact.name} className="rounded-full border border-[#99F6E4]/50 bg-white px-3 py-1 text-[11px] text-[#115E59]">
                {artifact.type}: {artifact.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoConsoleHeader({
  demoMode,
  phase,
  snapshotOk,
  onSelectFixtureMode,
  onSelectLiveMode,
}: {
  demoMode: DemoExecutionMode
  phase: DemoRunPhase
  snapshotOk: boolean
  onSelectFixtureMode: () => void
  onSelectLiveMode: () => void
}) {
  const isIdle = phase === "idle"

  return (
    <div className="mb-6" data-testid={isIdle ? "demo-launch-band" : undefined}>
      {isIdle ? (
        <div className="inline-flex rounded-full border border-[var(--ops-border)] bg-white p-1">
          <button
            type="button"
            onClick={onSelectFixtureMode}
            className={cn(
              "min-h-10 rounded-full px-4 py-2 text-[13px] font-medium md:min-h-8 md:px-3 md:py-1 md:text-[12px]",
              demoMode === "fixture" ? "bg-[var(--ops-text)] text-white" : "text-[var(--ops-text)]",
            )}
          >
            Hybrid fixture
          </button>
          <button
            type="button"
            onClick={onSelectLiveMode}
            className={cn(
              "min-h-10 rounded-full px-4 py-2 text-[13px] font-medium md:min-h-8 md:px-3 md:py-1 md:text-[12px]",
              demoMode === "live" ? "bg-[var(--ops-text)] text-white" : "text-[var(--ops-text)]",
            )}
          >
            Fully live
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-[var(--ops-border)] text-[11px] text-[var(--ops-text-muted)]">
            {demoMode === "fixture" ? "Hybrid fixture" : "Fully live"}
          </Badge>
          <span className="text-[12px] text-[var(--ops-text-muted)]">{phase.replace(/_/g, " ")}</span>
        </div>
      )}

      {!snapshotOk && isIdle ? (
        <div className="mt-3 rounded-xl border border-[var(--ops-danger)]/20 bg-[var(--ops-danger)]/5 px-4 py-2 text-[12px] text-[var(--ops-danger)]">
          Backend disconnected
        </div>
      ) : null}
    </div>
  )
}

function LiveOperatorsPanel({
  selectedLiveModel,
  selectedLiveResolvedModel,
  selectedLivePreset,
  selectedLivePresetKey,
  liveAvailableModelIds,
  liveCatalogOptions,
  liveModelOptionsError,
  liveStageRows,
  isLiveOperationPending,
  isModelCatalogPending,
  onSelectPreset,
}: {
  selectedLiveModel: string
  selectedLiveResolvedModel: string
  selectedLivePreset: LiveModelPreset
  selectedLivePresetKey: string
  liveAvailableModelIds: string[]
  liveCatalogOptions: LiveModelOption[]
  liveModelOptionsError: string | null
  liveStageRows: Array<{
    stage: DemoStageDiagnostic["stage"]
    label: string
    status: "running" | "ok" | "error" | "idle"
    diagnostic: DemoStageDiagnostic | null
  }>
  isLiveOperationPending: boolean
  isModelCatalogPending: boolean
  onSelectPreset: (value: string) => void
}) {
  return (
    <div className="mb-6 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#0A4A8A]">Operators Panel</p>
          <p className="mt-1 text-[12px] text-[#1D1D1F]">
            Model: {selectedLiveModel}
            {selectedLiveResolvedModel !== selectedLiveModel ? ` (resolved: ${selectedLiveResolvedModel})` : ""}
            {" · "}Reasoning: {selectedLivePreset.reasoningLabel}
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
              if (value) onSelectPreset(value)
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
            {liveAvailableModelIds.includes(selectedLiveResolvedModel)
              ? "Official LiteLLM model ID resolved."
              : "Using preferred alias; verify availability in LiteLLM catalog."}
          </p>
          <p className="mt-0.5 text-[11px] text-[#8E8E93]">Catalog aliases loaded: {liveCatalogOptions.length}</p>
          {liveModelOptionsError && (
            <p className="mt-1 text-[11px] text-[#8E8E93]">LiteLLM catalog lookup unavailable. Falling back to aliases.</p>
          )}
        </div>
      </div>
      <div className="ops-scroll-region mt-3 overflow-x-auto rounded-lg border border-[#D2D2D7] bg-white" tabIndex={0} aria-label="Live stage status table">
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
  )
}

interface RoleGroup {
  role: string
  templates: DemoCaseTemplate[]
  toolLabels: string[]
  durationRange: string
}

function RoleCard({
  group,
  selected,
  compact,
  onClick,
}: {
  group: RoleGroup
  selected: boolean
  compact?: boolean
  onClick: () => void
}) {
  const count = group.templates.length
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border text-left transition-colors",
        selected
          ? "border-[var(--ops-accent)] bg-[var(--ops-accent)]/5"
          : "border-[var(--ops-border)] bg-white hover:border-[var(--ops-text-muted)]/40",
        compact ? "p-3" : "p-3.5",
      )}
    >
      <h4 className="text-[13px] font-semibold text-[var(--ops-text)]">{group.role}</h4>
      <p className="mt-1 text-[12px] text-[var(--ops-text-muted)]">
        {count} {count === 1 ? "simulation" : "simulations"} &middot; {group.durationRange}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {group.toolLabels.map((label) => (
          <span
            key={label}
            className="rounded-full border border-[var(--ops-border)] px-2 py-0.5 text-[10px] text-[var(--ops-text-muted)]"
          >
            {label}
          </span>
        ))}
      </div>
    </button>
  )
}

function TemplateSelectionSection({
  templateId,
  snapshotOk,
  startLabel,
  onSelectTemplate,
  onStartDemo,
}: {
  templateId: string
  snapshotOk: boolean
  startLabel: string
  onSelectTemplate: (id: string) => void
  onStartDemo: () => void
}) {
  const sponsorTemplates = useMemo(
    () =>
      DEMO_CASE_TEMPLATES.filter((tpl) => [FLAGSHIP_TEMPLATE_ID, SECOND_SKIN_TEMPLATE_ID].includes(tpl.id)),
    [],
  )
  const activeTemplate = sponsorTemplates.find((tpl) => tpl.id === templateId) ?? sponsorTemplates[0] ?? null

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#2563EB]">Sponsor-ready demo story</p>
        <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-[#0F172A]">
          Lead with one flagship work sample, then show the reusable second skin.
        </h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[#475569]">
          The primary demo is the 60-minute junior analyst first-hour simulation. Customer Support stays visible as the only
          second skin on the same engine. Legacy analyst, strategy, and ops templates remain in the repo, but they do not lead
          this sponsor story.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-3">
          {sponsorTemplates.map((tpl) => (
            <DemoTemplateCard
              key={tpl.id}
              template={tpl}
              selected={templateId === tpl.id}
              onSelect={() => onSelectTemplate(tpl.id)}
            />
          ))}
        </div>
        <div className="rounded-[28px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Four demo surfaces</p>
          <div className="mt-4 space-y-3">
            {[
              "Seeded employer authoring with light edits to the role brief, artifacts, and failure cases",
              "Candidate simulation in the existing three-pane shell with staged timers and the supervisor pivot",
              "Assessment dashboard that leads with seven dimensions plus artifact, tool, and message evidence",
              "Practice retry that reuses the same engine for targeted feedback and one revision attempt",
            ].map((item, index) => (
              <div key={item} className="rounded-2xl border border-white bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Surface {index + 1}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[#0F172A]">{item}</p>
              </div>
            ))}
          </div>
          {activeTemplate ? (
            <div className="mt-4 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">Selected sponsor path</p>
              <p className="mt-1 text-[16px] font-semibold text-[#0F172A]">{activeTemplate.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#334155]">{activeTemplate.heroDescription}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button
          type="button"
          onClick={onStartDemo}
          disabled={!snapshotOk}
          className="h-11 rounded-full bg-[var(--ops-accent)] px-6 text-[14px] font-semibold text-white hover:bg-[var(--ops-accent)]/90"
        >
          {startLabel}
        </Button>
      </div>
    </div>
  )
}

function CoDesignEditableCard({
  label,
  isEditable,
  isEditing,
  onEdit,
  onDone,
  textareaId,
  textareaLabel,
  textareaRef,
  value,
  onChange,
  helperText,
  previewHint,
  children,
  showPreviewWhileEditing = false,
  textareaClassName,
}: {
  label: string
  isEditable: boolean
  isEditing: boolean
  onEdit: () => void
  onDone: () => void
  textareaId: string
  textareaLabel: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (value: string) => void
  helperText?: string
  previewHint?: string
  children: ReactNode
  showPreviewWhileEditing?: boolean
  textareaClassName?: string
}) {
  return (
    <div className="rounded-xl border border-[#E5E5EA] p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#6E6E73]">{label}</p>
        {isEditable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={isEditing ? onDone : onEdit}
            className="h-7 px-3 text-[11px] font-medium"
          >
            {isEditing ? "Done" : "Edit"}
          </Button>
        ) : null}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            id={textareaId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-label={textareaLabel}
            className={cn(
              "rounded-xl border border-[#D2D2D7] bg-white text-[13px] text-[#1D1D1F]",
              textareaClassName,
            )}
          />
          {helperText ? <p className="text-[11px] text-[#6E6E73]">{helperText}</p> : null}
        </div>
      ) : null}
      {showPreviewWhileEditing || !isEditing ? children : null}
      {isEditable && !isEditing && previewHint ? <p className="mt-2 text-[11px] text-[#6E6E73]">{previewHint}</p> : null}
    </div>
  )
}

function CoDesignSection({
  demoMode,
  fixture,
  liveCoDesignBundle,
  liveCoDesignDraft,
  activeEditor,
  liveCoDesignError,
  onEdit,
  onDoneEditing,
  onDraftChange,
  onBack,
  onContinue,
  jobDescriptionRef,
  sampleTasksRef,
  rubricBlueprintRef,
  difficultyLadderRef,
  agentNotesRef,
}: {
  demoMode: DemoExecutionMode
  fixture: DemoFixtureData | null
  liveCoDesignBundle: LiveCoDesignPromptBundle
  liveCoDesignDraft: LiveCoDesignDraft
  activeEditor: CoDesignEditorKey | null
  liveCoDesignError: string | null
  onEdit: (key: CoDesignEditorKey) => void
  onDoneEditing: () => void
  onDraftChange: (field: keyof LiveCoDesignDraft, value: string) => void
  onBack: () => void
  onContinue: () => void
  jobDescriptionRef: RefObject<HTMLTextAreaElement | null>
  sampleTasksRef: RefObject<HTMLTextAreaElement | null>
  rubricBlueprintRef: RefObject<HTMLTextAreaElement | null>
  difficultyLadderRef: RefObject<HTMLTextAreaElement | null>
  agentNotesRef: RefObject<HTMLTextAreaElement | null>
}) {
  const isLiveMode = demoMode === "live"
  const displayedJobDescription = isLiveMode ? liveCoDesignBundle.jobDescription : (fixture?.jobDescription ?? "")
  const displayedSampleTasks = isLiveMode ? liveCoDesignBundle.sampleTasks : (fixture?.coDesignBundle.sampleTasks ?? [])
  const displayedRubricBlueprint = isLiveMode
    ? liveCoDesignBundle.rubricBlueprint
    : (fixture?.coDesignBundle.rubricBlueprint ?? [])
  const displayedDifficultyLadder = isLiveMode
    ? liveCoDesignBundle.difficultyLadder
    : (fixture?.coDesignBundle.difficultyLadder ?? [])
  const displayedAgentNotes = isLiveMode ? liveCoDesignBundle.agentNotes : (fixture?.coDesignBundle.agentNotes ?? [])

  return (
    <div className="space-y-4">
      <CoDesignEditableCard
        label="Detailed Job Description"
        isEditable={isLiveMode}
        isEditing={activeEditor === "job_description"}
        onEdit={() => onEdit("job_description")}
        onDone={onDoneEditing}
        textareaId="live-co-design-job-description"
        textareaLabel="Detailed Job Description"
        textareaRef={jobDescriptionRef}
        value={liveCoDesignDraft.jobDescription}
        onChange={(value) => onDraftChange("jobDescription", value)}
        previewHint="Use Edit to update the job description."
        textareaClassName="min-h-[90px]"
      >
        <p className="text-[14px] leading-relaxed text-[#1D1D1F]">{displayedJobDescription}</p>
      </CoDesignEditableCard>

      <div className="grid gap-4 md:grid-cols-2">
        <CoDesignEditableCard
          label="Sample Tasks"
          isEditable={isLiveMode}
          isEditing={activeEditor === "sample_tasks"}
          onEdit={() => onEdit("sample_tasks")}
          onDone={onDoneEditing}
          textareaId="live-co-design-sample-tasks"
          textareaLabel="Sample Tasks"
          textareaRef={sampleTasksRef}
          value={liveCoDesignDraft.sampleTasksText}
          onChange={(value) => onDraftChange("sampleTasksText", value)}
          helperText="One bullet per line."
          previewHint="Use Edit to update the sample tasks."
          textareaClassName="min-h-[120px]"
        >
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
            {displayedSampleTasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </CoDesignEditableCard>

        <CoDesignEditableCard
          label="Rubric Blueprint"
          isEditable={isLiveMode}
          isEditing={activeEditor === "rubric_blueprint"}
          onEdit={() => onEdit("rubric_blueprint")}
          onDone={onDoneEditing}
          textareaId="live-co-design-rubric-blueprint"
          textareaLabel="Rubric Blueprint"
          textareaRef={rubricBlueprintRef}
          value={liveCoDesignDraft.rubricBlueprintText}
          onChange={(value) => onDraftChange("rubricBlueprintText", value)}
          helperText="One bullet per line."
          previewHint="Use Edit to update the rubric blueprint."
          textareaClassName="min-h-[120px]"
        >
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
            {displayedRubricBlueprint.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CoDesignEditableCard>
      </div>

      <CoDesignEditableCard
        label="Designed Incremental Difficulty Levels"
        isEditable={isLiveMode}
        isEditing={activeEditor === "difficulty_ladder"}
        onEdit={() => onEdit("difficulty_ladder")}
        onDone={onDoneEditing}
        textareaId="live-co-design-difficulty-ladder"
        textareaLabel="Designed Incremental Difficulty Levels"
        textareaRef={difficultyLadderRef}
        value={liveCoDesignDraft.difficultyLadderText}
        onChange={(value) => onDraftChange("difficultyLadderText", value)}
        helperText="Use one line per level: `Level | Focus | Expectation`."
        previewHint="Use Edit to update the designed difficulty ladder."
        showPreviewWhileEditing
        textareaClassName="mb-3 min-h-[120px]"
      >
        <div className="grid gap-2 md:grid-cols-4">
          {displayedDifficultyLadder.map((level) => (
            <div key={level.level} className="rounded-lg bg-[#F5F5F7] p-3">
              <p className="text-[12px] font-semibold text-[#1D1D1F]">{level.level}</p>
              <p className="mt-0.5 text-[12px] text-[#4D4D52]">{level.focus}</p>
              <p className="mt-1 text-[11px] text-[#6E6E73]">{level.expectation}</p>
            </div>
          ))}
        </div>
      </CoDesignEditableCard>

      <CoDesignEditableCard
        label="Agent Co-Design Notes"
        isEditable={isLiveMode}
        isEditing={activeEditor === "agent_notes"}
        onEdit={() => onEdit("agent_notes")}
        onDone={onDoneEditing}
        textareaId="live-co-design-agent-notes"
        textareaLabel="Agent Co-Design Notes"
        textareaRef={agentNotesRef}
        value={liveCoDesignDraft.agentNotesText}
        onChange={(value) => onDraftChange("agentNotesText", value)}
        helperText="One bullet per line."
        previewHint="Use Edit to update the co-design notes."
        textareaClassName="min-h-[100px]"
      >
        <ul className="list-disc space-y-1 pl-4 text-[13px] text-[#1D1D1F]">
          {displayedAgentNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </CoDesignEditableCard>

      {isLiveMode && (
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

      {isLiveMode && liveCoDesignError && (
        <div className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/5 px-3 py-2 text-[12px] text-[#C1271A]">
          {liveCoDesignError}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button onClick={onBack} variant="outline" className="h-10 px-5 text-[14px] font-medium">
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={isLiveMode && !!liveCoDesignError}
          className="h-10 px-5 text-[14px] font-medium"
        >
          Continue to Generate
        </Button>
      </div>
    </div>
  )
}

function PreviewSection({
  demoMode,
  template,
  fixture,
  previewVariantCatalog,
  filteredVariants,
  previewRubric,
  uniqueSkills,
  uniqueDifficulties,
  skillFilter,
  difficultyFilter,
  isPreviewPending,
  previewCaseId,
  previewTaskFamilyId,
  onSkillFilterChange,
  onDifficultyFilterChange,
  onConfirmAndStart,
}: {
  demoMode: DemoExecutionMode
  template: DemoCaseTemplate | null
  fixture: DemoFixtureData | null
  previewVariantCatalog: DemoPreviewVariant[]
  filteredVariants: DemoPreviewVariant[]
  previewRubric: DemoPreviewRubric[]
  uniqueSkills: string[]
  uniqueDifficulties: string[]
  skillFilter: string
  difficultyFilter: string
  isPreviewPending: boolean
  previewCaseId: string | null
  previewTaskFamilyId: string | null
  onSkillFilterChange: (value: string) => void
  onDifficultyFilterChange: (value: string) => void
  onConfirmAndStart: () => void
}) {
  const stageLabel = fixture?.parts.length ? "Stage" : "Round"
  const stepLabel = fixture?.parts.length ? "Stage" : "Step"

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Task prompt</p>
          <p className="text-[14px] leading-relaxed text-[#0F172A]">
            {fixture?.taskPrompt ?? "Live mode preview is generated from the selected role context and surfaced below."}
          </p>
          {template ? (
            <p className="mt-3 text-[12px] leading-relaxed text-[#475569]">
              {template.heroDescription}
            </p>
          ) : null}
        </div>

        {template ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">{stageLabel} plan to narrate</p>
            <div className="mt-3 space-y-3">
              {template.roundHighlights.map((item, index) => (
                <div key={item} className="rounded-xl bg-[#F8FAFC] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">{stepLabel} {index + 1}</p>
                  <p className="mt-1 text-[13px] text-[#0F172A]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <EvaluationPreviewPanel
        fixture={fixture}
        previewVariantCount={previewVariantCatalog.length}
        previewRubricCount={previewRubric.length}
      />

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Variant catalog</p>
            <p className="text-[12px] text-[#64748B]">
              Showing {filteredVariants.length} of {previewVariantCatalog.length} variants
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={skillFilter} onValueChange={(value) => value && onSkillFilterChange(value)}>
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
            <Select value={difficultyFilter} onValueChange={(value) => value && onDifficultyFilterChange(value)}>
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

        <div className="ops-scroll-region overflow-x-auto rounded-lg border border-[#E5E5EA]" tabIndex={0} aria-label="Generated variants table">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-[#F5F5F7] text-[#4D4D52]">
              <tr>
                <th className="px-3 py-2 font-medium">Variant</th>
                <th className="px-3 py-2 font-medium">Skill</th>
                <th className="px-3 py-2 font-medium">Difficulty</th>
                <th className="px-3 py-2 font-medium">{stageLabel}</th>
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

      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">Rubric dimensions</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {previewRubric.map((dim) => (
            <div key={dim.key} className="rounded-lg bg-[#F8FAFC] p-3">
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
          onClick={onConfirmAndStart}
          disabled={
            isPreviewPending ||
            (demoMode === "live" && (!previewCaseId || !previewTaskFamilyId || previewVariantCatalog.length === 0))
          }
          className="h-11 rounded-full px-6 text-[14px] font-semibold"
        >
          Confirm &amp; Start Session
        </Button>
      </div>
    </div>
  )
}

function SessionReadySection({
  demoMode,
  fixture,
  sessionId,
  candidateUrl,
  taskFamilyId,
  generatedVariantCount,
  isFastPathPending,
  onWatchAutoPlay,
  onSkipToReport,
  onRetry,
}: {
  demoMode: DemoExecutionMode
  fixture: DemoFixtureData | null
  sessionId: string | null
  candidateUrl: string | null
  taskFamilyId: string | null
  generatedVariantCount: number | null
  isFastPathPending: boolean
  onWatchAutoPlay: () => void
  onSkipToReport: () => void
  onRetry: () => void
}) {
  const stageCountLabel = fixture?.parts.length ? "Stages" : "Rounds"

  return (
    <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-8">
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
          {fixture ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: stageCountLabel, value: String(fixture.rounds.length) },
                { label: "Evidence events", value: String(fixture.sampleEvents.length) },
                { label: "Coach turns", value: String(fixture.coachScript.length) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{item.label}</p>
                  <p className="mt-1 text-[20px] font-semibold text-[#0F172A]">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={onWatchAutoPlay} className="h-11 rounded-full px-6 text-[14px] font-semibold">
              Watch Auto-Play
            </Button>
            {candidateUrl && (
              <a
                href={candidateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full px-6 text-[14px] font-semibold")}
              >
                Open in New Tab
              </a>
            )}
            <Button onClick={onSkipToReport} variant="outline" className="h-11 rounded-full px-6 text-[14px] font-semibold">
              Skip to Report
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-[14px] text-[#FF3B30]">Session creation failed.</p>
          <Button onClick={onRetry} variant="link" size="sm" className="text-[13px] font-medium text-[#0071E3]">
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}

function PlayingSection({
  sessionId,
  candidateUrl,
  candidateAutoplayUrl,
  fixture,
  isAutoCompletePending,
  onSkipToReport,
}: {
  sessionId: string
  candidateUrl: string | null
  candidateAutoplayUrl: string | null
  fixture: DemoFixtureData | null
  isAutoCompletePending: boolean
  onSkipToReport: () => void
}) {
  return (
    <div className="space-y-4">
      {isAutoCompletePending ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
          <Spinner className="h-8 w-8 text-[#0071E3]" />
          <p className="text-[14px] font-medium text-[#1D1D1F]">Completing session and generating report...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_360px]">
            <div className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white">
              <iframe
                src={candidateAutoplayUrl ?? `/session/${sessionId}?autoplay=true`}
                className="h-[680px] w-full border-0"
                title="Candidate Session Auto-Play"
              />
            </div>
            <CandidateTraceRail fixture={fixture} />
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {candidateUrl && (
              <a
                href={candidateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 rounded-full px-6 text-[14px] font-semibold")}
              >
                Open in New Tab
              </a>
            )}
            <Button onClick={onSkipToReport} variant="outline" className="h-11 rounded-full px-6 text-[14px] font-semibold">
              Skip to Report
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function ReportPhaseSection({
  isReportLoading,
  reportSnapshot,
  sessionId,
  showStrategyTeaser,
  onReset,
}: {
  isReportLoading: boolean
  reportSnapshot: ReportDetailSnapshot | null
  sessionId: string | null
  showStrategyTeaser: boolean
  onReset: () => void
}) {
  const strategyTemplate = getTemplateById(SECOND_SKIN_TEMPLATE_ID)
  const strategyFixture = DEMO_FIXTURES[SECOND_SKIN_TEMPLATE_ID] ?? null

  return (
    <div className="space-y-4">
      {isReportLoading || !reportSnapshot ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-[#E5E5EA] py-12">
          <Spinner className="h-8 w-8 text-[#0071E3]" />
          <p className="text-[14px] font-medium text-[#1D1D1F]">Loading report...</p>
        </div>
      ) : sessionId ? (
        <ReportReviewConsole sessionId={sessionId} snapshot={reportSnapshot} />
      ) : null}
      {showStrategyTeaser && !isReportLoading && reportSnapshot ? (
        <StrategyTeaserSection template={strategyTemplate} fixture={strategyFixture} />
      ) : null}
      <div className="flex justify-center pt-2">
        <Button onClick={onReset} variant="outline" className="h-11 rounded-full px-6 text-[14px] font-semibold">
          Start New Demo
        </Button>
      </div>
    </div>
  )
}

function useDemoConsoleController() {
  const [state, dispatch] = useReducer(demoConsoleReducer, undefined, createInitialState)
  const [isPreviewPending, startPreviewTransition] = useTransition()
  const [isFastPathPending, startFastPathTransition] = useTransition()
  const [isAutoCompletePending, startAutoCompleteTransition] = useTransition()
  const [isReportLoading, startReportTransition] = useTransition()
  const [isModelCatalogPending, startModelCatalogTransition] = useTransition()

  const jobDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const sampleTasksRef = useRef<HTMLTextAreaElement>(null)
  const rubricBlueprintRef = useRef<HTMLTextAreaElement>(null)
  const difficultyLadderRef = useRef<HTMLTextAreaElement>(null)
  const agentNotesRef = useRef<HTMLTextAreaElement>(null)

  const activeTemplate = getTemplateById(state.run.templateId)
  const fixture = DEMO_FIXTURES[state.run.templateId] ?? null
  const sessionId = state.run.sessionId
  const candidateAutoplayUrl = state.run.candidateUrl ? `${state.run.candidateUrl}?autoplay=true` : null
  const previewVariantCatalog =
    state.run.demoMode === "live" ? state.live.previewVariants : (fixture?.variantCatalog ?? [])
  const previewRubric = state.run.demoMode === "live" ? state.live.previewRubric : (fixture?.rubric ?? [])
  const isLiveOperationPending =
    state.run.demoMode === "live" && (isPreviewPending || isFastPathPending || isAutoCompletePending)

  const diagnosticsByStage = useMemo(() => {
    const map = new Map<DemoStageDiagnostic["stage"], DemoStageDiagnostic>()
    state.live.stageDiagnostics.forEach((item) => map.set(item.stage, item))
    return map
  }, [state.live.stageDiagnostics])

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
      if (state.filters.skill !== "all" && item.skill !== state.filters.skill) return false
      if (state.filters.difficulty !== "all" && item.difficultyLevel !== state.filters.difficulty) return false
      return true
    })
  }, [previewVariantCatalog, state.filters.difficulty, state.filters.skill])

  const liveStageRows = useMemo(() => {
    return LIVE_STAGES.map((stageMeta) => {
      const diagnostic = diagnosticsByStage.get(stageMeta.stage) ?? null
      const status =
        isLiveOperationPending && state.live.activeStage === stageMeta.stage
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
  }, [diagnosticsByStage, isLiveOperationPending, state.live.activeStage])

  const selectedLivePreset = useMemo(
    () => LIVE_MODEL_PRESETS.find((preset) => preset.key === state.live.selectedPresetKey) ?? LIVE_MODEL_PRESETS[0],
    [state.live.selectedPresetKey],
  )
  const selectedLiveResolvedModel = useMemo(
    () => resolvePresetModelId(selectedLivePreset, new Set(state.live.availableModelIds)),
    [selectedLivePreset, state.live.availableModelIds],
  )
  const selectedLiveModel = useMemo(() => selectedLivePreset.preferredIds[0], [selectedLivePreset])

  const liveCoDesignParse = useMemo(() => {
    const jobDescription = state.live.coDesignDraft.jobDescription.trim()
    const sampleTasks = parseLines(state.live.coDesignDraft.sampleTasksText)
    const rubricBlueprint = parseLines(state.live.coDesignDraft.rubricBlueprintText)
    const agentNotes = parseLines(state.live.coDesignDraft.agentNotesText)
    const parsedDifficulty = parseDifficultyLadder(state.live.coDesignDraft.difficultyLadderText)
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
      errors.push(`Fix ${parsedDifficulty.invalidLineCount} difficulty line(s). Use: Level | Focus | Expectation.`)
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
  }, [state.live.coDesignDraft])
  const liveCoDesignBundle = liveCoDesignParse.bundle
  const liveCoDesignError = liveCoDesignParse.error

  const liveProofState = useMemo<LiveProofState>(() => {
    const hasErrorDiagnostic = state.live.stageDiagnostics.some((item) => item.status === "error")
    const hasSuccess = state.live.previewCaseId !== null || state.live.previewVariants.length > 0
    return {
      status:
        isPreviewPending && state.run.demoMode === "fixture"
          ? "running"
          : hasErrorDiagnostic || (state.run.demoMode === "fixture" && state.run.error?.startsWith("Live proof step failed:"))
            ? "error"
            : hasSuccess
              ? "success"
              : "idle",
      diagnostics: state.live.stageDiagnostics,
      error: state.run.error?.startsWith("Live proof step failed:") ? state.run.error.replace("Live proof step failed: ", "") : null,
      caseId: state.live.previewCaseId,
      taskFamilyId: state.live.previewTaskFamilyId,
      generatedVariantCount: state.live.previewVariants.length || null,
    }
  }, [
    isPreviewPending,
    state.live.previewCaseId,
    state.live.previewTaskFamilyId,
    state.live.previewVariants.length,
    state.live.stageDiagnostics,
    state.run.demoMode,
    state.run.error,
  ])

  useEffect(() => {
    const activeEditor = state.live.activeEditor
    if (!activeEditor) return

    const target =
      activeEditor === "job_description"
        ? jobDescriptionRef.current
        : activeEditor === "sample_tasks"
          ? sampleTasksRef.current
          : activeEditor === "rubric_blueprint"
            ? rubricBlueprintRef.current
            : activeEditor === "difficulty_ladder"
              ? difficultyLadderRef.current
              : agentNotesRef.current

    if (!target) return
    target.focus()
    const end = target.value.length
    target.setSelectionRange(end, end)
  }, [state.live.activeEditor])

  const refreshLiveModelCatalog = useCallback(() => {
    startModelCatalogTransition(async () => {
      const result = await loadLiveModelOptions()
      dispatch({
        type: "patch_live",
        patch: {
          catalogOptions: result.options,
          availableModelIds: result.availableModelIds,
          modelOptionsError: result.error,
        },
      })
    })
  }, [startModelCatalogTransition])

  const handleSelectFixtureMode = useCallback(() => {
    dispatch({ type: "set_demo_mode", demoMode: "fixture" })
  }, [])

  const handleSelectLiveMode = useCallback(() => {
    dispatch({ type: "set_demo_mode", demoMode: "live" })
    refreshLiveModelCatalog()
  }, [refreshLiveModelCatalog])

  const handleTemplateSelect = useCallback(
    (id: string) => {
      if (state.run.phase !== "idle") return
      dispatch({ type: "select_template", templateId: id })
    },
    [state.run.phase],
  )

  const handleRunLiveProof = useCallback(() => {
    if (state.run.demoMode !== "fixture") {
      return
    }

    startPreviewTransition(async () => {
      dispatch({ type: "patch_run", patch: { error: null } })
      dispatch({
        type: "patch_live",
        patch: {
          activeStage: "generate",
          stageDiagnostics: [],
          previewCaseId: null,
          previewTaskFamilyId: null,
          previewVariants: [],
          previewRubric: [],
        },
      })

      try {
        const prepared = await prepareDemoPreview(
          state.run.templateId,
          "live",
          selectedLiveModel,
          selectedLivePreset.reasoningEffort,
          buildFixtureLivePromptBundle(fixture) ?? liveCoDesignBundle,
        )
        dispatch({
          type: "patch_live",
          patch: {
            stageDiagnostics: prepared.diagnostics,
            previewCaseId: prepared.error ? null : prepared.caseId,
            previewTaskFamilyId: prepared.error ? null : prepared.taskFamilyId,
            previewVariants: prepared.error ? [] : prepared.variants,
            previewRubric: prepared.error ? [] : prepared.rubric,
          },
        })
        if (prepared.error) {
          dispatch({ type: "patch_run", patch: { error: `Live proof step failed: ${prepared.error}` } })
          return
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown error"
        dispatch({
          type: "patch_live",
          patch: {
            stageDiagnostics: [
              {
                stage: "generate",
                status: "error",
                latency_ms: 1,
                detail,
                job_id: null,
                request_id: null,
                model: selectedLiveModel,
              },
            ],
          },
        })
        dispatch({ type: "patch_run", patch: { error: `Live proof step failed: ${detail}` } })
      } finally {
        dispatch({ type: "patch_live", patch: { activeStage: null } })
      }
    })
  }, [
    fixture,
    liveCoDesignBundle,
    selectedLiveModel,
    selectedLivePreset.reasoningEffort,
    startPreviewTransition,
    state.run.demoMode,
    state.run.templateId,
  ])

  const handleResetLiveProof = useCallback(() => {
    dispatch({ type: "patch_run", patch: { error: null } })
    dispatch({
      type: "patch_live",
      patch: {
        stageDiagnostics: [],
        activeStage: null,
        previewCaseId: null,
        previewTaskFamilyId: null,
        previewVariants: [],
        previewRubric: [],
      },
    })
  }, [])

  const handleGenerateComplete = useCallback(() => {
    dispatch({ type: "patch_run", patch: { phase: "preview", error: null } })
    dispatch({ type: "patch_filters", patch: { skill: "all", difficulty: "all" } })

    if (state.run.demoMode !== "live") {
      return
    }

    startPreviewTransition(async () => {
      dispatch({ type: "patch_live", patch: { activeStage: "generate" } })
      try {
        const prepared = await prepareDemoPreview(
          state.run.templateId,
          "live",
          selectedLiveModel,
          selectedLivePreset.reasoningEffort,
          liveCoDesignBundle,
        )
        dispatch({
          type: "patch_live",
          patch: {
            stageDiagnostics: prepared.diagnostics,
          },
        })
        if (prepared.error) {
          dispatch({ type: "patch_run", patch: { error: prepared.error, generatedVariantCount: null } })
          dispatch({
            type: "patch_live",
            patch: {
              previewCaseId: null,
              previewTaskFamilyId: null,
              previewVariants: [],
              previewRubric: [],
            },
          })
          return
        }
        dispatch({
          type: "patch_live",
          patch: {
            previewCaseId: prepared.caseId,
            previewTaskFamilyId: prepared.taskFamilyId,
            previewVariants: prepared.variants,
            previewRubric: prepared.rubric,
          },
        })
        dispatch({ type: "patch_run", patch: { generatedVariantCount: prepared.generatedVariantCount } })
      } finally {
        dispatch({ type: "patch_live", patch: { activeStage: null } })
      }
    })
  }, [
    liveCoDesignBundle,
    selectedLiveModel,
    selectedLivePreset.reasoningEffort,
    startPreviewTransition,
    state.run.demoMode,
    state.run.templateId,
  ])

  const handleConfirmAndStart = useCallback(() => {
    dispatch({ type: "patch_run", patch: { phase: "session_ready", error: null } })
    startFastPathTransition(async () => {
      if (state.run.demoMode === "live") {
        dispatch({ type: "patch_live", patch: { activeStage: "create_session" } })
      }
      try {
        const result = await runDemoFastPath(state.run.templateId, {
          mode: state.run.demoMode,
          preparedCaseId: state.run.demoMode === "live" ? state.live.previewCaseId : null,
          preparedTaskFamilyId: state.run.demoMode === "live" ? state.live.previewTaskFamilyId : null,
          preparedVariantCount: state.run.demoMode === "live" ? state.live.previewVariants.length : null,
          previewDiagnostics: state.run.demoMode === "live" ? state.live.stageDiagnostics : null,
          liveModelOverride: state.run.demoMode === "live" ? selectedLiveModel : null,
          liveReasoningEffort: state.run.demoMode === "live" ? selectedLivePreset.reasoningEffort : null,
          liveCoDesignBundle: state.run.demoMode === "live" ? liveCoDesignBundle : null,
        })
        dispatch({ type: "patch_live", patch: { stageDiagnostics: result.diagnostics } })
        if (result.error) {
          dispatch({ type: "patch_run", patch: { error: result.error } })
          return
        }
        dispatch({
          type: "patch_run",
          patch: {
            sessionId: result.sessionId,
            candidateUrl: result.candidateUrl,
            taskFamilyId: result.taskFamilyId,
            generatedVariantCount: result.generatedVariantCount,
          },
        })
      } catch (err) {
        dispatch({ type: "patch_run", patch: { error: err instanceof Error ? err.message : "Fast-path failed" } })
      } finally {
        if (state.run.demoMode === "live") {
          dispatch({ type: "patch_live", patch: { activeStage: null } })
        }
      }
    })
  }, [
    liveCoDesignBundle,
    selectedLiveModel,
    selectedLivePreset.reasoningEffort,
    startFastPathTransition,
    state.live.previewCaseId,
    state.live.previewTaskFamilyId,
    state.live.previewVariants.length,
    state.live.stageDiagnostics,
    state.run.demoMode,
    state.run.templateId,
  ])

  const handleWatchAutoPlay = useCallback(() => {
    if (!sessionId) return
    dispatch({ type: "patch_run", patch: { phase: "playing" } })
  }, [sessionId])

  const handleSkipToReport = useCallback(() => {
    if (!sessionId) return
    dispatch({ type: "patch_run", patch: { error: null } })
    startAutoCompleteTransition(async () => {
      if (state.run.demoMode === "live") {
        dispatch({ type: "patch_live", patch: { activeStage: "score" } })
      }
      try {
        const result = await runDemoAutoComplete(
          sessionId,
          state.run.templateId,
          state.run.demoMode,
          state.run.demoMode === "live" ? selectedLiveModel : null,
          state.run.demoMode === "live" ? selectedLivePreset.reasoningEffort : null,
        )
        dispatch({ type: "append_stage_diagnostics", diagnostics: result.diagnostics })
        if (result.error) {
          dispatch({ type: "patch_run", patch: { error: result.error } })
          return
        }
        dispatch({ type: "patch_run", patch: { phase: "report" } })
        startReportTransition(async () => {
          try {
            const snap = await loadReportDetailSnapshot(sessionId)
            dispatch({ type: "patch_run", patch: { reportSnapshot: snap } })
          } catch (err) {
            dispatch({
              type: "patch_run",
              patch: { error: err instanceof Error ? err.message : "Failed to load report" },
            })
          }
        })
      } catch (err) {
        dispatch({ type: "patch_run", patch: { error: err instanceof Error ? err.message : "Auto-complete failed" } })
      } finally {
        if (state.run.demoMode === "live") {
          dispatch({ type: "patch_live", patch: { activeStage: null } })
        }
      }
    })
  }, [
    selectedLiveModel,
    selectedLivePreset.reasoningEffort,
    startAutoCompleteTransition,
    startReportTransition,
    state.run.demoMode,
    state.run.templateId,
    sessionId,
  ])

  const handleReset = useCallback(() => {
    dispatch({ type: "reset" })
  }, [])

  useEffect(() => {
    if (state.run.phase !== "playing") return
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (typeof event.data !== "object" || event.data === null) return
      if (!("type" in event.data) || !("sessionId" in event.data)) return
      const payload = event.data as { type?: unknown; sessionId?: unknown }
      if (payload.type !== "moonshot.autoplay_complete") return
      if (typeof payload.sessionId !== "string" || payload.sessionId !== sessionId) return
      handleSkipToReport()
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [handleSkipToReport, sessionId, state.run.phase])

  return {
    activeTemplate,
    state,
    dispatch,
    sessionId,
    candidateAutoplayUrl,
    filteredVariants,
    fixture,
    liveProofState,
    liveCoDesignBundle,
    liveCoDesignError,
    liveStageRows,
    previewRubric,
    previewVariantCatalog,
    selectedLiveModel,
    selectedLivePreset,
    selectedLiveResolvedModel,
    uniqueDifficulties,
    uniqueSkills,
    refs: {
      jobDescriptionRef,
      sampleTasksRef,
      rubricBlueprintRef,
      difficultyLadderRef,
      agentNotesRef,
    },
    pending: {
      isAutoCompletePending,
      isFastPathPending,
      isLiveOperationPending,
      isModelCatalogPending,
      isPreviewPending,
      isReportLoading,
    },
    handlers: {
      handleConfirmAndStart,
      handleGenerateComplete,
      handleReset,
      handleResetLiveProof,
      handleRunLiveProof,
      handleSelectFixtureMode,
      handleSelectLiveMode,
      handleSkipToReport,
      handleTemplateSelect,
      handleWatchAutoPlay,
      startDemo: () => dispatch({ type: "patch_run", patch: { phase: "co_design" } }),
      dismissError: () => dispatch({ type: "patch_run", patch: { error: null } }),
      editCoDesignCard: (key: CoDesignEditorKey) => dispatch({ type: "patch_live", patch: { activeEditor: key } }),
      finishCoDesignEdit: () => dispatch({ type: "patch_live", patch: { activeEditor: null } }),
      updateCoDesignDraft: (field: keyof LiveCoDesignDraft, value: string) =>
        dispatch({ type: "set_live_draft_field", field, value }),
      backToIdle: () => dispatch({ type: "patch_run", patch: { phase: "idle" } }),
      continueToGenerate: () => dispatch({ type: "patch_run", patch: { phase: "generating" } }),
      retryPreview: () => dispatch({ type: "patch_run", patch: { phase: "preview" } }),
      setSkillFilter: (value: string) => dispatch({ type: "patch_filters", patch: { skill: value } }),
      setDifficultyFilter: (value: string) => dispatch({ type: "patch_filters", patch: { difficulty: value } }),
      selectPreset: (value: string) => dispatch({ type: "patch_live", patch: { selectedPresetKey: value } }),
    },
  }
}

export function DemoConsole({ snapshot }: { snapshot: PilotSnapshot }) {
  const controller = useDemoConsoleController()
  const {
    activeTemplate,
    state,
    sessionId,
    candidateAutoplayUrl,
    filteredVariants,
    fixture,
    liveProofState,
    liveCoDesignBundle,
    liveCoDesignError,
    liveStageRows,
    previewRubric,
    previewVariantCatalog,
    selectedLiveModel,
    selectedLivePreset,
    selectedLiveResolvedModel,
    uniqueDifficulties,
    uniqueSkills,
    refs,
    pending,
    handlers,
  } = controller

  let phaseContent: ReactNode = null
  if (state.run.phase === "idle") {
    phaseContent = (
      <TemplateSelectionSection
        templateId={state.run.templateId}
        snapshotOk={snapshot.ok}
        startLabel={state.run.templateId === FLAGSHIP_TEMPLATE_ID ? "Start sponsor demo" : "Start second-skin demo"}
        onSelectTemplate={handlers.handleTemplateSelect}
        onStartDemo={handlers.startDemo}
      />
    )
  } else if (state.run.phase === "co_design" && fixture) {
    phaseContent = (
      <CoDesignSection
        demoMode={state.run.demoMode}
        fixture={fixture}
        liveCoDesignBundle={liveCoDesignBundle}
        liveCoDesignDraft={state.live.coDesignDraft}
        activeEditor={state.live.activeEditor}
        liveCoDesignError={liveCoDesignError}
        onEdit={handlers.editCoDesignCard}
        onDoneEditing={handlers.finishCoDesignEdit}
        onDraftChange={handlers.updateCoDesignDraft}
        onBack={handlers.backToIdle}
        onContinue={handlers.continueToGenerate}
        jobDescriptionRef={refs.jobDescriptionRef}
        sampleTasksRef={refs.sampleTasksRef}
        rubricBlueprintRef={refs.rubricBlueprintRef}
        difficultyLadderRef={refs.difficultyLadderRef}
        agentNotesRef={refs.agentNotesRef}
      />
    )
  } else if (state.run.phase === "generating") {
    phaseContent = (
      <div className="rounded-[28px] border border-[#E2E8F0] bg-white p-8">
        <DemoGeneratingAnimation steps={GENERATING_STEPS} onComplete={handlers.handleGenerateComplete} />
      </div>
    )
  } else if (state.run.phase === "preview" && (fixture || state.run.demoMode === "live")) {
    phaseContent = (
      <PreviewSection
        demoMode={state.run.demoMode}
        template={activeTemplate}
        fixture={fixture}
        previewVariantCatalog={previewVariantCatalog}
        filteredVariants={filteredVariants}
        previewRubric={previewRubric}
        uniqueSkills={uniqueSkills}
        uniqueDifficulties={uniqueDifficulties}
        skillFilter={state.filters.skill}
        difficultyFilter={state.filters.difficulty}
        isPreviewPending={pending.isPreviewPending}
        previewCaseId={state.live.previewCaseId}
        previewTaskFamilyId={state.live.previewTaskFamilyId}
        onSkillFilterChange={handlers.setSkillFilter}
        onDifficultyFilterChange={handlers.setDifficultyFilter}
        onConfirmAndStart={handlers.handleConfirmAndStart}
      />
    )
  } else if (state.run.phase === "session_ready") {
    phaseContent = (
      <SessionReadySection
        demoMode={state.run.demoMode}
        fixture={fixture}
        sessionId={sessionId}
        candidateUrl={state.run.candidateUrl}
        taskFamilyId={state.run.taskFamilyId}
        generatedVariantCount={state.run.generatedVariantCount}
        isFastPathPending={pending.isFastPathPending}
        onWatchAutoPlay={handlers.handleWatchAutoPlay}
        onSkipToReport={handlers.handleSkipToReport}
        onRetry={handlers.retryPreview}
      />
    )
  } else if (state.run.phase === "playing" && sessionId) {
    phaseContent = (
      <PlayingSection
        sessionId={sessionId}
        candidateUrl={state.run.candidateUrl}
        candidateAutoplayUrl={candidateAutoplayUrl}
        fixture={fixture}
        isAutoCompletePending={pending.isAutoCompletePending}
        onSkipToReport={handlers.handleSkipToReport}
      />
    )
  } else if (state.run.phase === "report") {
    phaseContent = (
      <ReportPhaseSection
        isReportLoading={pending.isReportLoading}
        reportSnapshot={state.run.reportSnapshot}
        sessionId={sessionId}
        showStrategyTeaser={state.run.templateId === FLAGSHIP_TEMPLATE_ID}
        onReset={handlers.handleReset}
      />
    )
  }

  return (
    <section className="rounded-[36px] border border-[#D7E0E4] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,247,248,0.92))] p-5 shadow-[0_24px_60px_rgba(15,46,61,0.10)] md:p-8">
      <DemoConsoleHeader
        demoMode={state.run.demoMode}
        phase={state.run.phase}
        snapshotOk={snapshot.ok}
        onSelectFixtureMode={handlers.handleSelectFixtureMode}
        onSelectLiveMode={handlers.handleSelectLiveMode}
      />

      <div className="ops-scroll-region mb-6 min-h-11 overflow-x-auto py-2" tabIndex={0} aria-label="Demo phase progress">
        <StepIndicator phase={state.run.phase} />
      </div>

      {state.run.demoMode === "fixture" && state.run.phase !== "idle" ? (
        <LiveProofPanel
          proofState={liveProofState}
          isPending={pending.isPreviewPending}
          modelLabel={selectedLivePreset.label}
          reasoningLabel={selectedLivePreset.reasoningLabel}
          onRun={handlers.handleRunLiveProof}
          onReset={handlers.handleResetLiveProof}
        />
      ) : null}

      {state.run.demoMode === "live" ? (
        <LiveOperatorsPanel
          selectedLiveModel={selectedLiveModel}
          selectedLiveResolvedModel={selectedLiveResolvedModel}
          selectedLivePreset={selectedLivePreset}
          selectedLivePresetKey={state.live.selectedPresetKey}
          liveAvailableModelIds={state.live.availableModelIds}
          liveCatalogOptions={state.live.catalogOptions}
          liveModelOptionsError={state.live.modelOptionsError}
          liveStageRows={liveStageRows}
          isLiveOperationPending={pending.isLiveOperationPending}
          isModelCatalogPending={pending.isModelCatalogPending}
          onSelectPreset={handlers.selectPreset}
        />
      ) : null}

      {state.run.error ? (
        <DemoErrorBanner
          error={state.run.error}
          title={state.run.error.startsWith("Live proof step failed:") ? "Live Proof Step Failed" : "Error"}
          actionLabel={state.run.error.startsWith("Live proof step failed:") ? "Continue flagship fixture path" : undefined}
          onAction={state.run.error.startsWith("Live proof step failed:") ? handlers.dismissError : undefined}
          onDismiss={handlers.dismissError}
        />
      ) : null}

      {state.run.demoMode === "live" && state.live.stageDiagnostics.length > 0 ? (
        <StageDiagnosticsPanel title="Live flow diagnostics" diagnostics={state.live.stageDiagnostics} />
      ) : null}

      {phaseContent}
    </section>
  )
}
