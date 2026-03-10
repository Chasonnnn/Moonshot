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
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Report View Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <Tabs defaultValue="overview" className="gap-5">
      <TabsList className="mb-4 w-fit rounded-full border border-[#D7E0E4] bg-white/85 p-1 shadow-sm">
        <TabsTrigger value="overview" className="rounded-full px-4 text-[12px] font-semibold data-active:bg-[#0F172A] data-active:text-white">Overview</TabsTrigger>
        <TabsTrigger value="output" className="rounded-full px-4 text-[12px] font-semibold data-active:bg-[#0F172A] data-active:text-white">Output</TabsTrigger>
        <TabsTrigger value="integrity" className="rounded-full px-4 text-[12px] font-semibold data-active:bg-[#0F172A] data-active:text-white">Integrity</TabsTrigger>
        <TabsTrigger value="provenance" className="rounded-full px-4 text-[12px] font-semibold data-active:bg-[#0F172A] data-active:text-white">Provenance</TabsTrigger>
      </TabsList>

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
