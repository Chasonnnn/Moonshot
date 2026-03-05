"use client"

import { TrendingUpIcon, TrendingDownIcon, MinusIcon, ShieldAlertIcon, TargetIcon, AlertTriangleIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { SmartSummary, HiringSuggestion, ConfidenceLevel, Trend } from "@/lib/report-analysis"

const HIRING_BADGES: Record<HiringSuggestion, { label: string; className: string }> = {
  "strong-hire": { label: "Strong Hire", className: "border-[#34C759]/40 bg-[#34C759]/10 text-[#0D8A2A]" },
  "lean-hire": { label: "Lean Hire", className: "border-[#0071E3]/40 bg-[#0071E3]/10 text-[#0071E3]" },
  "lean-no": { label: "Lean No", className: "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#A05A00]" },
  "no-hire": { label: "No Hire", className: "border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]" },
}

const CONFIDENCE_BADGES: Record<ConfidenceLevel, { label: string; className: string }> = {
  high: { label: "High Confidence", className: "border-[#34C759]/40 bg-[#34C759]/10 text-[#0D8A2A]" },
  medium: { label: "Medium Confidence", className: "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#A05A00]" },
  low: { label: "Low Confidence", className: "border-[#FF3B30]/40 bg-[#FF3B30]/10 text-[#FF3B30]" },
}

const TREND_ICONS: Record<Trend, React.ReactNode> = {
  improving: <TrendingUpIcon className="size-4 text-[#34C759]" />,
  declining: <TrendingDownIcon className="size-4 text-[#FF3B30]" />,
  steady: <MinusIcon className="size-4 text-[#6E6E73]" />,
}

const TREND_LABELS: Record<Trend, string> = {
  improving: "Improving across rounds",
  declining: "Declining across rounds",
  steady: "Steady performance",
}

export function SmartSummaryCard({ summary }: { summary: SmartSummary }) {
  const hiringBadge = HIRING_BADGES[summary.hiringSuggestion]
  const confidenceBadge = CONFIDENCE_BADGES[summary.confidenceLevel]

  return (
    <div className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Smart Summary</h2>
        <Badge variant="outline" className={`text-[11px] ${hiringBadge.className}`}>{hiringBadge.label}</Badge>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-[11px] ${confidenceBadge.className}`}>{confidenceBadge.label}</Badge>
          <div className="flex items-center gap-1.5">
            {TREND_ICONS[summary.trend]}
            <span className="text-[12px] text-[#6E6E73]">{TREND_LABELS[summary.trend]}</span>
          </div>
        </div>

        {summary.strengths.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <TargetIcon className="size-4 text-[#34C759]" />
              <p className="text-[12px] font-semibold text-[#1D1D1F]">Strengths</p>
            </div>
            <ul className="space-y-1 pl-6">
              {summary.strengths.map((s) => (
                <li key={s.dimension} className="text-[12px] text-[#1D1D1F]">
                  <span className="font-medium">{s.dimension}</span>
                  <span className="ml-1 text-[#6E6E73]">({s.score}/100)</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.weaknesses.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <AlertTriangleIcon className="size-4 text-[#FF9F0A]" />
              <p className="text-[12px] font-semibold text-[#1D1D1F]">Growth Areas</p>
            </div>
            <ul className="space-y-1 pl-6">
              {summary.weaknesses.map((w) => (
                <li key={w.dimension} className="text-[12px] text-[#1D1D1F]">
                  <span className="font-medium">{w.dimension}</span>
                  <span className="ml-1 text-[#6E6E73]">({w.score}/100)</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.triggerSummary.count > 0 && (
          <div className="flex items-center gap-1.5">
            <ShieldAlertIcon className="size-4 text-[#FF9F0A]" />
            <span className="text-[12px] text-[#1D1D1F]">
              {summary.triggerSummary.count} trigger{summary.triggerSummary.count !== 1 ? "s" : ""} detected
            </span>
            <div className="flex gap-1">
              {summary.triggerSummary.codes.map((code) => (
                <Badge key={code} variant="outline" className="font-mono text-[10px]">{code}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
