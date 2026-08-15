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

> 状态：实施中（feat/mvp-shell）。
