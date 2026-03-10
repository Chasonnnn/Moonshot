import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { OralWorkspace } from "@/components/candidate/oral-workspace"

const mockRefreshOralResponses = vi.fn()
const mockSetOralResponsesError = vi.fn()
const mockTrack = vi.fn()
const mockApi = {
  uploadOralResponse: vi.fn(),
}

let mockSessionValue = {
  api: mockApi,
  fixtureData: {
    oralWorkspace: {
      transcriptHighlights: ["Strong causal explanation."],
    },
  },
  isExpired: false,
  isSubmitted: false,
  isOralComplete: false,
  latestOralResponses: {
    presentation: {
      id: "oral-1",
      session_id: "session-1",
      clip_type: "presentation",
      question_id: null,
      duration_ms: 42000,
      mime_type: "audio/webm",
      status: "transcribed",
      transcript_text: "The discrepancy is isolated to paid social conversion.",
      transcription_model: "gpt-4o-transcribe",
      request_id: "req-oral-1",
      audio_retained: false,
      created_at: "2026-03-10T12:00:00Z",
      updated_at: "2026-03-10T12:00:00Z",
    },
  },
  missingOralClipTypes: ["follow_up_1", "follow_up_2"],
  missingOralPromptLabels: ["Follow-up 1", "Follow-up 2"],
  oralPrompts: [
    {
      clipType: "presentation",
      title: "Presentation",
      prompt: "Summarize the findings and recommendation.",
      maxDurationSeconds: 180,
    },
    {
      clipType: "follow_up_1",
      title: "Follow-up 1",
      prompt: "Defend the strongest evidence.",
      questionId: "q-1",
      maxDurationSeconds: 60,
    },
  ],
  oralRequirement: {
    required: true,
    requiredClipTypes: ["presentation", "follow_up_1", "follow_up_2"],
    weight: 0.2,
  },
  oralResponsesError: null,
  oralResponsesLoaded: true,
  refreshOralResponses: mockRefreshOralResponses,
  setOralResponsesError: mockSetOralResponsesError,
  track: mockTrack,
}

vi.mock("@/components/candidate/session-context", () => ({
  useSession: () => mockSessionValue,
}))

describe("OralWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders uploaded transcript metadata and prompt cards", () => {
    render(<OralWorkspace />)

    expect(screen.getByText("Recorded oral-defense responses")).toBeInTheDocument()
    expect(screen.getByText("The discrepancy is isolated to paid social conversion.")).toBeInTheDocument()
    expect(screen.getByText(/raw audio discarded/i)).toBeInTheDocument()
    expect(screen.getByText("Follow-up 1")).toBeInTheDocument()
  })

  it("shows explicit browser support error when recording is unavailable", () => {
    render(<OralWorkspace />)

    expect(screen.getByText(/microphone access is unavailable|does not support in-browser audio recording/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /start recording/i })).toBeDisabled()
  })
})
