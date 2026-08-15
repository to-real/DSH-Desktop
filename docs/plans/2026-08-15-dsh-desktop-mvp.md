# DSH-Desktop MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 SPEC-0001 定义的 v0.1——双击即用的 Windows 桌面应用，内含捆绑的 DSH 引擎、首启向导、自动更新。

**Architecture:** Electron 主进程以 `createApp(deps)` 组合根集中全部桌面行为决策（依赖注入：引擎/窗口/存储/更新器/实例锁）；EngineProcess 封装真引擎子进程（spawn → 健康检查 → 停止）；渲染层只有两个本地页面（首启向导、引擎故障页），主界面直接加载引擎 URL。引擎 = Node 24 运行时 + npm 精确版本的 `@deepseek-ai/dsh`，打包进 extraResources。

**Tech Stack:** Electron 43 / TypeScript / vitest（单测+集成）/ Playwright（打包冒烟）/ electron-builder 26（NSIS）/ electron-updater。参照系 anywhere-labs/deepseek-harness-desktop——**每个借鉴点在对应任务内先对比替代方案再采纳**（SPEC 明示要求）。

**规格：** `docs/specs/0001-dsh-desktop-mvp.md`（Issue #1，ready-for-agent）

---

## 文件结构（分解决策在此锁定）

```
DSH-Desktop/
├── package.json                  # 根：devDeps + scripts（不含运行时依赖）
├── tsconfig.json                 # 主进程+脚本 TS 配置（ESM）
├── vitest.config.ts
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.ts              # Electron 入口：实例锁、createApp 接线、app 生命周期
│   │   ├── app-service.ts        # 【接缝1】createApp(deps) 组合根——所有决策逻辑
│   │   ├── engine-process.ts     # 【接缝2】引擎子进程状态机
│   │   ├── port-picker.ts        # 随机可用端口
│   │   ├── orphan-cleaner.ts     # 孤儿引擎进程检测清理
│   │   ├── storage.ts            # first-run 标记（%APPDATA% JSON）
│   │   └── windows.ts            # 主窗口/向导/故障页创建与聚焦
│   └── preload/
│       └── wizard.ts             # contextBridge：向导 ↔ 主进程 IPC
├── renderer/                     # 纯静态本地页（零框架，两屏）
│   ├── wizard/index.html|.js|.css
│   └── engine-error/index.html|.js
├── scripts/
│   ├── stage-runtime.ts          # 构建期：下载 Node24 + npm 装 dsh → resources/
│   ├── verify-packaged-runtime.ts# afterPack 校验
│   └── download-node.ts          # 下载/解压 Node（独立以便复用）
├── tests/
│   ├── unit/                     # 假依赖，秒级
│   ├── integration/engine-smoke.spec.ts  # 真引擎（slow 标记）
│   └── e2e/packaged-app.spec.ts  # Playwright Electron（发布流程）
└── .github/workflows/ci.yml
```

## 全局约定

- **分支纪律**：全部工作在 `feat/mvp-shell` 分支，禁止直接提交 main（executing-plans 要求）
- **TDD 节奏**：每个行为先写失败测试 → 跑确认失败 → 最小实现 → 跑通过 → 提交
- **提交风格**： conventional commits（`feat:`/`test:`/`chore:`），一个任务可多次提交
- **版本精确锁**：`@deepseek-ai/dsh@0.1.0-rc.6`、Node `v24.19.0`（均经 2026-08-15 本机验证）
- **引擎事实**（已验证，勿再探索）：spawn 命令 `node <engine>/node_modules/@deepseek-ai/dsh/lib/bin.js web --host 127.0.0.1 --port <随机>`；环境变量 `DSH_HOME=<数据目录>`；健康判定 `GET /` 返回 200 且含 `__DSH_BOOT__`；凭据文件 `$DSH_HOME/.credentials.yaml` 内容为单行 `DEEPSEEK_API_KEY: <key>`

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.editorconfig`
- Modify: `README.md`（开发说明一节）

- [ ] **Step 1: 初始化 package.json**

```json
{
  "name": "dsh-desktop",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/index.js",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run --exclude 'tests/integration/**' --exclude 'tests/e2e/**'",
    "build": "tsc -p tsconfig.json",
    "dev": "npm run build && electron dist/main/index.js --dev",
    "stage": "tsx scripts/stage-runtime.ts",
    "dist": "npm run build && npm run stage && electron-builder --win nsis",
    "smoke:packaged": "playwright test tests/e2e"
  },
  "devDependencies": {
    "electron": "43.4.0",
    "electron-builder": "26.15.3",
    "typescript": "^6.0.0",
    "tsx": "^4.22.0",
    "vitest": "^4.1.0",
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.20.0"
  }
}
```

- [ ] **Step 2: tsconfig.json**（`target: ES2023`, `module: NodeNext`, `outDir: dist`, `include: ["src", "scripts"]`, strict 全开）

- [ ] **Step 3: vitest.config.ts**——`include: ['tests/**/*.spec.ts']`；`test.environment: 'node'`；为 `tests/integration/**` 设 `testTimeout: 180000`

- [ ] **Step 4: 验证工具链**

Run: `npm install && npm run typecheck && npm run test`
Expected: install 成功；typecheck 0 错误；test 报 "no test files"（属预期通过态 exit code 非 0 时先建一个空占位 spec）

- [ ] **Step 5: 建 `feat/mvp-shell` 分支并提交** `chore: 项目脚手架（TS+vitest+electron 工具链）`

---

### Task 2: PortPicker（随机可用端口）

**Files:**
- Create: `src/main/port-picker.ts`
- Test: `tests/unit/port-picker.spec.ts`

- [ ] **Step 1: 失败测试**

```ts
import { describe, it, expect, vi } from 'vitest'
import { pickFreePort } from '../../src/main/port-picker.js'

describe('pickFreePort', () => {
  it('返回 20000-60000 之间且 isFree 为真的端口', async () => {
    const isFree = vi.fn(async (p: number) => p !== 30000)
    const seen: number[] = []
    for (let i = 0; i < 20; i++) seen.push(await pickFreePort({ isFree }))
    expect(seen.every(p => p >= 20000 && p < 60000 && p !== 30000)).toBe(true)
  })
  it('重试 N 次仍无可用端口时抛错', async () => {
    const isFree = vi.fn(async () => false)
    await expect(pickFreePort({ isFree, attempts: 3 })).rejects.toThrow(/无可用端口/)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**（Run: `npx vitest run tests/unit/port-picker.spec.ts`；Expected: FAIL 模块不存在）
- [ ] **Step 3: 最小实现**——`pickFreePort({ isFree, attempts = 10, random = Math.random })`：随机生成区间端口，`isFree(port)`（真实实现 = net.createServer listen 探测，注入以便测试）；全败抛 `无可用端口`
- [ ] **Step 4: 跑测试通过**
- [ ] **Step 5: Commit** `feat: 随机端口选择器`

---

### Task 3: EngineProcess 状态机（启动与健康检查）

**Files:**
- Create: `src/main/engine-process.ts`
- Test: `tests/unit/engine-process.spec.ts`

**决策形状（锁定）：**

```ts
export type EngineState = 'idle' | 'starting' | 'healthy' | 'crashed' | 'stopped'
export interface EngineDeps {
  spawn(cmd: string, args: readonly string[], env: Record<string, string>): EngineChild   // 注入
  probe(url: string): Promise<number>          // 返回 HTTP 状态码；连接失败 reject
  now(): number
  delay(ms: number): Promise<void>
}
export interface EngineChild { pid: number; killed: boolean; kill(): boolean;
  exited: Promise<{ code: number | null }>; onStderr(cb: (s: string) => void): void }
export interface EngineProcess {
  start(): Promise<{ port: number; baseUrl: string }>   // healthy 才 resolve
  stop(): Promise<void>
  state(): EngineState
  onStateChange(cb: (s: EngineState) => void): () => void
}
export function createEngineProcess(paths: { nodeExe: string; engineEntry: string; dshHome: string },
                                    port: number, deps: EngineDeps): EngineProcess
```

- [ ] **Step 1: 失败测试——spawn 参数与 DSH_HOME**

```ts
it('以正确命令行与环境启动引擎', async () => {
  const spawns: any[] = []
  const deps = fakeDeps({ spawn: (cmd, args, env) => { spawns.push({ cmd, args, env }); return fakeChild() } })
  const p = createEngineProcess({ nodeExe: 'N', engineEntry: 'E', dshHome: 'H' }, 45678, deps)
  const ready = p.start()
  deps.resolveProbe(200)                       // 健康检查放行
  await ready
  const s = spawns[0]
  expect(s.cmd).toBe('N')
  expect(s.args).toEqual(['E', 'web', '--host', '127.0.0.1', '--port', '45678'])
  expect(s.env.DSH_HOME).toBe('H')
})
```

- [ ] **Step 2: 失败测试——健康前轮询、就绪后 resolve 且状态流转 idle→starting→healthy**（用 `deps.now/delay` 假时钟控制，probe 前 2 次 reject、第 3 次 200，断言 onStateChange 收到序列且 start resolve）
- [ ] **Step 3: 失败测试——进程先死于健康检查**（`fakeChild.exited` 立即 resolve code≠0 → start reject，诊断含「进程已退出」与 stderr 尾部；状态 → crashed）
- [ ] **Step 4: 失败测试——健康检查总超时**（120s 假时钟走完仍 reject → start reject 诊断「迟迟未就绪」，kill 子进程，状态 stopped）
- [ ] **Step 5: 跑全部确认失败**
- [ ] **Step 6: 最小实现**——状态机按上述行为实现；probe 间隔 500ms、总超时 120_000ms；stderr 环形缓冲 2KB 供诊断
- [ ] **Step 7: 跑测试通过**（Run: `npx vitest run tests/unit/engine-process.spec.ts`）
- [ ] **Step 8: Commit** `feat: 引擎子进程状态机（启动/健康/崩溃/超时）`

---

### Task 4: EngineProcess 停止与强杀

**Files:**
- Modify: `src/main/engine-process.ts`
- Test: `tests/unit/engine-process.spec.ts`（追加）

- [ ] **Step 1: 失败测试——优雅停止**（healthy 后 stop()：child.kill() 成功、exited resolve → 状态 stopped、stop resolve）
- [ ] **Step 2: 失败测试——5 秒不退则 taskkill 树杀**（kill() 后 exited 挂起，假时钟过 5s → 断言调用了 `deps.treeKill(pid)`（新注入项），随后 exited 强制视为结束）
- [ ] **Step 3: 失败测试——重复 stop 幂等**（第二次调用直接 resolve 不报错）
- [ ] **Step 4: 跑确认失败 → 实现**（`deps.treeKill` 真实实现 = `execFile('taskkill', ['/PID', String(pid), '/T', '/F'])`）→ **跑通过**
- [ ] **Step 5: Commit** `feat: 引擎优雅停止与超时树杀`

---

### Task 5: Storage（first-run 标记）

**Files:**
- Create: `src/main/storage.ts`
- Test: `tests/unit/storage.spec.ts`

- [ ] **Step 1: 失败测试**——注入假 fs：`isFirstRun()` 初次 true；`completeFirstRun()` 后 false 且文件含 `{"firstRunCompleted":true}`；目录不存在时自动创建
- [ ] **Step 2: 失败→实现→通过**（路径 = `%APPDATA%/DSH-Desktop/app-state.json`，注入 baseDir 以便测试）
- [ ] **Step 3: Commit** `feat: 本地应用状态存储`

---

### Task 6: AppService 组合根【接缝1，核心任务】

**Files:**
- Create: `src/main/app-service.ts`
- Test: `tests/unit/app-service.spec.ts`

**决策形状（锁定）：**

```ts
export interface AppDeps {
  engine: Pick<EngineProcess, 'start' | 'stop' | 'onStateChange'>
  windows: {
    showWizard(): Promise<'completed'>            // 向导完成才 resolve
    showMain(baseUrl: string): void
    showError(diag: string, restart: () => void): void
    focusMain(): void
  }
  storage: { isFirstRun(): boolean; completeFirstRun(): void }
  updater: { checkAndNotify(): Promise<void> }
  lock: { acquire(): boolean; onSecondInstance(cb: () => void): void }
  log(msg: string): void
}
export function createApp(deps: AppDeps): { init(): Promise<void>; shutdown(): Promise<void> }
```

**行为规格（每条一个测试）：**

- [ ] **Step 1: 失败测试——标准启动顺序**：`init()` 依序——lock.acquire → storage.isFirstRun → engine.start（拿到 baseUrl）→ 首启则 showWizard（完成→completeFirstRun）→ showMain(baseUrl) → updater.checkAndNotify（后台，不 await 阻塞 init）
- [ ] **Step 2: 失败测试——二次实例**：acquire()=false 时不 engine.start、不 showMain，注册 onSecondInstance → 回调触发 windows.focusMain()
- [ ] **Step 3: 失败测试——引擎崩溃**：engine.onStateChange 回调 'crashed' → windows.showError（诊断文本透传）且 restart 回调会重新 engine.start 并 showMain
- [ ] **Step 4: 失败测试——启动失败**：engine.start reject → showError（诊断透传），不崩进程
- [ ] **Step 5: 失败测试——shutdown 清理**：shutdown() await engine.stop()；stop 抛错也吞掉（退出流程不因引擎僵死而挂起）
- [ ] **Step 6: 跑全部失败**
- [ ] **Step 7: 最小实现**——纯逻辑组合，不 import electron（这是可测性的根基）
- [ ] **Step 8: 跑通过**（Run: `npx vitest run tests/unit/app-service.spec.ts`）
- [ ] **Step 9: Commit** `feat: AppService 组合根（启动编排/崩溃恢复/退出清理）`

---

### Task 7: Electron 接线（入口/窗口/实例锁）

**Files:**
- Create: `src/main/index.ts`, `src/main/windows.ts`
- Modify: `package.json`（确认 main 字段指向产物）

说明：真实 BrowserWindow 逻辑不在单测覆盖（组合根已测），本任务以「实现 + 手动验收步骤」为主。

- [ ] **Step 1: windows.ts**——三个窗口工厂：主窗口（`loadURL(baseUrl)`，`contextIsolation: true`，`nodeIntegration: false`）；向导窗口（`loadFile('renderer/wizard/index.html')`，固定尺寸 480×640，模态）；错误窗口（`loadFile('renderer/engine-error/index.html')`，IPC 接重启回调）
- [ ] **Step 2: index.ts**——`app.requestSingleInstanceLock()` 失败即 `app.quit()`；`second-instance` → focusMain；`window-all-closed` → 触发 shutdown 后 quit；把真实依赖（createEngineProcess + 真端口探测 + taskkill + electron-updater + storage）注入 `createApp`；`app.whenReady().then(app.init)`；进程退出钩子确保 engine.stop 完成（`app.on('before-quit')` + will-quit 延迟）
- [ ] **Step 3: 构建 + 手动验收**

Run: `npm run build && npx electron dist/main/index.js --dev`（--dev 时引擎指向本机已存在的 DSH 或跳过——见 Step 4 前置说明）
Expected: 窗口出现；无引擎时显示错误页且「重启」可点

- [ ] **Step 4: Commit** `feat: Electron 主进程接线（窗口/实例锁/生命周期）`

---

### Task 8: 首启向导 + 凭据写入

**Files:**
- Create: `renderer/wizard/index.html|.js|.css`, `src/preload/wizard.ts`
- Modify: `src/main/windows.ts`（向导完成回调接 credentials 写入）

- [ ] **Step 1: preload**——`contextBridge.exposeInMainWorld('wizard', { submit: (data) => ipcRenderer.invoke('wizard:submit', data) })`
- [ ] **Step 2: 向导页**——两步表单：①API Key（`sk-` 前缀校验）②工作区文件夹（`dialog.showOpenDialog` 由主进程经 IPC 代理）；提交 → `wizard.submit({ apiKey, workspace })`
- [ ] **Step 3: 主进程处理**——写 `$DSH_HOME/.credentials.yaml`：`DEEPSEEK_API_KEY: <key>\n`（**格式已核实**：单键扁平 YAML）；工作区写入 app-state.json；resolve 'completed'
- [ ] **Step 4: 手动验收**——删 `%APPDATA%/DSH-Desktop/` 后 `npm run dev`：向导出现 → 填 Key 选目录 → 进入主界面；重启直接进主界面
- [ ] **Step 5: Commit** `feat: 首启向导（API Key + 工作区）`

---

### Task 9: 运行时 staging + 真引擎冒烟 + 孤儿清理

**Files:**
- Create: `scripts/download-node.ts`, `scripts/stage-runtime.ts`, `src/main/orphan-cleaner.ts`
- Test: `tests/integration/engine-smoke.spec.ts`, `tests/unit/orphan-cleaner.spec.ts`

**⚠ 借鉴评审点（SPEC 要求）**：社区项目用 `stage-runtime.ts` + afterPack 校验。替代方案对比：①`electron-builder` 的 extraResources 直接声明 node_modules（需保留完整安装树、易漏原生模块）②esbuild 打包引擎（原生模块不可打）。**结论写进 PR 描述**：staging 脚本方案胜出（可控、可校验），但实现从零写，仅在结构思路上参照。

- [ ] **Step 1: download-node.ts**——下载 `https://nodejs.org/dist/latest-v24.x/node-v24.19.0-win-x64.zip`（URL 已验证），解压 `node.exe` 至 `resources/runtime/`；校验 sha256（硬编码进脚本）
- [ ] **Step 2: stage-runtime.ts**——`resources/engine/` 下生成 `package.json`（`{"dependencies":{"@deepseek-ai/dsh":"0.1.0-rc.6"}}`）并 `npm install --omit=dev`；输出清单（bin.js 存在性、node_modules 顶层计数）
- [ ] **Step 3: 孤儿清理单测+实现**——注入 `listProcesses()`（真实实现 = PowerShell `Get-CimInstance Win32_Process` 过滤命令行含 `<app>\resources\engine`）；启动时对匹配且非本次 pid 的进程 taskkill
- [ ] **Step 4: 真引擎冒烟测试**（`tests/integration/engine-smoke.spec.ts`，标记 `#slow`）：

```ts
it('staged 引擎：启动→健康→boot 图→停止无残留', { timeout: 180_000 }, async () => {
  const port = await pickFreePort()
  const engine = createEngineProcess(realPaths(), port, realDeps())
  const { baseUrl } = await engine.start()
  const html = await fetch(baseUrl).then(r => r.text())
  expect(html).toContain('__DSH_BOOT__')            // 引擎真实服务中
  expect(html).toContain('dsh-web-app')             // web 档插件在列
  await engine.stop()
  await expectNoProcessListening(port)              // 进程已清
})
```

（带 `DEEPSEEK_API_KEY` 的本地跑法进阶断言 greet——CI 无 Key 不跑，门禁脚本 `npm run smoke:local` 提供）

- [ ] **Step 5: 跑通**（Run: `npx vitest run tests/integration --timeout 180000`；首次需 `npm run stage`）
- [ ] **Step 6: Commit** `feat: 运行时 staging + 真引擎冒烟门禁 + 孤儿清理`

---

### Task 10: 打包、发布冒烟与 CI

**Files:**
- Create: `electron-builder.yml`, `tests/e2e/packaged-app.spec.ts`, `.github/workflows/ci.yml`, `scripts/verify-packaged-runtime.ts`

- [ ] **Step 1: electron-builder.yml**——`appId: io.github.to-real.dsh-desktop`（避开社区项目 appId）、`productName: DSH-Desktop`、win nsis、`extraResources: [{from: resources, to: resources}]`、`publish: {provider: github}`、`afterPack: scripts/verify-packaged-runtime.ts`（断言产物内 node.exe + bin.js + node-pty .node 存在）
- [ ] **Step 2: 发布冒烟**（Playwright `_electron`）：`electron.launch({ args: ['<win-unpacked>/DSH-Desktop.exe'] })` → 断言首个窗口 loadURL 以 `127.0.0.1:` 开头且 5s 内页面含 `__DSH_BOOT__` → app quit 后无 node 子进程
- [ ] **Step 3: 本地全链验收**——`npm run dist` 产出安装包 → 安装到干净路径 → 双击：向导→主界面全流程；二次双击聚焦不双开；关窗后任务管理器无 node 残留
- [ ] **Step 4: CI**——push/PR：typecheck + unit + build；tag `v*`：stage + dist + 冒烟 + `electron-builder --publish always`（GitHub Releases）；README 补 SmartScreen 说明与下载徽章
- [ ] **Step 5: Commit** `feat: 打包/发布冒烟/CI 全链`；PR 合入 `feat/mvp-shell` → main，Issue #1 关闭

---

## 验收总表（对照 SPEC 用户故事）

| 故事簇 | 验收手段 |
|---|---|
| 安装/首启 1-6 | Task 8 手动验收 + Task 10 Step 3 全链 |
| 日常 7-13 | Task 6 单测（顺序/聚焦）+ Task 10 冒烟 |
| 更新 14-16 | Task 10（updater 配置）+ 关于页版本（Task 7 附带） |
| 可靠 17-18 | Task 3/4 单测（超时诊断/树杀）+ Task 9 孤儿清理 |
| 维护 20-25 | Task 9 冒烟即门禁；接缝测试全绿 = 23-25 |

## 执行提醒

- 遇阻塞（如 Electron 43 与 builder 兼容、npm 引擎告警）→ 停下按 executing-plans 规则上报，勿自行改架构决策
- Task 9/10 触碰「借鉴评审点」时，PR 描述必须写对比结论
- 引擎版本升级流程（周更）：改 stage-runtime.ts 里的 pin → `npm run stage` → 跑 integration 冒烟 → 绿才合
