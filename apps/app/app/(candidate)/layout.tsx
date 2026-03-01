import { Toaster } from "@/components/ui/sonner"

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <Toaster position="bottom-right" />
    </>
  )
}
