import { app, dialog, ipcMain } from 'electron'
// asar 内 CJS 互操作不支持具名导出（打包环境实测），须走默认导出解构
import electronUpdaterPkg from 'electron-updater'
const { autoUpdater } = electronUpdaterPkg
import { join } from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { createApp, type AppDeps } from './app-service.js'
import { createEngineProcess, createRealEngineDeps } from './engine-process.js'
import { pickFreePort, listenProbe } from './port-picker.js'
import { createAppStorage, realFs } from './storage.js'
import { createRealWindows } from './windows.js'
import { createOrphanCleaner, realListProcesses, realTreeKill } from './orphan-cleaner.js'

// ---------- 资源与数据目录 ----------

function resourcesDir(): string {
  // 打包后：安装目录 resources/；开发态：仓库根/resources/（npm run stage 的产出）
  return app.isPackaged
    ? process.resourcesPath
    : join(process.cwd(), 'resources')
}

function appDataDir(): string {
  return join(app.getPath('appData'), 'DSH-Desktop')
}

function enginePaths() {
  const res = resourcesDir()
  return {
    nodeExe: join(res, 'runtime', 'node.exe'),
    engineEntry: join(res, 'engine', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    dshHome: join(appDataDir(), 'dsh-home'),
  }
}

// ---------- 单实例 ----------

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

// ---------- 向导 IPC：凭据写入 + 工作区选择 ----------

ipcMain.handle('wizard:pick-workspace', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]!
})

async function writeCredentials(dshHome: string, apiKey: string): Promise<void> {
  await mkdir(dshHome, { recursive: true })
  // 格式经实测核实：单键扁平 YAML（2026-08-15 于 ~/.dsh/.credentials.yaml）
  await writeFile(join(dshHome, '.credentials.yaml'), `DEEPSEEK_API_KEY: ${apiKey}\n`, 'utf8')
}

// ---------- 装配 ----------

async function bootstrap(): Promise<void> {
  const paths = enginePaths()
  const storage = createAppStorage({ baseDir: appDataDir(), fs: realFs() })

  // 断电/强杀残留的引擎进程：启动前清理（排除自身）
  const orphanCleaner = createOrphanCleaner(paths.engineEntry, {
    listProcesses: realListProcesses,
    treeKill: realTreeKill,
  })
  const killed = await orphanCleaner.clean()
  if (killed.length > 0) console.log(`[dsh-desktop] 已清理 ${killed.length} 个残留引擎进程: ${killed.join(', ')}`)

  const port = await pickFreePort({ isFree: listenProbe() })
  const engine = createEngineProcess(paths, port, createRealEngineDeps())

  // 向导提交：写凭据 + 默认工作区（Task 8 页面接线消费）
  ipcMain.removeHandler('wizard:submit')
  ipcMain.handle('wizard:submit', async (_e, data: { apiKey: string; workspace: string }) => {
    try {
      if (typeof data?.apiKey !== 'string' || !/^sk-/.test(data.apiKey)) {
        return { ok: false, error: 'API Key 需以 sk- 开头' }
      }
      if (typeof data?.workspace !== 'string' || data.workspace.length === 0) {
        return { ok: false, error: '请选择工作区文件夹' }
      }
      await writeCredentials(paths.dshHome, data.apiKey)
      await storage.setDefaultWorkspace(data.workspace)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  const deps: AppDeps = {
    engine,
    windows: createRealWindows(),
    storage,
    updater: {
      async checkAndNotify() {
        autoUpdater.autoDownload = true
        // v0.1：下载完成后在下次退出时安装，不弹更新 UI
        await autoUpdater.checkForUpdatesAndNotify()
      },
    },
    lock: {
      acquire: () => gotLock,
      onSecondInstance: cb => { app.on('second-instance', cb) },
    },
    log: msg => { console.log(`[dsh-desktop] ${msg}`) },
  }

  const appService = createApp(deps)
  await appService.init()

  // 退出流程：先停引擎再退出
  let quitting = false
  app.on('before-quit', event => {
    if (quitting) return
    quitting = true
    event.preventDefault()
    void appService.shutdown().finally(() => { app.exit(0) })
  })
  app.on('window-all-closed', () => { app.quit() })
}

void app.whenReady().then(bootstrap).catch(err => {
  console.error('[dsh-desktop] 启动失败：', err)
  app.exit(1)
})
