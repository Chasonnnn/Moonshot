import Link from "next/link"
import { ArrowUpRightIcon, InboxIcon } from "lucide-react"

import { loadDashboardSnapshot } from "@/actions/pilot"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"

export const dynamic = "force-dynamic"

function formatConfidence(value: number | null): string {
  if (value === null) {
    return "n/a"
  }
  return `${Math.round(value * 100)}%`
}

export default async function DashboardPage() {
  const snapshot = await loadDashboardSnapshot()

  if (snapshot.error) {
    return (
      <div className="ops-page-wrap flex min-h-[70vh] items-center justify-center">
        <div className="ops-surface w-full max-w-xl p-8 text-left">
          <h1 className="text-[22px] font-semibold text-[var(--ops-text)]">Dashboard Unavailable</h1>
          <p className="mt-2 text-[14px] text-[var(--ops-text-muted)]">{snapshot.error}</p>
          <p className="mt-4 text-[12px] text-[var(--ops-text-subtle)]">
            This is an explicit failure state by design so integration issues are visible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="ops-page-wrap">
      <div className="ops-page-header mb-8">
        <div>
          <p className="ops-eyebrow">Moonshot MVP · Live Tenant View</p>
          <h1 className="ops-page-title">Dashboard</h1>
        </div>
        <Link
          href="/demo"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ops-accent)] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--ops-accent)_84%,black)]"
        >
          Open Demo Console
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <div className="ops-surface px-6 py-6">
          <div className="mb-2 text-[40px] font-semibold leading-none text-[var(--ops-text)]">{snapshot.activeCases}</div>
          <div className="text-[14px] text-[var(--ops-text-subtle)]">Active Cases</div>
        </div>
        <div className="ops-surface px-6 py-6">
          <div className="mb-2 text-[40px] font-semibold leading-none text-[var(--ops-text)]">{snapshot.awaitingReview}</div>
          <div className="text-[14px] text-[var(--ops-text-subtle)]">Awaiting Review</div>
        </div>
        <div className="ops-surface px-6 py-6">
          <div className="mb-2 text-[40px] font-semibold leading-none text-[var(--ops-success)]">{formatConfidence(snapshot.meanConfidence)}</div>
          <div className="text-[14px] text-[var(--ops-text-subtle)]">Mean Confidence</div>
        </div>
        <div className="ops-surface px-6 py-6">
          <div className="mb-2 text-[40px] font-semibold leading-none text-[var(--ops-text)]">{snapshot.inFlightJobs}</div>
          <div className="text-[14px] text-[var(--ops-text-subtle)]">In-Flight Jobs</div>
        </div>
      </div>

      {(() => {
        const totalSessions = snapshot.recentSessions.length
        const scored = snapshot.recentSessions.filter((s) => s.confidence !== null).length
        const reviewed = snapshot.recentSessions.filter((s) => s.needsHumanReview !== null).length
        const clear = snapshot.recentSessions.filter((s) => s.needsHumanReview === false).length
        const stages = [
          { label: "Sessions", count: totalSessions },
          { label: "Scored", count: scored },
          { label: "Reviewed", count: reviewed },
          { label: "Clear", count: clear },
        ]
        return (
          <div className="mb-8 flex flex-wrap gap-2">
            {stages.map((stage) => (
              <div
                key={stage.label}
                className={[
                  "ops-pill",
                  stage.count > 0 ? "ops-pill-accent" : "ops-pill-muted",
                ].join(" ")}
              >
                <span>{stage.label}</span>
                <span className="font-semibold">{stage.count}</span>
              </div>
            ))}
          </div>
        )
      })()}

      <section className="ops-surface p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--ops-text)]">Recent Sessions</h2>
          <p className="text-[12px] text-[var(--ops-text-subtle)]">Confidence sample size: {snapshot.confidenceSampleSize}</p>
        </div>
        {snapshot.recentSessions.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>No sessions yet</EmptyTitle>
              <EmptyDescription>Sessions will appear here once candidates begin assessments.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {snapshot.recentSessions.map((item) => (
              <div key={item.id} className="ops-surface-soft flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div>
                  <p className="text-[13px] font-medium text-[var(--ops-text)]">
                    Session <code className="font-mono text-[12px]">{item.id.slice(0, 8)}</code>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant={item.status === "completed" ? "secondary" : "outline"} className="text-[11px]">
                      {item.status}
                    </Badge>
                    <span className="text-[12px] text-[var(--ops-text-subtle)]">
                      Confidence: {formatConfidence(item.confidence)}
                    </span>
                    {item.needsHumanReview !== null && (
                      <Badge
                        variant="outline"
                        className={item.needsHumanReview
                          ? "border-[var(--ops-warning)]/25 bg-[var(--ops-warning-soft)] text-[11px] text-[var(--ops-warning)]"
                          : "text-[11px]"}
                      >
                        {item.needsHumanReview ? "Review required" : "Clear"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/reports/${item.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--ops-border-strong)] bg-white px-4 py-2 text-[12px] font-medium text-[var(--ops-text)] transition-colors hover:bg-[var(--ops-surface-muted)]"
                  >
                    Open Report
                  </Link>
                  <Link
                    href={`/session/${item.id}/start`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-full border border-[var(--ops-border-strong)] bg-white px-4 py-2 text-[12px] font-medium text-[var(--ops-text)] transition-colors hover:bg-[var(--ops-surface-muted)]"
                  >
                    Open Candidate Session
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
