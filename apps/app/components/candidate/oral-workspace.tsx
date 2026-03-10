"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useSession } from "@/components/candidate/session-context"
import type { OralClipType, OralPromptConfig } from "@/lib/moonshot/types"

type DraftClip = {
  blob: Blob
  durationMs: number
  mimeType: string
  url: string
}

function getRecordingSupportError(): string | null {
  if (typeof navigator === "undefined") {
    return "Audio recording is only available in a browser session."
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Microphone access is unavailable in this browser."
  }
  if (typeof MediaRecorder === "undefined") {
    return "This browser does not support in-browser audio recording."
  }
  return null
}

function resolveRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm"
  }
  const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
  return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "audio/webm"
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function fallbackHighlights(prompts: OralPromptConfig[], transcripts: Partial<Record<OralClipType, string>>): string[] {
  return prompts
    .map((prompt) => transcripts[prompt.clipType]?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 3)
}

export function OralWorkspace() {
  const {
    api,
    fixtureData,
    isExpired,
    isSubmitted,
    isOralComplete,
    latestOralResponses,
    missingOralClipTypes,
    missingOralPromptLabels,
    oralPrompts,
    oralRequirement,
    oralResponsesError,
    oralResponsesLoaded,
    refreshOralResponses,
    setOralResponsesError,
    track,
  } = useSession()
  const prompts = oralPrompts
  const supportError = useMemo(() => getRecordingSupportError(), [])
  const [drafts, setDrafts] = useState<Partial<Record<OralClipType, DraftClip>>>({})
  const [recordingClipType, setRecordingClipType] = useState<OralClipType | null>(null)
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)
  const [uploadingClipType, setUploadingClipType] = useState<OralClipType | null>(null)
  const draftsRef = useRef<Partial<Record<OralClipType, DraftClip>>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordingStartTimeRef = useRef<number | null>(null)
  const recordingClipTypeRef = useRef<OralClipType | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const recordingTimeoutRef = useRef<number | null>(null)
  const draftChunksRef = useRef<BlobPart[]>([])

  const transcriptHighlights = useMemo(() => {
    if (fixtureData?.oralWorkspace?.transcriptHighlights?.length) {
      return fixtureData.oralWorkspace.transcriptHighlights
    }
    return fallbackHighlights(
      prompts,
      Object.fromEntries(
        Object.entries(latestOralResponses).map(([clipType, response]) => [clipType, response?.transcript_text ?? ""])
      ) as Partial<Record<OralClipType, string>>
    )
  }, [fixtureData?.oralWorkspace?.transcriptHighlights, latestOralResponses, prompts])

  const clearRecordingResources = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    mediaStreamRef.current?.getTracks().forEach((trackItem) => trackItem.stop())
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    recordingStartTimeRef.current = null
    recordingClipTypeRef.current = null
    setRecordingClipType(null)
    setRecordingElapsedMs(0)
  }, [])

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(() => {
    return () => {
      Object.values(draftsRef.current).forEach((draft) => {
        if (draft) {
          URL.revokeObjectURL(draft.url)
        }
      })
      if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      clearRecordingResources()
    }
  }, [clearRecordingResources])

  const discardDraft = useCallback((clipType: OralClipType) => {
    setDrafts((prev) => {
      const existing = prev[clipType]
      if (existing) {
        URL.revokeObjectURL(existing.url)
      }
      const next = { ...prev }
      delete next[clipType]
      return next
    })
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== "inactive") {
      recorder.stop()
      return
    }
    clearRecordingResources()
  }, [clearRecordingResources])

  const startRecording = useCallback(
    async (prompt: OralPromptConfig) => {
      if (isSubmitted || isExpired) {
        return
      }
      if (supportError) {
        setLocalError(supportError)
        return
      }
      if (recordingClipType && recordingClipType !== prompt.clipType) {
        setLocalError("Finish the current recording before starting another clip.")
        return
      }

      setLocalError(null)
      setOralResponsesError(null)

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mimeType = resolveRecorderMimeType()
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)

        draftChunksRef.current = []
        mediaStreamRef.current = stream
        mediaRecorderRef.current = recorder
        recordingStartTimeRef.current = Date.now()
        recordingClipTypeRef.current = prompt.clipType
        setRecordingClipType(prompt.clipType)
        setRecordingElapsedMs(0)

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            draftChunksRef.current.push(event.data)
          }
        }
        recorder.onerror = () => {
          setLocalError("Recording failed before a preview could be created.")
          clearRecordingResources()
        }
        recorder.onstop = () => {
          const clipType = recordingClipTypeRef.current
          const startedAt = recordingStartTimeRef.current
          const durationMs = Math.max(1000, Date.now() - (startedAt ?? Date.now()))

          if (!clipType || draftChunksRef.current.length === 0) {
            setLocalError("No audio was captured. Record the clip again.")
            clearRecordingResources()
            return
          }

          const blob = new Blob(draftChunksRef.current, {
            type: recorder.mimeType || mimeType || "audio/webm",
          })
          const url = URL.createObjectURL(blob)

          setDrafts((prev) => {
            const existing = prev[clipType]
            if (existing) {
              URL.revokeObjectURL(existing.url)
            }
            return {
              ...prev,
              [clipType]: {
                blob,
                durationMs,
                mimeType: recorder.mimeType || mimeType || "audio/webm",
                url,
              },
            }
          })

          track("oral_recording_completed", {
            clip_type: clipType,
            duration_ms: durationMs,
          })
          clearRecordingResources()
        }

        recorder.start()
        track("oral_recording_started", {
          clip_type: prompt.clipType,
          question_id: prompt.questionId ?? null,
        })

        recordingTimerRef.current = window.setInterval(() => {
          setRecordingElapsedMs(Date.now() - (recordingStartTimeRef.current ?? Date.now()))
        }, 250)
        recordingTimeoutRef.current = window.setTimeout(() => {
          stopRecording()
        }, prompt.maxDurationSeconds * 1000)
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Microphone permission is required for oral-defense prompts."
        setLocalError(message)
        track("oral_recording_failed", {
          clip_type: prompt.clipType,
          error_message: message,
        })
        clearRecordingResources()
      }
    },
    [
      clearRecordingResources,
      isExpired,
      isSubmitted,
      recordingClipType,
      setOralResponsesError,
      stopRecording,
      supportError,
      track,
    ]
  )

  const uploadDraft = useCallback(
    async (prompt: OralPromptConfig) => {
      const draft = drafts[prompt.clipType]
      if (!draft) {
        return
      }

      setLocalError(null)
      setOralResponsesError(null)
      setUploadingClipType(prompt.clipType)

      try {
        await api.uploadOralResponse({
          file: draft.blob,
          clipType: prompt.clipType,
          durationMs: draft.durationMs,
          questionId: prompt.questionId ?? null,
          filename: `${prompt.clipType}.webm`,
        })
        track("oral_response_uploaded", {
          clip_type: prompt.clipType,
          question_id: prompt.questionId ?? null,
          duration_ms: draft.durationMs,
        })
        discardDraft(prompt.clipType)
        await refreshOralResponses()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload oral response."
        setLocalError(message)
        track("oral_response_upload_failed", {
          clip_type: prompt.clipType,
          question_id: prompt.questionId ?? null,
          error_message: message,
        })
      } finally {
        setUploadingClipType(null)
      }
    },
    [api, discardDraft, drafts, refreshOralResponses, setOralResponsesError, track]
  )

  if (!oralRequirement.required && prompts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-[#F8FAFC] text-[13px] text-[#64748B]">
        Oral-defense prompts are not required for this simulation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[#F8FAFC]">
      <div className="border-b border-[#E2E8F0] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2563EB]">Presentation &amp; defense</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0F172A]">Recorded oral-defense responses</h3>
            <p className="text-[12px] text-[#475569]">
              {oralRequirement.required ? "Required" : "Optional"} clips: {oralRequirement.requiredClipTypes.join(", ") || "none"}
            </p>
          </div>
          <div
            className={[
              "rounded-full border px-3 py-1 text-[12px]",
              isOralComplete ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#047857]" : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
            ].join(" ")}
          >
            {isOralComplete ? "Complete" : `Missing ${missingOralPromptLabels.length}`}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#64748B]">Weight {Math.round(oralRequirement.weight * 100)}%</p>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!oralResponsesLoaded ? (
          <div className="mb-4 rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-[12px] text-[#1E3A8A]">
            Loading saved oral responses...
          </div>
        ) : null}
        {oralResponsesError ? (
          <div className="mb-4 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[12px] text-[#B91C1C]">
            {oralResponsesError}
          </div>
        ) : null}
        {localError ? (
          <div className="mb-4 rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-[12px] text-[#B91C1C]">
            {localError}
          </div>
        ) : null}

        {transcriptHighlights.length > 0 ? (
          <div className="mb-4 rounded-[24px] border border-[#DBEAFE] bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1D4ED8]">Transcript highlights</p>
            <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#334155]">
              {transcriptHighlights.map((item) => (
                <li key={item} className="rounded-xl bg-[#F8FAFC] px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-4">
          {prompts.map((prompt) => {
            const uploaded = latestOralResponses[prompt.clipType] ?? null
            const draft = drafts[prompt.clipType]
            const isRecording = recordingClipType === prompt.clipType
            const isMissing = missingOralClipTypes.includes(prompt.clipType)

            return (
              <div key={prompt.clipType} className="rounded-[24px] border border-[#D7E0E4] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">{prompt.title}</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#0F172A]">{prompt.prompt}</p>
                    <p className="mt-2 text-[11px] text-[#64748B]">Max duration: {prompt.maxDurationSeconds}s</p>
                  </div>
                  <div
                    className={[
                      "rounded-full border px-3 py-1 text-[11px] font-semibold",
                      uploaded
                        ? "border-[#D1FAE5] bg-[#ECFDF5] text-[#047857]"
                        : isMissing
                          ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
                          : "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569]",
                    ].join(" ")}
                  >
                    {uploaded ? "Uploaded" : isMissing ? "Required" : "Ready"}
                  </div>
                </div>

                {uploaded ? (
                  <div className="mt-4 rounded-2xl border border-[#D1FAE5] bg-[#ECFDF5] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">Transcript</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#166534]">{uploaded.transcript_text}</p>
                    <p className="mt-3 text-[11px] text-[#047857]">
                      {uploaded.transcription_model ?? "n/a"} · request {uploaded.request_id ?? "n/a"} · raw audio {uploaded.audio_retained ? "retained" : "discarded"}
                    </p>
                  </div>
                ) : null}

                {!uploaded ? (
                  <div className="mt-4 space-y-3">
                    {draft ? (
                      <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
                        <audio controls src={draft.url} className="w-full" />
                        <p className="mt-2 text-[12px] text-[#1E3A8A]">
                          Draft duration: {formatDuration(draft.durationMs)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() => uploadDraft(prompt)}
                            disabled={uploadingClipType === prompt.clipType || isSubmitted || isExpired}
                            className="h-9 rounded-full px-4 text-[12px]"
                          >
                            {uploadingClipType === prompt.clipType ? <Spinner className="h-3.5 w-3.5" /> : "Upload take"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => discardDraft(prompt.clipType)}
                            disabled={uploadingClipType === prompt.clipType}
                            className="h-9 rounded-full px-4 text-[12px]"
                          >
                            Discard
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => (isRecording ? stopRecording() : void startRecording(prompt))}
                        disabled={(recordingClipType !== null && !isRecording) || isSubmitted || isExpired || Boolean(supportError)}
                        className="h-9 rounded-full px-4 text-[12px]"
                      >
                        {isRecording ? "Stop recording" : draft ? "Record another take" : "Start recording"}
                      </Button>
                      {isRecording ? (
                        <p className="text-[12px] text-[#2563EB]">Recording {formatDuration(recordingElapsedMs)}</p>
                      ) : null}
                      {supportError ? (
                        <p className="text-[12px] text-[#B91C1C]">{supportError}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
