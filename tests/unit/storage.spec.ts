import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createAppStorage, type StorageFs } from '../../src/main/storage.js'

function fakeFs() {
  const files = new Map<string, string>()
  const fs: StorageFs = {
    async read(path) { return files.get(path) },
    async write(path, content) { files.set(path, content) },
    async mkdir(_path) { /* 记录即可 */ },
  }
  return { fs, files }
}

describe('createAppStorage', () => {
  it('初次 isFirstRun 为 true，completeFirstRun 后为 false 且落盘', async () => {
    const { fs, files } = fakeFs()
    const storage = createAppStorage({ baseDir: 'C:/AppData/DSH-Desktop', fs })
    expect(await storage.isFirstRun()).toBe(true)
    await storage.completeFirstRun()
    expect(await storage.isFirstRun()).toBe(false)
    expect(files.get(join('C:/AppData/DSH-Desktop', 'app-state.json'))).toBe('{"firstRunCompleted":true}')
  })

  it('已有标记文件时新实例 isFirstRun 为 false', async () => {
    const { fs } = fakeFs()
    const storage = createAppStorage({ baseDir: 'D:/', fs })
    await storage.completeFirstRun()
    const second = createAppStorage({ baseDir: 'D:/', fs })
    expect(await second.isFirstRun()).toBe(false)
  })

  it('损坏的标记文件按首启处理', async () => {
    const fs: StorageFs = {
      async read() { return 'not-json{{' },
      async write() { /* noop */ },
      async mkdir() { /* noop */ },
    }
    const storage = createAppStorage({ baseDir: 'X:/', fs })
    expect(await storage.isFirstRun()).toBe(true)
  })

  it('默认工作区可写入与读取', async () => {
    const { fs } = fakeFs()
    const storage = createAppStorage({ baseDir: 'W:/', fs })
    await storage.setDefaultWorkspace('E:/projects')
    const second = createAppStorage({ baseDir: 'W:/', fs })
    expect(await second.getDefaultWorkspace()).toBe('E:/projects')
  })
})
