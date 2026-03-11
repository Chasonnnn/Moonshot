"use client"

import type { ReactNode } from "react"

import type { DemoExecutionMode, DemoStageDiagnostic } from "@/actions/pilot"
import type { ReportDetailSnapshot } from "@/actions/reports"
import { getStageDiagnosticKey } from "@/components/employer/demo-stage-diagnostic-key"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DemoCaseTemplate } from "@/lib/moonshot/demo-case-templates"
import type { DemoFixtureData } from "@/lib/moonshot/demo-fixtures"
import type { DemoRunPhase } from "@/lib/moonshot/pilot-flow"
import { cn } from "@/lib/utils"

const PHASE_STEPS: { key: DemoRunPhase; label: string }[] = [
  { key: "idle", label: "Simulation Gallery" },
  { key: "co_design", label: "Co-Design" },
  { key: "generating", label: "Build" },
  { key: "preview", label: "Evaluation Setup" },
  { key: "session_ready", label: "Candidate Work Trace" },
  { key: "report", label: "Evaluation + Governance" },
]

const NARRATIVE_STEPS = [
  {
    key: "co_design",
    label: "Co-design",
    description: "Frame the role, preview variants, and lock the evaluation contract.",
  },
  {
    key: "candidate",
    label: "Candidate work trace",
    description: "Show how the candidate explored, switched tools, and validated assumptions.",
  },
  {
    key: "presentation",
    label: "Presentation & defense",
    description: "Show how the candidate packaged the recommendation and handled spoken follow-up pressure.",
  },
  {
    key: "evaluation",
    label: "Evaluation",
    description: "Surface scoring, trigger rationale, and round-by-round evidence.",
  },
  {
    key: "governance",
    label: "Governance",
    description: "Prove provenance with timeline, audit, fairness, and review signals.",
  },
] as const

export interface LiveProofPanelState {
  status: "idle" | "running" | "success" | "error"
  diagnostics: DemoStageDiagnostic[]
  error: string | null
  caseId: string | null
  taskFamilyId: string | null
  generatedVariantCount: number | null
}

function phaseForStepIndicator(phase: DemoRunPhase): DemoRunPhase {
  if (phase === "playing") return "session_ready"
  return phase
}

function phaseIndex(phase: DemoRunPhase): number {
  const normalized = phaseForStepIndicator(phase)
  const idx = PHASE_STEPS.findIndex((step) => step.key === normalized)
  return idx === -1 ? 0 : idx
}

function countFixtureArtifacts(fixture: DemoFixtureData | null): number {
  if (!fixture) {
    return 0
  }

  return fixture.rounds.reduce((total, round) => {
    const toolActions = Array.isArray(round.toolActions) ? round.toolActions : []
    const mockedArtifacts = Array.isArray(round.mockedArtifacts) ? round.mockedArtifacts : []
    const artifactRefs = toolActions.flatMap((action) => action.artifactRefs ?? [])
    return total + new Set([...mockedArtifacts, ...artifactRefs]).size
  }, 0)
}

function formatStageLabel(stage: DemoStageDiagnostic["stage"]): string {
  return stage.replace(/_/g, " ")
}

export function StepIndicator({ phase }: { phase: DemoRunPhase }) {
  const active = phaseIndex(phase)
  return (
    <div className="flex items-center gap-1">
      {PHASE_STEPS.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div
            className={cn(
              "flex h-7 items-center rounded-full px-3 text-[12px] font-medium transition-colors",
              index < active && "bg-[var(--ops-success-soft)] text-[var(--ops-success)]",
              index === active && "bg-[#0071E3] text-white",
              index > active && "bg-[var(--ops-surface-muted)] text-[var(--ops-text-muted)]",
            )}
          >
            {index < active ? "\u2713 " : ""}
            {step.label}
          </div>
          {index < PHASE_STEPS.length - 1 ? (
            <div className={cn("mx-1 h-px w-4", index < active ? "bg-[var(--ops-success)]" : "bg-[var(--ops-border-strong)]")} />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function NarrativeSequence({ phase }: { phase: DemoRunPhase }) {
  const progress =
    phase === "report"
      ? 5
      : phase === "playing"
        ? 3
        : phase === "session_ready"
          ? 2
          : phase === "co_design" || phase === "generating" || phase === "preview"
            ? 1
            : 0

  return (
    <div className="mb-6 grid gap-3 xl:grid-cols-5">
      {NARRATIVE_STEPS.map((step, index) => {
        const status = index < progress ? "complete" : index === progress ? "active" : "upcoming"
        return (
          <div
            key={step.key}
            className={cn(
              "rounded-[24px] border px-4 py-4 transition-all",
              status === "active" && "border-[#2563EB]/40 bg-[#EFF6FF] shadow-[0_16px_30px_rgba(37,99,235,0.10)]",
              status === "complete" && "border-[#10B981]/25 bg-[#ECFDF5]",
              status === "upcoming" && "border-[#E2E8F0] bg-white/80",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-[11px] font-semibold",
                  status === "active" && "bg-[#2563EB] text-white",
                  status === "complete" && "bg-[#10B981] text-white",
                  status === "upcoming" && "bg-[#E2E8F0] text-[#475569]",
                )}
              >
                {index + 1}
              </span>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--ops-text-muted)]">{step.label}</p>
                <p className="text-[11px] text-[var(--ops-text-muted)]">
                  {status === "complete" ? "Ready to show" : status === "active" ? "Current chapter" : "Coming next"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--ops-text)]">{step.description}</p>
          </div>
        )
      })}
    </div>
  )
}

export function StorySummaryStrip({
  template,
  fixture,
  reportSnapshot,
}: {
  template: DemoCaseTemplate | null
  fixture: DemoFixtureData | null
  reportSnapshot: ReportDetailSnapshot | null
}) {
  if (!template) {
    return null
  }

  const trustRows = reportSnapshot?.governance_trace
    ? [
        `Audit chain: ${reportSnapshot.governance_trace.audit_chain_status}`,
        `Human review: ${reportSnapshot.governance_trace.human_review_status}`,
        `Fairness runs: ${reportSnapshot.governance_trace.fairness_run_count}`,
        `Red-team runs: ${reportSnapshot.governance_trace.redteam_run_count}`,
      ]
    : template.trustHighlights

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr]">
      <div className="rounded-[28px] border border-[#2563EB]/18 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(15,23,42,0.02))] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1D4ED8]">What the candidate was asked to do</p>
        <p className="mt-3 text-[20px] font-semibold leading-tight text-[#0F172A]">{template.heroHeadline}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-[#334155]">{template.candidateAsk}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {template.teaserStats.map((stat) => (
            <span key={stat.label} className="rounded-full border border-[#BFDBFE] bg-white/85 px-3 py-1 text-[11px] font-medium text-[#1E3A8A]">
              {stat.label}: {stat.value}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-[#E2E8F0] bg-white/90 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">What evidence Moonshot captured</p>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#0F172A]">
          {template.evidenceHighlights.slice(0, 4).map((item) => (
            <li key={item} className="rounded-xl bg-[#F8FAFC] px-3 py-2">{item}</li>
          ))}
        </ul>
        {fixture ? (
          <p className="mt-3 text-[12px] text-[#475569]">
            {fixture.rounds.length} rounds, {fixture.variantCatalog.length} variants, {countFixtureArtifacts(fixture)} evidence artifacts.
          </p>
        ) : null}
      </div>

      <div className="rounded-[28px] border border-[#10B981]/16 bg-[linear-gradient(160deg,rgba(16,185,129,0.10),rgba(255,255,255,0.95))] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#047857]">Why the employer can trust the decision</p>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[#0F172A]">
          {trustRows.slice(0, 4).map((item) => (
            <li key={item} className="rounded-xl bg-white/85 px-3 py-2">{item}</li>
          ))}
        </ul>
        {reportSnapshot?.summary?.scoring_version_lock ? (
          <p className="mt-3 text-[12px] text-[#065F46]">
            Scoring lock: {reportSnapshot.summary.scoring_version_lock.scorer_version} / {reportSnapshot.summary.scoring_version_lock.task_family_version}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function LiveProofPanel({
  proofState,
  isPending,
  modelLabel,
  reasoningLabel,
  onRun,
  onReset,
}: {
  proofState: LiveProofPanelState
  isPending: boolean
  modelLabel: string
  reasoningLabel: string
  onRun: () => void
  onReset: () => void
}) {
  return (
    <div className="mb-6 rounded-[28px] border border-[#0F172A]/10 bg-[#0F172A] p-5 text-white shadow-[0_24px_50px_rgba(15,23,42,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#93C5FD]">Live proof step</p>
          <h3 className="mt-2 text-[22px] font-semibold tracking-tight">Run live co-design and generation without changing the fixture-backed main path.</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#CBD5E1]">
            This is the credibility beat for the demo. If the live call fails, Moonshot does not silently switch the audience to a fixture success state.
          </p>
          <p className="mt-3 text-[12px] text-[#94A3B8]">Profile: {modelLabel} · reasoning {reasoningLabel}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={onRun}
            disabled={isPending}
            className="h-11 rounded-full bg-[#2563EB] px-5 text-[13px] font-semibold text-white hover:bg-[#1D4ED8]"
          >
            {isPending ? "Running live proof..." : "Run live co-design/generation proof"}
          </Button>
          {proofState.status !== "idle" ? (
            <Button
              type="button"
              onClick={onReset}
              variant="outline"
              className="h-11 rounded-full border-white/20 bg-transparent px-5 text-[13px] font-semibold text-white hover:bg-white/10"
            >
              Reset proof state
            </Button>
          ) : null}
        </div>
      </div>

      {proofState.status === "success" ? (
        <div className="mt-4 rounded-2xl border border-[#10B981]/30 bg-[#052E2B] px-4 py-3 text-[13px] text-[#D1FAE5]">
          Live proof completed with {proofState.generatedVariantCount ?? "n/a"} generated variants. Case {proofState.caseId ?? "n/a"} and task family {proofState.taskFamilyId ?? "n/a"} are available for inspection while the prepared fixture story remains active.
        </div>
      ) : null}

      {proofState.status === "error" ? (
        <div className="mt-4 rounded-2xl border border-[#F97316]/35 bg-[#431407] px-4 py-3 text-[13px] text-[#FED7AA]">
          Live proof failed: {proofState.error ?? "unknown error"}. Continue the prepared fixture path manually below if you want to keep the demo moving.
        </div>
      ) : null}

      {proofState.diagnostics.length > 0 ? (
        <StageDiagnosticsPanel title="Live proof diagnostics" diagnostics={proofState.diagnostics} tone="dark" />
      ) : null}
    </div>
  )
}

export function DemoErrorBanner({
  error,
  title = "Error",
  actionLabel,
  onAction,
  onDismiss,
}: {
  error: string
  title?: string
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
}) {
  return (
    <div className="mb-6 rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/5 p-4">
      <p className="text-[13px] font-medium text-[#FF3B30]">{title}</p>
      <p className="mt-1 text-[12px] text-[#FF3B30]/80">{error}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {actionLabel && onAction ? (
          <Button
            type="button"
            onClick={onAction}
            size="sm"
            className="h-8 rounded-full bg-[#FF3B30] px-4 text-[12px] font-medium text-white hover:bg-[#D70015]"
          >
            {actionLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={onDismiss}
          variant="link"
          size="xs"
          className="px-0 text-[12px] font-medium text-[#0071E3]"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}

export function StageDiagnosticsPanel({
  diagnostics,
  title = "Stage diagnostics",
  tone = "light",
}: {
  diagnostics: DemoStageDiagnostic[]
  title?: string
  tone?: "light" | "dark"
}) {
  const isDark = tone === "dark"
  const keyedDiagnostics = (() => {
    const seen = new Map<string, number>()
    return diagnostics.map((diagnostic) => {
      const baseKey = getStageDiagnosticKey(diagnostic)
      const occurrence = seen.get(baseKey) ?? 0
      seen.set(baseKey, occurrence + 1)
      return {
        diagnostic,
        key: occurrence === 0 ? baseKey : `${baseKey}:${occurrence}`,
      }
    })
  })()

  return (
    <div
      className={cn(
        "mt-4 rounded-2xl border p-4",
        isDark ? "border-white/10 bg-white/5" : "border-[#E2E8F0] bg-[#F8FAFC]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.22em]",
          isDark ? "text-[#93C5FD]" : "text-[#64748B]",
        )}
      >
        {title}
      </p>
      <div className="mt-3 space-y-3">
        {keyedDiagnostics.map(({ diagnostic, key }) => (
          <div
            key={key}
            className={cn(
              "rounded-2xl border px-4 py-3 text-[12px]",
              isDark ? "border-white/10 bg-[#020617]/70" : "border-[#E2E8F0] bg-white",
            )}
            data-testid="stage-diagnostic"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("font-semibold capitalize", isDark ? "text-white" : "text-[#0F172A]")}>
                {formatStageLabel(diagnostic.stage)}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px]",
                  diagnostic.status === "ok" && "border-[#10B981]/30 bg-[#ECFDF5] text-[#047857]",
                  diagnostic.status === "error" && "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]",
                )}
              >
                {diagnostic.status}
              </Badge>
              <span className={cn("text-[11px]", isDark ? "text-[#94A3B8]" : "text-[#64748B]")}>
                {diagnostic.latency_ms}ms
              </span>
            </div>
            <p className={cn("mt-2 leading-relaxed", isDark ? "text-[#CBD5E1]" : "text-[#334155]")}>
              {diagnostic.detail}
            </p>
            <div className={cn("mt-3 grid gap-2 md:grid-cols-3", isDark ? "text-[#94A3B8]" : "text-[#64748B]")}>
              <p className="font-mono text-[11px]">request_id={diagnostic.request_id ?? "n/a"}</p>
              <p className="font-mono text-[11px]">job_id={diagnostic.job_id ?? "n/a"}</p>
              <p className="font-mono text-[11px]">model={diagnostic.model ?? "n/a"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
