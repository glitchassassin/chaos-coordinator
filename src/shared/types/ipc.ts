import type {
  Project,
  InsertProject,
  Task,
  InsertTask,
  Trigger,
  Link,
  InsertLink,
  ColumnHistory,
  InsertColumnHistory
} from './models'
import type {
  ConfigKey,
  ConfigValueMap,
  MaskedConfig,
  ConfigSchemaMetadata
} from '../config/types'
import type { DebugEvent, DebugEventType } from './debug'

export const BOARD_PUSH_CHANNEL = 'board:taskUpdated' as const
export interface BoardTaskUpdatedPayload {
  taskId: number
  success: boolean
}

export interface FocusResponse {
  task: Task | null
  project: Project | null
  trigger: Trigger | null
  links: Link[]
  queueDepth: {
    actionable: number
    waiting: number
  }
}

export interface LLMGenerateRequest {
  system?: string
  prompt: string
}

export interface LLMGenerateStructuredRequest {
  system?: string
  prompt: string
  schema: string // JSON stringified Zod schema
}

export interface IpcChannelMap {
  'projects:list': { request: undefined; response: Project[] }
  'projects:get': { request: { id: number }; response: Project | null }
  'projects:create': { request: InsertProject; response: Project }
  'projects:update': {
    request: { id: number } & Partial<InsertProject>
    response: Project
  }
  'projects:delete': { request: { id: number }; response: undefined }

  'tasks:list': {
    request: { projectId?: number; archived?: boolean }
    response: Task[]
  }
  'tasks:get': { request: { id: number }; response: Task | null }
  'tasks:create': { request: InsertTask; response: Task }
  'tasks:update': {
    request: { id: number } & Partial<InsertTask>
    response: Task
  }
  'tasks:archive': { request: { id: number }; response: Task }
  'tasks:focus': { request: undefined; response: FocusResponse }

  'llm:generate': { request: LLMGenerateRequest; response: string }
  'llm:generateStructured': {
    request: LLMGenerateStructuredRequest
    response: unknown
  }
  'llm:checkHealth': { request: undefined; response: { configured: boolean } }

  'config:get': {
    request: { key: ConfigKey }
    response: ConfigValueMap[ConfigKey] | undefined
  }
  'config:set': {
    request: { key: ConfigKey; value: ConfigValueMap[ConfigKey] }
    response: boolean
  }
  'config:getAll': { request: undefined; response: MaskedConfig }
  'config:getSchema': { request: undefined; response: ConfigSchemaMetadata }
  'config:reset': { request: { key: ConfigKey }; response: boolean }

  'links:list': { request: { taskId: number }; response: Link[] }
  'links:create': { request: InsertLink; response: Link }
  'links:delete': { request: { id: number }; response: undefined }

  'columnHistory:create': { request: InsertColumnHistory; response: ColumnHistory }
  'columnHistory:list': { request: { taskId: number }; response: ColumnHistory[] }

  'intake:fetchMetadata': {
    request: { url: string }
    response: {
      title: string
      contextBlock: string
      sourceType: Link['sourceType']
      repoKey: string | null
      matchedProjectId: number | null
    } | null
  }
  'intake:processTask': {
    request: { url: string; taskId: number; projectId: number }
    response: undefined
  }

  'dialog:open-image': { request: undefined; response: string | null }
  'files:copy-to-app-data': {
    request: { sourcePath: string }
    response: string
  }
  'colors:extract-palette': {
    request: { imagePath: string }
    response: { colors: string[] }
  }

  'debug:subscribe': {
    request: { types?: DebugEventType[] } | undefined
    response: { events: DebugEvent[] }
  }
  'debug:unsubscribe': { request: undefined; response: undefined }

  'llm:validateModel': {
    request: { model: string }
    response: { valid: boolean; error?: string }
  }
}

export type IpcChannel = keyof IpcChannelMap
