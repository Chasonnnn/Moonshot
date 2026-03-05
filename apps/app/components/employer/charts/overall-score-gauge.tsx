"use client"

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts"
import { ChartContainer } from "@/components/ui/chart"
import { getScoreTier, getScoreColor } from "@/lib/report-analysis"

export function OverallScoreGauge({ score, confidence }: { score: number; confidence: number | null }) {
  const tier = getScoreTier(score)
  const fill = getScoreColor(score)
  const data = [{ value: score, fill }]

  return (
    <div data-score-tier={tier} className="flex flex-col items-center">
      <ChartContainer
        className="h-[200px] w-[200px]"
        config={{ value: { label: "Score", color: fill } }}
      >
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={180}
          endAngle={0}
          barSize={14}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={7}
            background={{ fill: "#F0F0F2" }}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ChartContainer>
      <div className="-mt-16 text-center">
        <p className="text-[32px] font-bold text-[#1D1D1F]">{score}</p>
        <p className="text-[12px] text-[#6E6E73]">
          {confidence !== null ? `${Math.round(confidence * 100)}% confidence` : "n/a confidence"}
        </p>
      </div>
    </div>
  )
}
