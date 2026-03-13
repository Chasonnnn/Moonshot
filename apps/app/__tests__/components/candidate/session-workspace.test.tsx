import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SessionWorkspace } from "@/components/candidate/session-workspace"

let isMobile = false

const mockTrack = vi.fn()
const sessionContext = {
  isExpired: false,
  isSubmitted: false,
  session: {
    status: "active",
  },
  track: mockTrack,
  autoPlay: true,
  fixtureData: null,
}

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => isMobile,
}))

vi.mock("@/components/candidate/session-context", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => sessionContext,
}))

vi.mock("@/components/candidate/session-header", () => ({
  SessionHeader: ({ onSubmit }: { onSubmit: () => void }) => (
    <button type="button" onClick={onSubmit}>
      Submit session
    </button>
  ),
}))

vi.mock("@/components/candidate/task-panel", () => ({
  TaskPanel: () => <div>task-panel</div>,
}))

vi.mock("@/components/candidate/workspace-panel", () => ({
  WorkspacePanel: () => <div>workspace-panel</div>,
}))

vi.mock("@/components/candidate/coach-panel", () => ({
  CoachPanel: () => <div>coach-panel</div>,
}))

vi.mock("@/components/candidate/submit-dialog", () => ({
  SubmitDialog: () => <div>submit-dialog</div>,
}))

vi.mock("@/components/candidate/auto-play-controller", () => ({
  AutoPlayController: () => <div>autoplay-controller</div>,
}))

vi.mock("@/components/candidate/session-preflight", () => ({
  SessionPreflight: () => <div>session-preflight</div>,
}))

vi.mock("@/components/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe("SessionWorkspace", () => {
  beforeEach(() => {
    isMobile = false
  })

  it("renders the desktop multi-panel shell on wide viewports", () => {
    render(<SessionWorkspace session={{ id: "session-1" } as never} autoPlay />)

    expect(screen.getByText("task-panel")).toBeInTheDocument()
    expect(screen.getByText("workspace-panel")).toBeInTheDocument()
    expect(screen.getByText("coach-panel")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Task" })).not.toBeInTheDocument()
  })

  it("switches between mobile sections from the top nav pills", async () => {
    const user = userEvent.setup()
    isMobile = true

    render(<SessionWorkspace session={{ id: "session-1" } as never} autoPlay />)

    expect(screen.getByRole("button", { name: "Task" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Work" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument()
    expect(screen.getByText("task-panel")).toBeInTheDocument()
    expect(screen.queryByText("workspace-panel")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Work" }))

    expect(screen.getByText("workspace-panel")).toBeInTheDocument()
    expect(screen.queryByText("task-panel")).not.toBeInTheDocument()
  })
})
