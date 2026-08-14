# __NAME__ — DSH Web GUI 插件

（由 `node scripts/dsh-plugin-new __NAME__` 生成的骨架。完成后把本文件替换为
真实说明。）

## 安装

本仓库是插件 monorepo，`packages/__NAME__` 即插件包。安装到 DSH profile：

```
dsh plugin --profile web add link:<本仓库绝对路径>/packages/__NAME__
```

例如本机：

```
dsh plugin --profile web add link:/Users/zcl/code/dsh-web-ui/packages/__NAME__
```

若已把 `- ../__NAME__` 加入 `packages/dsh-web-ui-all/aggregate.yml`（patchFrom 与
deps），跑 `node scripts/aggregate.mjs` 后装聚合包
（`dsh plugin --profile web add link:/Users/zcl/code/dsh-web-ui/packages/dsh-web-ui-all`）
即可连同本插件一次到位。

## 结构

- `src/index.ts` — host 半区入口：运行在 DSH host 进程（如 SystemPrompt 声明）。
- `src/client.ts` — browser 半区入口：运行在 Web GUI（/plugins/ui-__NAME__/client.js）。
- `cordis.patch.yml` — bundle patch 插件行（id `ui-__NAME__`）。
- `tsconfig.json` / `tsdown.config.ts` — 构建与类型（paths 为绝对路径，参照 task-board）。
