import Link from "next/link"
import { ArrowUpRightIcon } from "lucide-react"

import { loadDashboardSnapshot } from "@/actions/pilot"

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
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-8">
        <div className="w-full max-w-xl rounded-2xl border border-[#FF9F0A] bg-white p-8 text-left shadow-sm">
          <h1 className="text-[22px] font-semibold text-[#1D1D1F]">Dashboard Unavailable</h1>
          <p className="mt-2 text-[14px] text-[#6E6E73]">{snapshot.error}</p>
          <p className="mt-4 text-[12px] text-[#6E6E73]">
            This is an explicit failure state by design so integration issues are visible.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <div className="mx-auto max-w-screen-xl px-8 py-14">
        <div className="mb-14 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[13px] tracking-tight text-[#6E6E73]">Moonshot MVP · Live Tenant View</p>
            <h1 className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">Dashboard</h1>
          </div>
          <Link
            href="/demo"
            className="flex items-center gap-1.5 rounded-full bg-[#0071E3] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#0077ED] active:bg-[#006EDB]"
          >
            Open Demo Console
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#D2D2D7] shadow-sm md:grid-cols-4">
          <div className="bg-white px-6 py-7">
            <div className="mb-2 text-[42px] font-semibold leading-none text-[#1D1D1F]">{snapshot.activeCases}</div>
            <div className="text-[14px] text-[#6E6E73]">Active Cases</div>
          </div>
          <div className="bg-white px-6 py-7">
            <div className="mb-2 text-[42px] font-semibold leading-none text-[#1D1D1F]">{snapshot.awaitingReview}</div>
            <div className="text-[14px] text-[#6E6E73]">Awaiting Review</div>
          </div>
          <div className="bg-white px-6 py-7">
            <div className="mb-2 text-[42px] font-semibold leading-none text-[#34C759]">{formatConfidence(snapshot.meanConfidence)}</div>
            <div className="text-[14px] text-[#6E6E73]">Mean Confidence</div>
          </div>
          <div className="bg-white px-6 py-7">
            <div className="mb-2 text-[42px] font-semibold leading-none text-[#1D1D1F]">{snapshot.inFlightJobs}</div>
            <div className="text-[14px] text-[#6E6E73]">In-Flight Jobs</div>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[22px] font-semibold tracking-tight text-[#1D1D1F]">Recent Sessions</h2>
            <p className="text-[12px] text-[#6E6E73]">Confidence sample size: {snapshot.confidenceSampleSize}</p>
          </div>
          {snapshot.recentSessions.length === 0 ? (
            <p className="text-[13px] text-[#6E6E73]">No sessions available yet for this tenant.</p>
          ) : (
            <div className="space-y-3">
              {snapshot.recentSessions.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E5EA] px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-[#1D1D1F]">{item.id}</p>
                    <p className="text-[12px] text-[#6E6E73]">
                      status={item.status} · confidence={formatConfidence(item.confidence)} · review=
                      {item.needsHumanReview === null ? "n/a" : item.needsHumanReview ? "required" : "clear"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/reports/${item.id}`}
                      className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F]"
                    >
                      Open Report
                    </Link>
                    <Link
                      href={`/session/${item.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F]"
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
    </div>
  )
}
