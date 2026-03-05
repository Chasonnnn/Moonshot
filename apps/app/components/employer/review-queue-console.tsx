"use client"

import { useActionState, useState, useRef } from "react"
import { ClipboardCheckIcon } from "lucide-react"

import {
  resolveReviewQueueAction,
  type ReviewQueueActionState,
  type ReviewQueueSnapshot,
} from "@/actions/review-queue"
import { useActionStateToast } from "@/components/employer/action-state-toast"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialReviewQueueActionState: ReviewQueueActionState = {
  ok: false,
  message: "",
  error: null,
  requestId: null,
}

export function ReviewQueueConsole({ snapshot }: { snapshot: ReviewQueueSnapshot }) {
  const [state, formAction, isPending] = useActionState(resolveReviewQueueAction, initialReviewQueueActionState)
  useActionStateToast(state)

  if (snapshot.error) {
    return (
      <section className="rounded-2xl border border-[#FF9F0A] bg-white p-6 shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Review Queue Unavailable</h2>
        <p className="mt-2 text-[13px] text-[#6E6E73]">{snapshot.error}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
      <h2 className="text-[18px] font-semibold text-[#1D1D1F]">Open Review Items</h2>
      <div className="mt-4 space-y-3">
        {snapshot.items.map((item) => (
          <div key={item.session_id} className="rounded-xl border border-[#E5E5EA] px-4 py-3">
            <p className="text-[13px] font-medium text-[#1D1D1F]">
              Session <code className="font-mono text-[12px]">{item.session_id.slice(0, 8)}</code>
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">{item.status}</Badge>
              <span className="text-[12px] text-[#6E6E73]">Reason: {item.reason}</span>
              <span className="text-[12px] text-[#6E6E73]">Created by: {item.created_by}</span>
            </div>
            <ResolveForm
              sessionId={item.session_id}
              formAction={formAction}
              isPending={isPending}
            />
          </div>
        ))}
        {snapshot.items.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon"><ClipboardCheckIcon /></EmptyMedia>
              <EmptyTitle>Queue is clear</EmptyTitle>
              <EmptyDescription>No items require review at this time.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
      </div>
    </section>
  )
}

function ResolveForm({
  sessionId,
  formAction,
  isPending,
}: {
  sessionId: string
  formAction: (payload: FormData) => void
  isPending: boolean
}) {
  const [decision, setDecision] = useState("approved")
  const [note, setNote] = useState("")
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form ref={formRef} action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="decision" value={decision} />
      <Select
        value={decision}
        onValueChange={(value) => {
          if (value) setDecision(value)
        }}
      >
        <SelectTrigger aria-label="Decision" className="h-8 min-w-[130px] rounded-lg px-2 text-[12px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>
      <Input
        name="reviewer_note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reviewer note"
        className="h-8 max-w-[220px] rounded-lg text-[12px]"
      />
      <AlertDialog>
        <AlertDialogTrigger
          disabled={isPending}
          render={<Button size="sm" className="text-[12px]" />}
        >
          {isPending ? "Resolving..." : "Resolve"}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Resolution</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the review item as <strong>{decision}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => formRef.current?.requestSubmit()}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
