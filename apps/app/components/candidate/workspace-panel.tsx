"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SqlWorkspace } from "@/components/candidate/sql-workspace"
import { DashboardWorkspace } from "@/components/candidate/dashboard-workspace"

export function WorkspacePanel() {
  return (
    <Tabs defaultValue="sql" className="flex h-full flex-col">
      <TabsList className="mx-3 mt-2 h-8 w-fit">
        <TabsTrigger value="sql" className="text-[12px]">
          SQL Workspace
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="text-[12px]">
          Dashboard
        </TabsTrigger>
      </TabsList>
      <TabsContent value="sql" className="mt-0 flex-1 overflow-hidden">
        <SqlWorkspace />
      </TabsContent>
      <TabsContent value="dashboard" className="mt-0 flex-1 overflow-hidden">
        <DashboardWorkspace />
      </TabsContent>
    </Tabs>
  )
}
