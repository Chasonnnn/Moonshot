"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, ThumbsUp, ThumbsDown, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/components/candidate/session-context"
import type { CoachResponse } from "@/lib/moonshot/types"

interface ChatMessage {
  role: "user" | "coach"
  content: string
  allowed?: boolean
  policyReason?: string
  policyMeta?: {
    policy_decision_code: string | null
    policy_version: string | null
    policy_hash: string | null
    blocked_rule_id: string | null
  }
  feedbackGiven?: "up" | "down" | null
}

export function CoachPanel() {
  const { api, isSubmitted, isExpired, isAiDisabled, track } = useSession()
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
  }, [messages, scrollToBottom])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending || isSubmitted || isExpired) return

    const userMsg: ChatMessage = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsSending(true)
    track("copilot_invoked", { message_length: trimmed.length })

    try {
      const res: CoachResponse = await api.coachMessage(trimmed)
      const coachMsg: ChatMessage = {
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
      setMessages((prev) => [...prev, coachMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "coach", content: "Failed to get a response. Please try again." },
      ])
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
    setMessages((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, feedbackGiven: helpful ? "up" : "down" } : m
      )
    )
    try {
      await api.coachFeedback(helpful, [])
    } catch {
      // silent
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#D2D2D7] px-3 py-2">
        <h3 className="text-[13px] font-medium text-[#1D1D1F]">Coach</h3>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {isAiDisabled && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Lock className="h-6 w-6 text-[#86868B]" />
              <p className="text-[13px] text-[#86868B]">
                AI assistance is disabled for this assessment
              </p>
            </div>
          )}
          {!isAiDisabled && messages.length === 0 && (
            <p className="text-center text-[12px] text-[#86868B]">
              Ask the coach for guidance
            </p>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] ${
                  msg.role === "user"
                    ? "bg-[#0071E3] text-white"
                    : msg.allowed === false
                      ? "border border-[#FF9F0A] bg-[#FF9F0A]/10 text-[#1D1D1F]"
                      : "border border-[#D2D2D7] bg-white text-[#1D1D1F]"
                }`}
              >
                <p>{msg.content}</p>
                {msg.role === "coach" && msg.allowed === false && msg.policyReason && (
                  <p className="mt-1 text-[11px] text-[#86868B]">
                    {msg.policyReason}
                  </p>
                )}
                {msg.role === "coach" && msg.feedbackGiven !== undefined && (
                  <div className="mt-1.5 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-6 w-6 p-0 ${msg.feedbackGiven === "up" ? "text-[#34C759]" : "text-[#86868B]"}`}
                      onClick={() => giveFeedback(i, true)}
                      disabled={msg.feedbackGiven !== null}
                      aria-label="Helpful"
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-6 w-6 p-0 ${msg.feedbackGiven === "down" ? "text-[#FF3B30]" : "text-[#86868B]"}`}
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
              <div className="rounded-2xl border border-[#D2D2D7] bg-white px-3 py-2">
                <Spinner className="h-4 w-4" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-[#D2D2D7] p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the coach..."
            disabled={isSubmitted || isExpired || isSending || isAiDisabled}
            className="h-8 text-[13px]"
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={isSubmitted || isExpired || isSending || isAiDisabled || !input.trim()}
            className="h-8 w-8 p-0 bg-[#0071E3] hover:bg-[#0077ED]"
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
