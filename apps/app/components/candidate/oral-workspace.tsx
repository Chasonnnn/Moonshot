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
      <div className="flex h-full items-center justify-center bg-[var(--ops-surface-muted)] text-[13px] text-[var(--ops-text-subtle)]">
        Oral-defense prompts are not required for this simulation.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--ops-surface-muted)]">
      <div className="border-b border-[var(--ops-border)] bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--ops-text)]">Oral defense</h3>
            <p className="text-[12px] text-[var(--ops-text-muted)]">
              {oralRequirement.required ? "Required" : "Optional"} · {oralRequirement.requiredClipTypes.join(", ") || "no required clips"}
            </p>
          </div>
          <div
            className={[
              "rounded-full border px-3 py-1 text-[12px]",
              isOralComplete ? "border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)]" : "border-[var(--ops-warning)]/30 bg-[var(--ops-warning-soft)] text-[var(--ops-warning)]",
            ].join(" ")}
          >
            {isOralComplete ? "Complete" : `Missing ${missingOralPromptLabels.length}`}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!oralResponsesLoaded ? (
          <div className="mb-4 rounded-2xl border border-[var(--ops-accent-soft)] bg-[var(--ops-accent-soft)]/40 px-4 py-3 text-[12px] text-[var(--ops-accent-strong)]">
            Loading saved oral responses...
          </div>
        ) : null}
        {oralResponsesError ? (
          <div className="mb-4 rounded-2xl border border-[var(--ops-danger)]/30 bg-[var(--ops-danger-soft)] px-4 py-3 text-[12px] text-[var(--ops-danger)]">
            {oralResponsesError}
          </div>
        ) : null}
        {localError ? (
          <div className="mb-4 rounded-2xl border border-[var(--ops-danger)]/30 bg-[var(--ops-danger-soft)] px-4 py-3 text-[12px] text-[var(--ops-danger)]">
            {localError}
          </div>
        ) : null}


        <div className="space-y-4">
          {prompts.map((prompt) => {
            const uploaded = latestOralResponses[prompt.clipType] ?? null
            const draft = drafts[prompt.clipType]
            const isRecording = recordingClipType === prompt.clipType
            const isMissing = missingOralClipTypes.includes(prompt.clipType)

            return (
              <div key={prompt.clipType} className="rounded-2xl border border-[var(--ops-border)] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-[13px] font-semibold text-[var(--ops-text)]">{prompt.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--ops-text-muted)]">{prompt.prompt}</p>
                    <p className="mt-1 text-[11px] text-[var(--ops-text-subtle)]">Max {prompt.maxDurationSeconds}s</p>
                  </div>
                  <div
                    className={[
                      "rounded-full border px-3 py-1 text-[11px] font-semibold",
                      uploaded
                        ? "border-[var(--ops-success)]/30 bg-[var(--ops-success-soft)] text-[var(--ops-success)]"
                        : isMissing
                          ? "border-[var(--ops-warning)]/30 bg-[var(--ops-warning-soft)] text-[var(--ops-warning)]"
                          : "border-[var(--ops-border-strong)] bg-[var(--ops-surface-muted)] text-[var(--ops-text-muted)]",
                    ].join(" ")}
                  >
                    {uploaded ? "Uploaded" : isMissing ? "Required" : "Ready"}
                  </div>
                </div>

                {uploaded ? (
                  <div className="mt-4 border-t border-[var(--ops-border)] pt-4">
                    <p className="text-[13px] leading-relaxed text-[var(--ops-text)]">{uploaded.transcript_text}</p>
                    <p className="mt-2 text-[11px] text-[var(--ops-text-subtle)]">
                      {uploaded.transcription_model ?? "n/a"} · {uploaded.audio_retained ? "audio retained" : "audio discarded"}
                    </p>
                  </div>
                ) : null}

                {!uploaded ? (
                  <div className="mt-4 space-y-3">
                    {draft ? (
                      <>
                        <audio controls src={draft.url} className="w-full" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => uploadDraft(prompt)}
                            disabled={uploadingClipType === prompt.clipType || isSubmitted || isExpired}
                            className="h-10 rounded-full px-4 text-[13px] md:h-9 md:text-[12px]"
                          >
                            {uploadingClipType === prompt.clipType ? <Spinner className="h-3.5 w-3.5" /> : "Upload take"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => discardDraft(prompt.clipType)}
                            disabled={uploadingClipType === prompt.clipType}
                            className="h-10 rounded-full px-4 text-[13px] md:h-9 md:text-[12px]"
                          >
                            Discard
                          </Button>
                          <span className="text-[11px] text-[var(--ops-text-subtle)]">{formatDuration(draft.durationMs)}</span>
                        </div>
                      </>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => (isRecording ? stopRecording() : void startRecording(prompt))}
                        disabled={(recordingClipType !== null && !isRecording) || isSubmitted || isExpired || Boolean(supportError)}
                        className="h-10 rounded-full px-4 text-[13px] md:h-9 md:text-[12px]"
                      >
                        {isRecording ? "Stop recording" : draft ? "Record another take" : "Start recording"}
                      </Button>
                      {isRecording ? (
                        <p className="text-[12px] text-[var(--ops-accent)]">Recording {formatDuration(recordingElapsedMs)}</p>
                      ) : null}
                      {supportError ? (
                        <p className="text-[12px] text-[var(--ops-danger)]">{supportError}</p>
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
