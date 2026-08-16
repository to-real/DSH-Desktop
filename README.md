> **本项目已演化 → [Efferent](https://github.com/to-real/Efferent)**
>
> 定位从「DSH 的桌面壳」升级为独立 agent 产品（对标 Codex/Claude 桌面版，DSH 为隐形引擎）。
> 全部工程底盘（引擎管理/打包/更新/CI）已继承至新仓库；本仓库归档留档。

# DSH-Desktop

基于 DeepSeek Harness 的开箱即用 Windows 桌面应用（Electron + sidecar 引擎）。

## 开发

```bash
npm install                 # 国内网络建议：ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
npm run test:unit           # 单元测试（假依赖，秒级）
npm run stage               # 下载 Node 24 + 安装 @deepseek-ai/dsh 到 resources/（首次必跑）
npm run dev                 # 启动开发态应用
npm run test:integration    # 真引擎冒烟（需先 stage）
npm run dist                # 出 NSIS 安装包
```

- 规格：`docs/specs/0001-dsh-desktop-mvp.md`
- 实施计划：`docs/plans/2026-08-15-dsh-desktop-mvp.md`

## 安装（Windows）

从 [Releases](https://github.com/to-real/DSH-Desktop/releases) 下载 `DSH-Desktop-x.y.z-x64-setup.exe` 安装。

> **SmartScreen 提示**：本应用当前未购买代码签名证书，首次运行可能弹出「Windows 已保护你的电脑」——点击「更多信息」→「仍要运行」即可。有真实用户后将接入代码签名消除该提示。

> 状态：v0.1（阶段 1 · 壳）已实现。
