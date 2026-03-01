"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSession } from "@/components/candidate/session-context"

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export function SessionHeader({ onSubmit }: { onSubmit: () => void }) {
  const { isSubmitted, remainingSeconds, isExpired } = useSession()

  return (
    <>
      <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-[#D2D2D7] bg-white/82 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[#1D1D1F]">
            M
          </span>
          <span className="text-[13px] text-[#86868B]">Moonshot</span>
        </div>

        <div className="flex items-center gap-3">
          {isSubmitted ? (
            <Badge className="bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20">
              Submitted
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[#86868B]">
              Active
            </Badge>
          )}

          {remainingSeconds !== null && (
            <span
              className={`font-mono text-[13px] tabular-nums ${
                remainingSeconds <= 300
                  ? "text-[#FF9F0A] font-medium"
                  : "text-[#86868B]"
              }`}
            >
              {formatTime(remainingSeconds)}
            </span>
          )}
        </div>

        <div>
          {isSubmitted ? (
            <Badge className="bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20">
              Submitted
            </Badge>
          ) : (
            <Button
              onClick={onSubmit}
              className="h-8 rounded-full bg-[#0071E3] px-4 text-[13px] text-white hover:bg-[#0077ED]"
            >
              Submit
            </Button>
          )}
        </div>
      </header>

      {isExpired && !isSubmitted && (
        <div className="border-b border-[#FF9F0A] bg-[#FF9F0A]/10 px-4 py-2 text-center text-[13px] text-[#FF9F0A]">
          Time has expired. Please submit your response.
        </div>
      )}
    </>
  )
}
