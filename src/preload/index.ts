/// <reference lib="dom" />
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  IpcChannelMap,
  IpcChannel,
  BoardTaskUpdatedPayload
} from '../shared/types/ipc'
import { BOARD_PUSH_CHANNEL } from '../shared/types/ipc'
import type { DebugEvent } from '../shared/types/debug'
import { DEBUG_PUSH_CHANNEL } from '../shared/types/debug'

type PushChannelMap = {
  [DEBUG_PUSH_CHANNEL]: DebugEvent
  [BOARD_PUSH_CHANNEL]: BoardTaskUpdatedPayload
}

type PushChannel = keyof PushChannelMap

const api = {
  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcChannelMap[C]['request'] extends undefined
      ? []
      : [IpcChannelMap[C]['request']]
  ): Promise<IpcChannelMap[C]['response']> {
    return ipcRenderer.invoke(channel, ...args)
  },

  on<C extends PushChannel>(
    channel: C,
    callback: (payload: PushChannelMap[C]) => void
  ): void {
    ipcRenderer.on(channel, (_ipcEvent, payload: PushChannelMap[C]) => {
      callback(payload)
    })
  },

  off(channel: PushChannel): void {
    ipcRenderer.removeAllListeners(channel)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  ;(window as unknown as Record<string, unknown>).electron = electronAPI
  ;(window as unknown as Record<string, unknown>).api = api
}
