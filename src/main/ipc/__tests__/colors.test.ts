/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain, dialog } from 'electron'
import { registerColorHandlers } from '../colors'
import { Channels } from '../channels'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showOpenDialog: vi.fn()
  },
  app: {
    getPath: vi.fn(() => '/tmp/test-userdata')
  }
}))

vi.mock('node:fs', () => ({
  copyFileSync: vi.fn(),
  mkdirSync: vi.fn()
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234')
}))

vi.mock('../../lib/color-extraction', () => ({
  extractPalette: vi.fn(() => ['#ff0000', '#00ff00', '#0000ff'])
}))

describe('Colors IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all color handlers', () => {
    registerColorHandlers()

    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.DialogOpenImage,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.FilesCopyToAppData,
      expect.any(Function)
    )
    expect(ipcMain.handle).toHaveBeenCalledWith(
      Channels.ColorsExtractPalette,
      expect.any(Function)
    )
  })

  describe('dialog:open-image', () => {
    it('returns file path when user selects a file', async () => {
      registerColorHandlers()

      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: ['/path/to/image.png']
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((c) => c[0] === Channels.DialogOpenImage)?.[1]

      const result = await handler?.({} as Electron.IpcMainInvokeEvent)

      expect(result).toBe('/path/to/image.png')
      expect(dialog.showOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      })
    })

    it('returns null when dialog is canceled', async () => {
      registerColorHandlers()

      vi.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: true,
        filePaths: []
      })

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((c) => c[0] === Channels.DialogOpenImage)?.[1]

      const result = await handler?.({} as Electron.IpcMainInvokeEvent)

      expect(result).toBeNull()
    })
  })

  describe('files:copy-to-app-data', () => {
    it('copies file and returns destination path', async () => {
      registerColorHandlers()

      const { copyFileSync, mkdirSync } = await import('node:fs')

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((c) => c[0] === Channels.FilesCopyToAppData)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        sourcePath: '/original/photo.png'
      })

      expect(mkdirSync).toHaveBeenCalledWith('/tmp/test-userdata/project-images', {
        recursive: true
      })
      expect(copyFileSync).toHaveBeenCalledWith(
        '/original/photo.png',
        '/tmp/test-userdata/project-images/test-uuid-1234.png'
      )
      expect(result).toBe('/tmp/test-userdata/project-images/test-uuid-1234.png')
    })
  })

  describe('colors:extract-palette', () => {
    it('returns extracted colors', async () => {
      registerColorHandlers()

      const { extractPalette } = await import('../../lib/color-extraction')

      const calls = vi.mocked(ipcMain.handle).mock.calls
      const handler = calls.find((c) => c[0] === Channels.ColorsExtractPalette)?.[1]

      const result = handler?.({} as Electron.IpcMainInvokeEvent, {
        imagePath: '/path/to/image.png'
      })

      expect(extractPalette).toHaveBeenCalledWith('/path/to/image.png', 5)
      expect(result).toEqual({ colors: ['#ff0000', '#00ff00', '#0000ff'] })
    })
  })
})
