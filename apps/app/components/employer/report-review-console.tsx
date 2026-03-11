"use client"

import { useActionState, useState } from "react"

import { updateHumanReviewAction, type ReportDetailSnapshot } from "@/actions/reports"
import {
  ReportIntegrityTab,
  ReportOutputTab,
  ReportOverviewTab,
  ReportProvenanceTab,
} from "@/components/employer/report-review-sections"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { IntegrityTier } from "@/lib/integrity-tiers"
import { INITIAL_REPORT_ACTION_STATE } from "@/lib/report-action-state"

export function ReportReviewConsole({ sessionId, snapshot }: { sessionId: string; snapshot: ReportDetailSnapshot }) {
  const [humanState, humanFormAction, isHumanPending] = useActionState(updateHumanReviewAction, INITIAL_REPORT_ACTION_STATE)
  const [integrityTier, setIntegrityTier] = useState<IntegrityTier>("standard")
  useActionStateToast(humanState)

  if (snapshot.error) {
    return (
      <section className="ops-surface p-6">
        <h2 className="text-[18px] font-semibold text-[var(--ops-text)]">Report View Unavailable</h2>
        <p className="mt-2 text-[13px] text-[var(--ops-text-muted)]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <Tabs defaultValue="overview" className="gap-5">
      <div
        className="ops-scroll-region mb-1 overflow-x-auto pb-3"
        role="region"
        aria-label="Report sections"
        tabIndex={0}
      >
        <TabsList className="min-h-11 w-max rounded-full border border-[var(--ops-border-soft)] bg-[color:color-mix(in_srgb,var(--ops-surface)_88%,white)] p-1 shadow-[var(--ops-shadow-sm)]">
          <TabsTrigger value="overview" className="min-h-11 rounded-full px-4 text-[13px] font-semibold data-active:bg-[var(--ops-text)] data-active:text-white">Overview</TabsTrigger>
          <TabsTrigger value="output" className="min-h-11 rounded-full px-4 text-[13px] font-semibold data-active:bg-[var(--ops-text)] data-active:text-white">Output</TabsTrigger>
          <TabsTrigger value="integrity" className="min-h-11 rounded-full px-4 text-[13px] font-semibold data-active:bg-[var(--ops-text)] data-active:text-white">Integrity</TabsTrigger>
          <TabsTrigger value="provenance" className="min-h-11 rounded-full px-4 text-[13px] font-semibold data-active:bg-[var(--ops-text)] data-active:text-white">Provenance</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <ReportOverviewTab
          sessionId={sessionId}
          snapshot={snapshot}
          humanFormAction={humanFormAction}
          isHumanPending={isHumanPending}
        />
      </TabsContent>

      <TabsContent value="output">
        <ReportOutputTab snapshot={snapshot} />
      </TabsContent>

      <TabsContent value="integrity">
        <ReportIntegrityTab
          snapshot={snapshot}
          integrityTier={integrityTier}
          onIntegrityTierChange={setIntegrityTier}
        />
      </TabsContent>

      <TabsContent value="provenance">
        <ReportProvenanceTab sessionId={sessionId} snapshot={snapshot} />
      </TabsContent>
    </Tabs>
  )
}
