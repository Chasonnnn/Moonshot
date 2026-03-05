"use client"

import { useMemo } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { DimensionScore } from "@/lib/report-analysis"
import { getScoreColor } from "@/lib/report-analysis"

export function DimensionHeatmap({ dimensions }: { dimensions: DimensionScore[] }) {
  if (dimensions.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[#6E6E73]">No dimension data available.</p>
  }

  const sorted = useMemo(
    () => [...dimensions].sort((a, b) => a.score - b.score),
    [dimensions],
  )

  return (
    <ChartContainer
      className="h-[300px] w-full"
      config={{ score: { label: "Score", color: "#0071E3" } }}
    >
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 12, top: 8, bottom: 8 }}>
        <CartesianGrid horizontal={false} stroke="#E5E5EA" />
        <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6E6E73" }} />
        <YAxis
          type="category"
          dataKey="dimension"
          tickLine={false}
          axisLine={false}
          width={120}
          tick={{ fontSize: 11, fill: "#1D1D1F" }}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
          {sorted.map((entry) => (
            <Cell key={entry.dimension} fill={getScoreColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
