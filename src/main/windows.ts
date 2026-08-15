import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppWindowDeps } from './app-service.js'

const here = fileURLToPath(new URL('.', import.meta.url))

let mainWin: BrowserWindow | null = null

function preloadPath(): string {
  // dist/main/../preload/wizard.js（tsc 产出结构）
  return join(here, '..', 'preload', 'wizard.js')
}

function rendererPath(page: 'wizard' | 'engine-error'): string {
  return join(here, '..', '..', 'renderer', page, 'index.html')
}

function windowOptions(width: number, height: number) {
  return {
    width,
    height,
    useContentSize: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: preloadPath(),
    },
  }
}

/** 主窗口：加载引擎 URL。 */
export function showMainWindow(baseUrl: string): void {
  if (mainWin == null || mainWin.isDestroyed()) {
    mainWin = new BrowserWindow(windowOptions(1280, 820))
    mainWin.on('closed', () => { mainWin = null })
  }
  void mainWin.loadURL(baseUrl)
  mainWin.show()
  mainWin.focus()
}

export function focusMainWindow(): void {
  if (mainWin != null && !mainWin.isDestroyed()) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.show()
    mainWin.focus()
  }
}

/** 首启向导；用户完成（wizard:submit 成功）时 resolve。 */
export function showWizardWindow(): Promise<'completed'> {
  return new Promise(resolve => {
    const win = new BrowserWindow({ ...windowOptions(520, 680), resizable: false, modal: false })
    const handler = (_e: unknown, result: { ok: boolean; error?: string }) => {
      if (result.ok) {
        ipcMain.removeHandler('wizard:submit')
        resolve('completed')
        win.close()
      } else {
        win.webContents.send('wizard:error', result.error ?? '提交失败')
      }
    }
    ipcMain.removeHandler('wizard:submit')
    ipcMain.handle('wizard:submit', handler)
    void win.loadFile(rendererPath('wizard'))
    win.on('closed', () => {
      // 用户直接关窗：向导视为放弃，但应用继续（下次启动仍是首启）
      ipcMain.removeHandler('wizard:submit')
      resolve('completed')
    })
  })
}

/** 引擎故障页；渲染进程经 IPC 请求重启。 */
export function showErrorWindow(diagnosis: string, restart: () => Promise<void>): void {
  const win = new BrowserWindow({ ...windowOptions(640, 480), resizable: false })
  ipcMain.removeHandler('engine-error:restart')
  ipcMain.handle('engine-error:restart', async () => {
    await restart()
    win.close()
  })
  void win.loadFile(rendererPath('engine-error'))
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('engine-error:info', diagnosis)
  })
}

/** 组合根所需的窗口依赖（接缝 1 的真实实现）。 */
export function createRealWindows(): AppWindowDeps {
  return {
    showWizard: showWizardWindow,
    showMain: showMainWindow,
    showError: showErrorWindow,
    focusMain: focusMainWindow,
  }
}
