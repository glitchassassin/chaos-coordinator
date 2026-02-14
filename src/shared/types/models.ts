import type { TaskColumn, TriggerStatus } from './enums'

// These types mirror the Drizzle schema (src/main/db/schema/).
// The Drizzle schema is the canonical source of truth for the database shape.
// These are kept in sync manually to avoid cross-process imports.

export interface Project {
  id: number
  name: string
  colorPrimary: string
  colorAccent: string
  backgroundImage: string | null
  priorityRank: number
  repoAssociations: string[]
  createdAt: string
  updatedAt: string
}

export interface InsertProject {
  name: string
  colorPrimary?: string
  colorAccent?: string
  backgroundImage?: string | null
  priorityRank?: number
  repoAssociations?: string[]
}

export interface Task {
  id: number
  title: string
  contextBlock: string | null
  column: TaskColumn
  projectId: number
  archived: boolean
  lastTouchedAt: string
  createdAt: string
  updatedAt: string
}

export interface InsertTask {
  title: string
  projectId: number
  contextBlock?: string | null
  column?: TaskColumn
  archived?: boolean
}

export interface Trigger {
  id: number
  taskId: number
  nlCondition: string
  interpretedCheck: string | null
  status: TriggerStatus
  pollIntervalMs: number
  failureCount: number
  firedContext: string | null
  firedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface InsertTrigger {
  taskId: number
  nlCondition: string
  interpretedCheck?: string | null
  status?: TriggerStatus
  pollIntervalMs?: number
}

export interface Link {
  id: number
  taskId: number
  url: string
  label: string | null
  sourceType: 'github_issue' | 'github_pr' | 'azure_devops' | 'other'
  isPrimary: boolean
  createdAt: string
}

export interface InsertLink {
  taskId: number
  url: string
  label?: string | null
  sourceType?: 'github_issue' | 'github_pr' | 'azure_devops' | 'other'
  isPrimary?: boolean
}

export interface ColumnHistory {
  id: number
  taskId: number
  fromColumn: TaskColumn | null
  toColumn: TaskColumn
  contextSnapshot: string | null
  movedAt: string
}

export interface InsertColumnHistory {
  taskId: number
  toColumn: TaskColumn
  fromColumn?: TaskColumn | null
  contextSnapshot?: string | null
}
