"use client"

import { useId } from "react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface RoundItem {
  round: string
  score: number
  note: string
}

export function RoundPerformanceLine({ rounds }: { rounds: RoundItem[] }) {
  const gradientId = `scoreGradient-${useId().replace(/:/g, "")}`

  if (rounds.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[#6E6E73]">No round data available.</p>
  }

  return (
    <ChartContainer
      className="h-[260px] w-full"
      config={{ score: { label: "Score", color: "#0071E3" } }}
    >
      <AreaChart data={rounds} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0071E3" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#0071E3" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#E5E5EA" />
        <XAxis dataKey="round" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6E6E73" }} />
        <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={36} tick={{ fontSize: 11, fill: "#6E6E73" }} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent />}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#0071E3"
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ fill: "#0071E3", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
