"use client"

import { useEffect, useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SqlWorkspace } from "@/components/candidate/sql-workspace"
import { AnalysisWorkspace } from "@/components/candidate/python-workspace"
import { DashboardWorkspace } from "@/components/candidate/dashboard-workspace"
import { DataWorkspace, type CaseDatasetView } from "@/components/candidate/data-workspace"
import { EditorWorkspace } from "@/components/candidate/editor-workspace"
import { SpreadsheetWorkspace } from "@/components/candidate/spreadsheet-workspace"
import { BIWorkspace } from "@/components/candidate/bi-workspace"
import { SlidesWorkspace } from "@/components/candidate/slides-workspace"
import { OralWorkspace } from "@/components/candidate/oral-workspace"
import { useSession } from "@/components/candidate/session-context"
import type { CaseDataset } from "@/lib/moonshot/types"

function normalizeDataset(dataset: CaseDataset): CaseDatasetView {
  return {
    id: dataset.id ?? dataset.name,
    name: dataset.name,
    description: dataset.description ?? "",
    row_count: dataset.row_count ?? 0,
    schema: {
      columns: dataset.schema?.columns ?? dataset.columns ?? [],
    },
    preview_rows: dataset.preview_rows ?? [],
  }
}

export function WorkspacePanel() {
  const { api, fixtureData, workspaceAvailability, activeWorkspace, setActiveWorkspace } = useSession()
  const [runtimeDatasets, setRuntimeDatasets] = useState<CaseDatasetView[]>([])

  useEffect(() => {
    let cancelled = false
    const loadDatasets = async () => {
      try {
        const response = await api.getDatasets()
        if (!cancelled) {
          const baseDatasets = response.datasets.map(normalizeDataset)
          const enriched = await Promise.all(
            baseDatasets.map(async (dataset) => {
              if (dataset.preview_rows.length > 0) return dataset
              try {
                const preview = await api.getDatasetPreview(dataset.name)
                const previewColumns = dataset.schema.columns.length
                  ? dataset.schema.columns
                  : preview.columns.map((name) => ({
                      name,
                      dtype: "unknown",
                      description: "",
                      sample_values: [],
                    }))
                return {
                  ...dataset,
                  schema: { columns: previewColumns },
                  preview_rows: preview.rows,
                }
              } catch {
                return dataset
              }
            })
          )
          if (!cancelled) {
            setRuntimeDatasets(enriched)
          }
        }
      } catch {
        if (!cancelled) {
          setRuntimeDatasets([])
        }
      }
    }
    void loadDatasets()
    return () => {
      cancelled = true
    }
  }, [api])

  const datasets = useMemo(
    () => (runtimeDatasets.length > 0 ? runtimeDatasets : fixtureData?.datasets ?? []),
    [fixtureData?.datasets, runtimeDatasets]
  )
  const tabs = useMemo(() => {
    const items = [
      { value: "data", label: "Data", content: <DataWorkspace datasets={datasets} /> },
      { value: "sql", label: "SQL", content: <SqlWorkspace /> },
      { value: "python", label: "Analysis", content: <AnalysisWorkspace /> },
      { value: "dashboard", label: "Dashboard", content: <DashboardWorkspace /> },
    ]
    if (workspaceAvailability.spreadsheet) {
      items.push({ value: "spreadsheet", label: "Spreadsheet", content: <SpreadsheetWorkspace /> })
    }
    if (workspaceAvailability.bi) {
      items.push({ value: "bi", label: "BI", content: <BIWorkspace /> })
    }
    if (workspaceAvailability.slides) {
      items.push({ value: "slides", label: "Slides", content: <SlidesWorkspace /> })
    }
    if (workspaceAvailability.oral) {
      items.push({ value: "oral", label: "Oral", content: <OralWorkspace /> })
    }
    items.push({ value: "report", label: "Report", content: <EditorWorkspace /> })
    return items
  }, [datasets, workspaceAvailability.bi, workspaceAvailability.oral, workspaceAvailability.slides, workspaceAvailability.spreadsheet])

  return (
    <Tabs
      value={activeWorkspace}
      onValueChange={(value) => setActiveWorkspace(value as typeof activeWorkspace)}
      className="flex h-full flex-col"
    >
      <TabsList
        className="mx-3 mt-2 flex h-auto w-auto max-w-[calc(100%-1.5rem)] gap-1 overflow-x-auto rounded-[22px] border border-[var(--ops-border,#d7e0e4)] bg-[var(--ops-surface-subtle,#f8fafc)] p-1 [scrollbar-width:none]"
        tabIndex={0}
        aria-label="Workspace tools"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="min-h-11 shrink-0 rounded-[18px] px-4 text-[13px] font-semibold md:min-h-8 md:px-3 md:text-[12px]"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 flex-1 overflow-hidden">
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
