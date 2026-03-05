"use client"

import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import type { DimensionScore } from "@/lib/report-analysis"

export function DimensionRadar({
  dimensions,
  alignment,
}: {
  dimensions: DimensionScore[]
  alignment?: DimensionScore[]
}) {
  if (dimensions.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[#6E6E73]">No dimension data available.</p>
  }

  const data = dimensions.map((d) => {
    const alignmentItem = alignment?.find((a) => a.dimension === d.dimension)
    return {
      dimension: d.dimension,
      score: d.score,
      ...(alignmentItem ? { alignment: alignmentItem.score } : {}),
    }
  })

  return (
    <ChartContainer
      className="h-[300px] w-full"
      config={{
        score: { label: "Score", color: "#0071E3" },
        alignment: { label: "Alignment", color: "#34C759" },
      }}
    >
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#E5E5EA" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "#6E6E73" }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#0071E3"
          fill="#0071E3"
          fillOpacity={0.2}
        />
        {alignment && alignment.length > 0 && (
          <Radar
            name="Alignment"
            dataKey="alignment"
            stroke="#34C759"
            fill="#34C759"
            fillOpacity={0.1}
          />
        )}
        {alignment && alignment.length > 0 && <Legend />}
      </RadarChart>
    </ChartContainer>
  )
}
