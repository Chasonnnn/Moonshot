"use client"

import { useState } from "react"
import { useSession } from "@/components/candidate/session-context"

export function SlidesWorkspace() {
  const { fixtureData } = useSession()
  const deck = fixtureData?.slidesWorkspace ?? {
    deckTitle: "Simulation readout",
    slides:
      fixtureData?.rounds
        .flatMap((round) => round.toolActions ?? [])
        .filter((action) => action.tool === "slides")
        .map((action) => ({
          title: action.label,
          bullets: [
            action.detail ?? "Summarize the key insight from this round.",
            action.action ?? "Translate the analysis into a stakeholder-ready recommendation.",
            `Artifacts: ${(action.artifactRefs ?? []).join(", ") || "n/a"}`,
          ],
          speakerNotes: action.prompt ?? action.detail ?? "Explain the recommendation and the main trade-off.",
        })) ?? [],
  }
  const [activeSlide, setActiveSlide] = useState(0)

  if (deck.slides.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        Slides view is not configured for this simulation.
      </div>
    )
  }

  const slide = deck.slides[Math.min(activeSlide, deck.slides.length - 1)]

  return (
    <div className="grid h-full bg-[#F8FAFC] lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-r border-[#E2E8F0] bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Slides</p>
        <h3 className="mt-2 text-[15px] font-semibold text-[#0F172A]">{deck.deckTitle}</h3>
        <div className="mt-4 space-y-2">
          {deck.slides.map((item, index) => (
            <button
              key={`${item.title}-${index}`}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={[
                "w-full rounded-2xl border px-3 py-3 text-left text-[12px]",
                index === activeSlide
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]",
              ].join(" ")}
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Slide {index + 1}</div>
              <div className="mt-1 font-semibold">{item.title}</div>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex flex-col overflow-auto p-6">
        <div className="rounded-[32px] border border-[#D7E0E4] bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Current slide</p>
          <h2 className="mt-3 text-[28px] font-semibold tracking-tight text-[#0F172A]">{slide.title}</h2>
          <ul className="mt-6 space-y-3 text-[15px] leading-relaxed text-[#334155]">
            {slide.bullets.map((bullet) => (
              <li key={bullet} className="rounded-2xl bg-[#F8FAFC] px-4 py-3">
                {bullet}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 rounded-[24px] border border-[#D7E0E4] bg-white p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">Speaker notes</p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#334155]">{slide.speakerNotes}</p>
        </div>
      </div>
    </div>
  )
}
