/// <reference lib="dom" />
import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { IpcChannelMap, IpcChannel } from '../shared/types'

const api = {
  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcChannelMap[C]['request'] extends undefined
      ? []
      : [IpcChannelMap[C]['request']]
  ): Promise<IpcChannelMap[C]['response']> {
    return ipcRenderer.invoke(channel, ...args)
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
