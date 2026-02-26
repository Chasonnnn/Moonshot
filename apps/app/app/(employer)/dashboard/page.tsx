import { TriangleAlertIcon, ArrowUpRightIcon, PlusIcon, Loader2Icon } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Job running banner */}
      <div className="bg-[#0071E3] px-8 py-2.5 flex items-center gap-2.5 text-[13px] text-white">
        <Loader2Icon className="size-3.5 shrink-0 animate-spin opacity-80" />
        <span>
          Job #4812 is generating task family variants — you can navigate away safely.
        </span>
      </div>

      {/* Page content */}
      <div className="max-w-screen-lg mx-auto px-8 py-14">

        {/* Page header */}
        <div className="flex items-end justify-between mb-14">
          <div>
            <p className="text-[13px] text-[#6E6E73] mb-1.5 tracking-tight">
              Acme Corp · Thu 26 Feb 2026
            </p>
            <h1 className="text-[40px] font-semibold text-[#1D1D1F] leading-none tracking-tight">
              Dashboard
            </h1>
          </div>
          <button className="flex items-center gap-1.5 bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#006EDB] text-white text-[13px] font-medium px-4 py-2 rounded-full transition-colors">
            <PlusIcon className="size-3.5" />
            New Case
          </button>
        </div>

        {/* Stats — large numbers, no card borders */}
        <div className="grid grid-cols-3 gap-px bg-[#D2D2D7] rounded-2xl overflow-hidden mb-8 shadow-sm">
          <div className="bg-white px-8 py-7">
            <div className="text-[52px] font-semibold text-[#1D1D1F] leading-none mb-2">
              2
            </div>
            <div className="text-[15px] text-[#6E6E73]">Active Cases</div>
          </div>
          <div className="bg-white px-8 py-7">
            <div className="text-[52px] font-semibold text-[#1D1D1F] leading-none mb-2">
              1
            </div>
            <div className="text-[15px] text-[#6E6E73]">Awaiting Review</div>
          </div>
          <div className="bg-white px-8 py-7">
            <div className="text-[52px] font-semibold text-[#34C759] leading-none mb-2">
              87%
            </div>
            <div className="text-[15px] text-[#6E6E73]">Scoring Agreement</div>
          </div>
        </div>

        {/* Active Pilots */}
        <section className="mb-6">
          <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-4 tracking-tight">
            Active Pilots
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-8 py-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-[17px] font-medium text-[#1D1D1F]">
                      Customer Support Cohort A
                    </span>
                    <span className="text-[11px] font-medium text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full">
                      In Progress
                    </span>
                  </div>
                  <p className="text-[13px] text-[#6E6E73] mb-5">
                    Role: Customer Support · 3 task variants · Started Feb 12
                  </p>
                  {/* Progress */}
                  <div className="flex items-center justify-between text-[12px] text-[#6E6E73] mb-2">
                    <span>Scoring progress</span>
                    <span>12 / 30 scored</span>
                  </div>
                  <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                    <div className="h-full w-[40%] bg-[#0071E3] rounded-full" />
                  </div>
                </div>
                <button className="flex items-center gap-1 text-[#0071E3] text-[13px] font-medium hover:underline underline-offset-2 shrink-0 mt-1">
                  Open Report
                  <ArrowUpRightIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Red-team alert */}
        <div className="bg-white rounded-2xl shadow-sm px-8 py-6 mb-10 flex items-start gap-4">
          <div className="mt-0.5 size-8 rounded-full bg-[#FF9F0A]/10 flex items-center justify-center shrink-0">
            <TriangleAlertIcon className="size-4 text-[#FF9F0A]" />
          </div>
          <div>
            <div className="text-[15px] font-medium text-[#1D1D1F] mb-0.5">
              Red-team findings require review
            </div>
            <div className="text-[13px] text-[#6E6E73]">
              3 findings are pending before &ldquo;Customer Support v1&rdquo; can be published.
            </div>
          </div>
          <span
            className="ml-auto shrink-0 size-5 rounded-full border border-[#D2D2D7] text-[#6E6E73] text-[10px] font-medium flex items-center justify-center cursor-help self-center"
            title="Whether red-team review gates publish is not yet decided"
          >
            ?
          </span>
        </div>

        {/* Undecided features footer */}
        <div className="flex flex-wrap gap-6 text-[12px] text-[#6E6E73]">
          {[
            { label: "AI copilot allowed", tip: "Policy not yet finalized" },
            { label: "Time limit", tip: "Per-task time limits not yet decided" },
            { label: "Tableau export", tip: "Integration under consideration" },
          ].map(({ label, tip }) => (
            <span key={label} className="flex items-center gap-1.5">
              {label}
              <span
                className="size-4 rounded-full border border-[#D2D2D7] text-[9px] font-semibold flex items-center justify-center cursor-help text-[#6E6E73]"
                title={tip}
              >
                ?
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
