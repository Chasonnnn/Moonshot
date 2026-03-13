"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronRight, Database } from "lucide-react"

export interface DatasetColumn {
  name: string
  dtype: string
  description: string
  sample_values: string[]
}

export interface DatasetSchema {
  columns: DatasetColumn[]
}

export interface CaseDatasetView {
  id: string
  name: string
  description: string
  row_count: number
  schema: DatasetSchema
  preview_rows: Record<string, unknown>[]
}

export function DataWorkspace({ datasets }: { datasets: CaseDatasetView[] }) {
  if (datasets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Database className="mx-auto h-8 w-8 text-[var(--ops-text-muted)]" />
          <p className="mt-2 text-[13px] text-[var(--ops-text-muted)]">No datasets available</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-4">
        {datasets.map((dataset) => (
          <DatasetCard key={dataset.id} dataset={dataset} />
        ))}
      </div>
    </ScrollArea>
  )
}

function DatasetCard({ dataset }: { dataset: CaseDatasetView }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--ops-accent)]" />
          <h3 className="text-[14px] font-medium text-[var(--ops-text)]">
            {dataset.name}
          </h3>
          <Badge variant="secondary" className="text-[10px]">
            {dataset.row_count} rows
          </Badge>
        </div>
        <p className="mt-1 text-[13px] text-[var(--ops-text-muted)]">
          {dataset.description}
        </p>
      </div>

      <div>
        <h4 className="text-[12px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]">
          Schema
        </h4>
        <div className="mt-2 space-y-1">
          {dataset.schema.columns.map((col) => (
            <Collapsible key={col.name}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] hover:bg-[var(--ops-surface-muted)]">
                <ChevronRight className="h-3 w-3 text-[var(--ops-text-muted)] transition-transform [[data-state=open]_&]:rotate-90" />
                <span className="font-mono text-[var(--ops-text)]">{col.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {col.dtype}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-7">
                <p className="text-[11px] text-[var(--ops-text-muted)]">{col.description}</p>
                {col.sample_values.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-[var(--ops-text-muted)]">
                    Sample: {col.sample_values.join(", ")}
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>

      {dataset.preview_rows.length > 0 && (
        <div>
          <h4 className="text-[12px] font-medium uppercase tracking-wide text-[var(--ops-text-muted)]">
            Preview
          </h4>
          <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--ops-border)]">
            <Table>
              <TableHeader>
                <TableRow>
                  {dataset.schema.columns.map((col) => (
                    <TableHead
                      key={col.name}
                      className="whitespace-nowrap text-[11px]"
                    >
                      {col.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.preview_rows.map((row) => {
                  const rowKey = dataset.schema.columns
                    .map((col) => String(row[col.name] ?? ""))
                    .join("|")

                  return (
                    <TableRow key={`${dataset.id}-${rowKey}`}>
                    {dataset.schema.columns.map((col) => (
                      <TableCell
                        key={col.name}
                        className="whitespace-nowrap font-mono text-[11px]"
                      >
                        {String(row[col.name] ?? "")}
                      </TableCell>
                    ))}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
