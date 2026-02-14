export const TaskColumn = {
  Backlog: 'backlog',
  Planning: 'planning',
  InProgress: 'in_progress',
  Review: 'review'
} as const

export type TaskColumn = (typeof TaskColumn)[keyof typeof TaskColumn]

export const TriggerStatus = {
  Pending: 'pending',
  Polling: 'polling',
  Fired: 'fired',
  Failed: 'failed',
  Cancelled: 'cancelled'
} as const

export type TriggerStatus = (typeof TriggerStatus)[keyof typeof TriggerStatus]

export const CommandSafety = {
  ReadOnly: 'read_only',
  Mutating: 'mutating',
  Unknown: 'unknown'
} as const

export type CommandSafety = (typeof CommandSafety)[keyof typeof CommandSafety]
