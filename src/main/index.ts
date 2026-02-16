import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join, resolve, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { runMigrations } from './db/migrate'
import { configStore } from './config'

// Register custom scheme before app is ready — serves project images in both dev and production
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.chaos-coordinator.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Serve project images via media:// protocol — resolves file:// restriction in dev mode
  protocol.handle('media', (request) => {
    const url = new URL(request.url)
    const filename = decodeURIComponent(url.pathname).replace(/^\//, '')
    const imagesDir = join(app.getPath('userData'), 'project-images')
    const filePath = resolve(imagesDir, filename)

    // Security: only serve files within the project-images directory
    if (!filePath.startsWith(imagesDir + sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    return net.fetch(`file://${filePath}`)
  })

  runMigrations()
  configStore.initialize()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
