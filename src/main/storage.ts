import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** 文件系统抽象（注入以便测试）。 */
export interface StorageFs {
  read(path: string): Promise<string | undefined>
  write(path: string, content: string): Promise<void>
  mkdir(path: string): Promise<void>
}

export interface AppStorage {
  isFirstRun(): Promise<boolean>
  completeFirstRun(): Promise<void>
  /** 向导收集的默认工作区（可多次更新）。 */
  getDefaultWorkspace(): Promise<string | undefined>
  setDefaultWorkspace(path: string): Promise<void>
}

interface AppState {
  firstRunCompleted?: boolean
  defaultWorkspace?: string
}

export function createAppStorage(opts: { baseDir: string; fs: StorageFs }): AppStorage {
  const statePath = join(opts.baseDir, 'app-state.json')

  const load = async (): Promise<AppState> => {
    try {
      const content = await opts.fs.read(statePath)
      if (content == null) return {}
      const parsed = JSON.parse(content) as AppState
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {} // 损坏按首启处理
    }
  }

  const persist = async (state: AppState): Promise<void> => {
    try {
      await opts.fs.mkdir(opts.baseDir)
      await opts.fs.write(statePath, JSON.stringify(state))
    } catch {
      // 持久化失败不阻断流程；首启标记丢失的代价只是再看一次向导
    }
  }

  const update = async (patch: (state: AppState) => AppState): Promise<AppState> => {
    const next = patch(await load())
    await persist(next)
    return next
  }

  return {
    async isFirstRun() {
      return (await load()).firstRunCompleted !== true
    },
    async completeFirstRun() {
      await update(s => ({ ...s, firstRunCompleted: true }))
    },
    async getDefaultWorkspace() {
      return (await load()).defaultWorkspace
    },
    async setDefaultWorkspace(path) {
      await update(s => ({ ...s, defaultWorkspace: path }))
    },
  }
}

/** 真实 fs 实现（Task 7 接线用）。 */
export function realFs(): StorageFs {
  return {
    async read(path) {
      try {
        return await readFile(path, 'utf8')
      } catch {
        return undefined
      }
    },
    async write(path, content) {
      await writeFile(path, content, 'utf8')
    },
    async mkdir(path) {
      await mkdir(path, { recursive: true })
    },
  }
}
