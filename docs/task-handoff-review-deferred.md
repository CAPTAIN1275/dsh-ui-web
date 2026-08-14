# 任务交接：代码审查「明确延后」项的处理

> 给下一个 Agent / 新会话的任务 Prompt。本会话完成了一次全仓库代码审查
> （bug / 安全 / 性能 / 可靠性），约 36 处问题已修复并通过全仓 typecheck + 测试。
> 有 4 项被判定为「较大重构」而明确延后，本文是它们的完整交接说明。
> 执行前请通读本文；与本文件冲突时，以仓库当前实际代码为准。
> 仓库根：/Users/zcl/code/dsh-web-ui（git，private，push 已放开）。

---

## 0. 背景与现状

- 已完成：全插件（aionui-panel / git-graph / pet / live-stats / remote-web-ui /
  task-board / web-ui-settings / skins）与构建脚本的安全、正确性、性能修复，
  全部通过 `pnpm -r typecheck` 与 `pnpm -r test`。
- 本文 4 项是审查中被判定为「架构级 / 生成器级重构」而刻意没有动手的项。
  它们的风险点已确认，但改动会影响生成器输出、构建产物或渲染热路径，
  需要独立验证，不适合与本次修复混在一个提交里。

---

## 1. 皮肤中心：700KB base64 注册表按需加载（性能）

- 位置：`packages/skins/skin-center/src/client/generated/skins.ts`（约 705KB，
  `SKIN_CENTER_ENTRIES` 内联了每个皮肤的预构建 bundle 文本）。
- 问题：该文件被 `SkinCenter.tsx` 顶部静态 import，导致 GUI 每次启动都解析并
  驻留全部 base64 内容（含 blue-fantasy 约 225KB 的 JPEG、dragon-heir 两幅约 160KB
  的 WebP），即使用户从不打开皮肤中心卡片。
- 目标：把大块 bundle / 美术资源改为按需加载——仅在实际试穿 / 应用该皮肤时才
  解析对应文本。
- 方向（任选其一，以调研结果为准）：
  1. 按皮肤拆分为独立 chunk，`try-on.ts` 用动态 `import()` 按需取；或
  2. 把美术 base64 从 bundle 里拆出，改为 fetch-on-demand 的资源（走现有
     `/aionui-panel/raw` 或皮肤自身静态路由）。
- 注意：`scripts/skin-center-bundles` 是生成器，改加载方式通常要同步改生成器
  与 `try-on.ts` 消费端，改完必须重跑 `node scripts/skin-center-bundles` 并让
  `--check` 通过，且试穿 / 应用 / 退出还原的全流程 e2e 不回归。
- 验收：GUI 冷启动不再解析 700KB；打开皮肤中心与试穿仍正常；`skin-center-bundles --check`
  通过；打包体积明显下降（对比 gzip）。

## 2. 皮肤中心：`(0, eval)` 的 CSP 依赖（安全/可维护性）

- 位置：`packages/skins/skin-center/src/client/try-on.ts` 的 `loadAndApply`，
  用 `;(0, eval)(entry.bundle)` 执行内嵌 bundle。
- 现状定性：bundle 是构建期生成、可信的（非用户输入），故当前不是 XSS 向量；
  但它依赖页面 CSP 允许 `eval`，且与文档化的 `window.__ModuleLoader__.load` 交接重复。
  一旦 CSP 收紧（如加 `unsafe-eval` 白名单移除），试穿会静默失效；若未来生成器
  有 bug 把不可信文本拼进 bundle，这里就是代码执行 sink。
- 目标：去掉 `eval`，改走 `window.__ModuleLoader__.load(...)` / `__DSH_MODULES__`
  的 fiber 交接（把注册与物化分开），或至少白名单化已知 registry id；同时在 README
  明确 CSP 要求与失败语义。
- 注意：需回归验证「试穿两个皮肤先后 apply/dispose 不冲突」与「退出完全还原」
  （参考 `tests/try-on.spec.ts` 与 `gallery/preview.html` 的 shim 路径）。

## 3. 皮肤中心：生成产物内嵌开发者绝对路径（可复现性/信息泄露）

- 位置：`scripts/skin-center-bundles` 生成 `generated/skins.ts` 时，CSS-module 的
  region 标记里带 `//#region \0dsh-css:/Users/zcl/code/dsh-web-ui/packages/skins/...`
  这类构建机绝对路径。
- 问题：把开发者本机用户名 / 目录结构写进入库产物，且使生成文件跨机器不可复现。
- 目标：生成器输出路径无关的模块 id（如用包名 + 相对 src 路径的稳定 key），使
  `generated/skins.ts` 确定性可复现、不泄露本机路径。
- 验收：换一台机器 / 改仓库父目录后重跑 `node scripts/skin-center-bundles`，
  `git diff` 只出现预期差异；`--check` 通过；grep 产物无 `/Users/` 等绝对路径。

## 4. live-stats：projection 的 O(n^2) surface 记账（性能）

- 位置：`packages/dsh-live-stats/src/projection.ts` 的 `applySurface` /
  `applyOutputChunk` / `outputTokens`。
- 现状：`applySurface` 每条 surface 消息 append 一个节点、replace 用两次 O(n)
  `findIndex`；`applyOutputChunk` 每个 delta 复制整个 `blocks` 数组；
  `outputTokens` 每次重算所有 block 之和。长会话下每个 chunk 做 O(blocks) 工作，
  且 `surface` 数组只增不减。
- 目标：用 `Map<seq, tokens>` 做 O(1) 定位/删除，维护增量 running sum 而非每次
  重扫；确认 `surfaceTokens` 累计语义不变。
- 注意：`projection.ts` 是纯可回放 fold，改动必须保持 replay 结果逐字节一致——
  以 `tests/projection.spec.ts` 现有断言为回归基线，必要时补长会话 / 高频 delta 基准。
- 验收：单测全绿；对 10k+ block 的会话，单 chunk 处理时间从 O(n) 降到近 O(1)。

---

## 通用约束与验收

- 遵循仓库 AGENTS.md：禁止 emoji、禁止修改 DSH 源码 checkout、禁止 push / npm publish、
  新包 `dsh-` 前缀、构建预设统一用 `shared/tsdown.client.ts`。
- 每项改完跑对应包 `typecheck` + `test`（皮肤相关另跑 `node scripts/skin-center-bundles --check`
  与 `node scripts/gallery-build --check`）。
- 改动涉及生成器时，重跑生成器并核对产物 diff 是否只含预期差异。
- 交付：源码 + 必要的生成产物 + 回归证据（测试输出 / 截图），提交信息清晰，不 push。
---

## 落地记录（2026-08-12 落地）

四项均已落地（与上文方向一致，以实际代码为准）：

1. 按需加载：`generated/skins.ts` 改为**仅元数据**（722KB -> 5KB，冷启动不再解析内嵌
   base64）；host 新增 `/api/skin-center/bundle/<id>` 前缀路由按需提供 `lib/client.js`。
2. 去 eval：`try-on.ts` 改用同源 `<script>` 标签加载 bundle（与内核 defaultLoadBundle 同机制），
   `__ModuleLoader__.load` 注册 + `__DSH_MODULES__.import` 物化；加载前 `invalidate` 清残留，
   不再需要重复注册重试。CSP 要求与失败语义写入 skin-center README。
3. 可复现：bundle 文本移出生成产物后，`generated/skins.ts` 不含任何构建机绝对路径
   （grep `/Users/` 为 0），换机器重跑 `--check` 通过。（残余：各皮肤 `lib/client.js` 的
   `//#region \0dsh-css:` 注释仍带本机构建路径，属 shared/tsdown.client.ts 虚拟 id 设计，
   不影响运行，未在本次范围。）
4. live-stats：`surface` 改 `Map<seq, tokens>`（append O(1)、replace 单遍）；blocks 槽位原地写
   + `pricedTokens/pricedBlocks` 增量记账，单 chunk 由 O(blocks) 降到近 O(1)——基准：
   10k blocks 时 38.7us -> 83ns/次，100k blocks 时 551us -> 74ns/次；`stateVersion` 1 -> 2。

回归：全仓 `pnpm -r typecheck` / `pnpm -r test` 通过（live-stats 20 项、skin-center 21 项），
`skin-center-bundles --check`、`gallery-build --check`、`node --test scripts/*.test.mjs` 通过；
新增 3000-delta 重扫等价回归与结构不变性测试。