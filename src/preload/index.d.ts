import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcChannelMap, IpcChannel } from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      invoke<C extends IpcChannel>(
        channel: C,
        ...args: IpcChannelMap[C]['request'] extends undefined
          ? []
          : [IpcChannelMap[C]['request']]
      ): Promise<IpcChannelMap[C]['response']>
    }
  }
}
