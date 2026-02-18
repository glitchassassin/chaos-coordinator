import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  IpcChannelMap,
  IpcChannel,
  BoardTaskUpdatedPayload,
  BOARD_PUSH_CHANNEL
} from '../shared/types/ipc'
import type { DebugEvent, DEBUG_PUSH_CHANNEL } from '../shared/types/debug'

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
      on(channel: typeof DEBUG_PUSH_CHANNEL, callback: (event: DebugEvent) => void): void
      on(
        channel: typeof BOARD_PUSH_CHANNEL,
        callback: (payload: BoardTaskUpdatedPayload) => void
      ): void
      off(channel: typeof DEBUG_PUSH_CHANNEL | typeof BOARD_PUSH_CHANNEL): void
    }
  }
}
