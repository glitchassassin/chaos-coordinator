import type { Project, InsertProject, Task, InsertTask } from './models'

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
  'tasks:focus': { request: undefined; response: Task | null }
}

export type IpcChannel = keyof IpcChannelMap
