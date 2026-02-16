import { ipcMain, dialog, app } from 'electron'
import { copyFileSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Channels } from './channels'
import { extractPalette } from '../lib/color-extraction'

export function registerColorHandlers(): void {
  ipcMain.handle(Channels.DialogOpenImage, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0] ?? null
  })

  ipcMain.handle(
    Channels.FilesCopyToAppData,
    (_event, { sourcePath }: { sourcePath: string }) => {
      const dir = join(app.getPath('userData'), 'project-images')
      mkdirSync(dir, { recursive: true })
      const ext = extname(sourcePath)
      const destName = `${randomUUID()}${ext}`
      const destPath = join(dir, destName)
      copyFileSync(sourcePath, destPath)
      return destPath
    }
  )

  ipcMain.handle(
    Channels.ColorsExtractPalette,
    (_event, { imagePath }: { imagePath: string }) => {
      const colors = extractPalette(imagePath, 5)
      return { colors }
    }
  )
}
