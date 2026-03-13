"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, ThumbsUp, ThumbsDown, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { useSession, type CoachChatMessage } from "@/components/candidate/session-context"
import type { CoachResponse } from "@/lib/moonshot/types"

export function CoachPanel() {
  const {
    api,
    isSubmitted,
    isExpired,
    isAiDisabled,
    track,
    autoPlay,
    coachMessages,
    pushCoachMessage,
    fixtureData,
    currentRoundIndex,
    totalRounds,
    parts,
    activePart,
  } = useSession()
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [coachMessages, scrollToBottom])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending || isSubmitted || isExpired) return

    const userMsg: CoachChatMessage = { role: "user", content: trimmed }
    pushCoachMessage(userMsg)
    setInput("")
    setIsSending(true)
    track("copilot_invoked", { message_length: trimmed.length })

    if (autoPlay) {
      // In auto-play mode, don't call real API — messages are injected via context
      setIsSending(false)
      return
    }

    try {
      const res: CoachResponse = await api.coachMessage(trimmed)
      const coachMsg: CoachChatMessage = {
        role: "coach",
        content: res.response,
        allowed: res.allowed,
        policyReason: res.policy_reason,
        policyMeta: {
          policy_decision_code: res.policy_decision_code,
          policy_version: res.policy_version,
          policy_hash: res.policy_hash,
          blocked_rule_id: res.blocked_rule_id,
        },
        feedbackGiven: null,
      }
      pushCoachMessage(coachMsg)
    } catch {
      pushCoachMessage({ role: "coach", content: "Failed to get a response. Please try again." })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const giveFeedback = async (index: number, helpful: boolean) => {
    // Update via pushCoachMessage is additive-only, so we track locally
    void index
    try {
      await api.coachFeedback(helpful, [])
    } catch {
      // silent
    }
  }

  const activeStage = parts[activePart] ?? null
  const showStageFlow = parts.length > 0 && fixtureData?.rounds.length === parts.length

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--ops-border,#d7e0e4)] px-3 py-3 md:py-2">
        <h2 className="text-[13px] font-medium text-[var(--ops-text,#1d1d1f)]">Coach</h2>
        {showStageFlow && activeStage ? (
          <p className="mt-0.5 text-[11px] text-[var(--ops-text-muted,#475569)]">
            {activeStage.title} ({activePart + 1} / {parts.length})
          </p>
        ) : fixtureData && totalRounds > 0 ? (
          <p className="mt-0.5 text-[11px] text-[var(--ops-text-muted,#475569)]">
            Round {currentRoundIndex + 1} / {totalRounds}
          </p>
        ) : null}
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {isAiDisabled && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Lock className="h-6 w-6 text-[var(--ops-text-subtle,#64748b)]" />
              <p className="text-[13px] text-[var(--ops-text-subtle,#64748b)]">
                AI assistance is disabled for this assessment
              </p>
            </div>
          )}
          {!isAiDisabled && coachMessages.length === 0 && (
            <p className="text-center text-[12px] text-[var(--ops-text-muted)]">
              Ask the coach for guidance
            </p>
          )}

          {coachMessages.map((msg, i) => (
            <div key={msg.id ?? `${msg.role}-${msg.content}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${
                  msg.role === "user"
                    ? "bg-[#0071E3] text-white"
                    : msg.allowed === false
                      ? "border border-[#FF9F0A] bg-[#FF9F0A]/10 text-[#1D1D1F]"
                      : "border border-[var(--ops-border,#d7e0e4)] bg-white text-[var(--ops-text,#1d1d1f)]"
                }`}
              >
                <p>{msg.content}</p>
                {msg.role === "coach" && msg.allowed === false && msg.policyReason && (
                  <p className="mt-1 text-[11px] text-[var(--ops-text-subtle,#64748b)]">
                    {msg.policyReason}
                  </p>
                )}
                {msg.role === "coach" && msg.feedbackGiven !== undefined && (
                  <div className="mt-1.5 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`size-11 p-0 md:size-6 ${msg.feedbackGiven === "up" ? "text-[#22c55e]" : "text-[var(--ops-text-subtle,#64748b)]"}`}
                      onClick={() => giveFeedback(i, true)}
                      disabled={msg.feedbackGiven !== null}
                      aria-label="Helpful"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`size-11 p-0 md:size-6 ${msg.feedbackGiven === "down" ? "text-[#ef4444]" : "text-[var(--ops-text-subtle,#64748b)]"}`}
                      onClick={() => giveFeedback(i, false)}
                      disabled={msg.feedbackGiven !== null}
                      aria-label="Not useful"
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[var(--ops-border,#d7e0e4)] bg-white px-3 py-2">
                <Spinner className="h-4 w-4" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-[var(--ops-border,#d7e0e4)] p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the coach..."
            disabled={isSubmitted || isExpired || isSending || isAiDisabled}
            className="h-11 rounded-2xl text-[13px] md:h-8"
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={isSubmitted || isExpired || isSending || isAiDisabled || !input.trim()}
            className="size-11 rounded-2xl p-0 bg-[var(--ops-accent,#2563eb)] hover:bg-[var(--ops-accent-strong,#1d4ed8)] md:size-8"
            aria-label="Send"
          >
            {isSending ? (
              <Spinner className="h-3.5 w-3.5 text-white" />
            ) : (
              <Send className="h-3.5 w-3.5 text-white" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
