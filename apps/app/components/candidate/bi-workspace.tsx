"use client"

import { useSession } from "@/components/candidate/session-context"

export function BIWorkspace() {
  const { fixtureData } = useSession()
  const board = fixtureData?.biWorkspace ?? {
    boardTitle: "Simulation BI board",
    filters: fixtureData?.rounds.flatMap((round) => round.dashboardActions).slice(0, 3) ?? [],
    kpis:
      fixtureData?.rounds
        .flatMap((round) => round.toolActions ?? [])
        .filter((action) => action.tool === "bi")
        .slice(0, 3)
        .map((action, index) => ({
          label: action.label,
          value: `View ${index + 1}`,
          delta: action.detail ?? "Investigate the metric movement and annotate the takeaway.",
        })) ?? [],
    charts:
      fixtureData?.rounds
        .flatMap((round) => round.toolActions ?? [])
        .filter((action) => action.tool === "bi")
        .map((action) => ({
          title: action.label,
          type: "bar" as const,
          insight: action.detail ?? "Review the dashboard and capture the operational insight.",
        })) ?? [],
    annotations:
      fixtureData?.rounds
        .flatMap((round) => round.toolActions ?? [])
        .filter((action) => action.tool === "bi")
        .map((action) => action.action ?? action.detail ?? action.label) ?? [],
  }

  if (!fixtureData?.biWorkspace && board.kpis.length === 0 && board.charts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        BI view is not configured for this simulation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <div className="border-b border-[#E2E8F0] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10B981]">BI board</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0F172A]">{board.boardTitle}</h3>
            <p className="text-[12px] text-[#475569]">Filters: {board.filters.join(" · ")}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {board.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border border-[#D1FAE5] bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">{kpi.label}</p>
              <p className="mt-2 text-[24px] font-semibold text-[#0F172A]">{kpi.value}</p>
              <p className="mt-1 text-[12px] text-[#475569]">{kpi.delta}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {board.charts.map((chart) => (
            <div key={chart.title} className="rounded-[24px] border border-[#D7E0E4] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-[#0F172A]">{chart.title}</p>
                <span className="rounded-full border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-[11px] text-[#475569]">
                  {chart.type}
                </span>
              </div>
              <div className="mt-4 h-40 rounded-2xl bg-[linear-gradient(180deg,#F8FAFC,#E2E8F0)]" />
              <p className="mt-3 text-[12px] leading-relaxed text-[#334155]">{chart.insight}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[24px] border border-[#D7E0E4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Analyst annotations</p>
          <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#334155]">
            {board.annotations.map((annotation) => (
              <li key={annotation} className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                {annotation}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
