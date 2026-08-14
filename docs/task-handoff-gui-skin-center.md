# 任务交接：DSH Web GUI 内嵌「皮肤中心」（client 插件�?
> **已完成（2026-08-08，提�?8577428�?*：本任务已按本文实施完毕并通过全部验收—�?> 见文末「完成记录」。以下内容保留为实施档案与维护参考�?>
> 给下一�?Agent / 新会话的任务 Prompt。本会话已完成「网�?Gallery + 试穿模拟器」阶段，
> 本任务做约定的第二阶段：把皮肤预�?切换内嵌进真�?dsh Web GUI�?> 执行前请通读本文件；与本文件冲突时，�?dsh-customize skill 和当�?checkout 实际代码为准�?
---

## 0. 一句话目标

在真�?dsh Web GUI�?27.0.0.1:3080）内嵌一个「皮肤中心」：列出已安装皮�?�?真实 GUI 内试�?（加载皮�?bundle，即时生效、退出完全还原，支持�?暗）�?应用（持久化切换皮肤）。做成一�?hot-pluggable client 插件，风格与现有皮肤一致�?
## 1. 必须遵守的约束（先做这几件事�?
1. **先加�?`dsh-customize` skill** 并按其指引操�?dsh checkout（本任务必然改动 checkout 的文�?配置）�?   特别留意�?*不要直接编辑 personal staging checkout**（`~/.dsh/source/staging-*`），�?skill 说明�?   安全方式处理（如另行 clone/worktree 或按其规则操作）�?2. 皮肤仓库（本任务源码的存放地）：`/Users/zcl/code/dsh-web-ui`（git，private，已提交全部前期成果）�?3. dsh 运行�?checkout：`~/.dsh/source/current` �?目前指向 `staging-20260807T131726Z`�?4. 皮肤是纯呈现层（既有约定）：不注入服务、不�?cordis 事件、不触及模型请求。皮肤中心是管理插件�?   可放宽到「只�?UI + 试穿/应用」，但同样不得触及模型请求�?5. 不要在用户的 `~/.dsh/cordis.patch.yml` 上做破坏性实验（那是用户个人配置，dsh-skin 在维护它）�?6. 完成时保持「同一时刻只接一个皮肤」的互斥约定�?
## 2. 已有成果（可复用资产，全部已提交�?
- **皮肤集合** `/Users/zcl/code/dsh-web-ui/packages/skins/<name>/`：qq98 / ths / xp / blue-fantasy，每个是
  hot-pluggable client 插件，含 `skin.json`（id/name/tagline/tags/accent/bodyAttr/package/wiring/preview）�?  `lib/client.js`（预构建 bundle）、`preview/{light,dark}.png`�?- **网页 Gallery + 试穿模拟�?* `gallery/`：`index.html`（主题库首页）、`preview.html`（模拟器—�?  **已实现「真实执行皮�?bundle�?*：shim `window.__ModuleLoader__` 捕获 `exports.apply`，用最�?  ctx `{effect(cb){disposers.push(cb())}}` 调用，皮肤标题栏/状态栏/样式真实渲染）�?  `official-facade.js`（官�?GUI 样式+脱敏 DOM 快照）、`manifest.js`/`bundles.js`（生成产物）�?- **`scripts/dsh-skin`**：一键切�?CLI。机制要点（内嵌版要复用/参考）�?  - 维护 `~/.dsh/cordis.patch.yml` 里一段互斥皮肤配置（`# --- dsh-skin managed ---` 段）�?    目标皮肤 `- insert: { - id: ui-skin-xxx, name: '@deepseek-ai/dsh-client-ui-skin-xxx' }`�?    其余皮肤 `- id: ui-skin-xxx\n  disabled: true`；配�?watcher 热重载，几秒生效，刷新页面即可见�?  - 维护 profile node_modules symlink：`~/.dsh/profiles/node_modules/@deepseek-ai/<pkg>` �?    皮肤源码目录（qq98/ths/xp/blue-fantasy 均指向仓�?`packages/skins/<name>`）�?    皮肤中心插件源码建议同样放仓库内（如 `dsh-web-ui/packages/skins/skin-center/`），�?symlink 解析，避免把
    源码塞进 checkout�?- **`scripts/export-official-facade` / `gallery-build` / `capture-previews`**：截图与快照管线（内嵌版截图可复用）�?
## 3. 关键技术事实（已调研确认，省去重复摸索�?
### 皮肤插件如何工作
- bundle 结构：`lib/client.js` = `window.__ModuleLoader__.load({id, factory})`；factory 执行时注�?CSS
  （`<style data-plugin-css=...>`，guard 为不存在才注入），`exports.apply` 是挂载入口�?- `apply(ctx)` 只依�?`ctx.effect(cb, label)`（cb 返回 disposer）——所以任何地方都能用最�?ctx 驱动�?  （网页模拟器已验证；真实 GUI 内同样可行）�?- 皮肤样式作用域：`body[data-dsh-<name>]`，暗色变�?`body[data-ds-dark-theme]`（body 属性）�?- 面板钩子：`ui-layout` AppFrame �?`[data-pane='sidebar'|'conversation'|'details']`、`#root`�?  sidebar `:first-child`（品牌区�?`:last-child`（footer，含 `button[aria-haspopup='dialog']` 设置入口）�?
### client 插件如何加载（checkout 内）
- `packages/client/modules`：Node 侧扫�?`dsh.client` 声明组合 boot manifest �?注入
  `window.__DSH_BOOT__`（entries: id/url/rev/inject/immediately）；浏览器侧 `ClientModuleLoader`
  （`ctx.modules`，有 `import(specifier)` 异步 API；bundle 端点 `/plugins/<id>/client.js?rev=<rev>`）�?- 接入一个新 client 包需要：packages/client/ 下建包（或可解析依赖�? `web.cordis.yml`/patch �?  `dsh.client` �?+ `apps/cli/package.json` deps + `tsconfig.client.json` references + `pnpm install` +
  重启 `dsh web`。参�?`packages/skins/qq98/README.md` 的完整接线流程�?- 设置页注册先例：`packages/client/locale/src/client/index.ts` �?  `ctx.slots.inject('settings.general.item', () => ctx.slots.register({ name: 'settings.general.item', ... }))`
  注册设置行（inject 拿到 actions）。皮肤中心入口可走同一 slot，或找更合适的（ui-settings 的其�?hole）�?
### 运行时环�?- GUI 正在 `http://127.0.0.1:3080` 运行（当前挂着 blue-fantasy 皮肤，patch �?blue-fantasy �?ACTIVE）�?- `~/.dsh/cordis.patch.yml` 被配�?watcher 热重载；dsh-skin �?managed 段格式见上�?
## 4. 必须先做的三项调研（结论决定实现方案，做完写进任务记录）

1. **动态加载非 boot 图条目的可行�?*：皮肤中心要试穿未接线的皮肤，需要运行时加载�?bundle�?   - 路径 A：`ctx.modules.import(pkg)` —�?验证它对「未�?boot manifest 里、但已注�?可解析」的包是否可用；
     或先 `fetch('/plugins/<id>/client.js')` + `<script>` 注入让真�?loader 注册，再 import�?   - 路径 B（网页模拟器已验证的兜底）：直接 `eval(bundle 文本)` �?shim 路径调用 `exports.apply(miniCtx)`�?     自己管理 style 标签清理。真�?GUI 页面�?eval 同样可行（window/document 都在），但要与真�?loader
     共存：bundle �?CSS 注入 guard 基于 `style[data-plugin-css]`，试穿后需要手动移�?style 标签�?     皮肤注入�?DOM（调�?dispose）�?*注意**：若当前已激活皮肤（patch 接线），试穿要与之互斥：
     试穿 = 先记录当前皮�?�?卸载当前（若可）或叠加处�?�?应用试穿皮肤 �?退出时还原�?   - 至少验证两个 bundle �?`apply` 在同一页面先后执行/dispose 不冲突（qq98 �?blue-fantasy）�?2. **应用（持久化）通道**：浏览器无法�?`~/.dsh/cordis.patch.yml`。调研是否存在宿主侧通道�?   - cordis v4 配置 API（`ctx.scope.config` / 配置热重载接口）有没有被 web-runtime 暴露�?   - `apps/cli` / web 宿主有没有任�?config 写端点（grep `httpServer` 路由、`config` patch 相关代码）；
   - 若无通道：降级方�?= 试穿即时生效 + 「应用」按钮复�?`dsh-skin use <name>` 命令（与网页 Gallery 一致）�?     或复�?patch 段让用户粘贴�?*不要**为了写配置去�?web 服务端（除非调研确认有干净的扩展点）�?3. **皮肤枚举**：列出已安装皮肤。候选：
   - 皮肤中心内置注册表（静态列表，�?`scripts/dsh-skin` �?SKINS 一致，�?pkg/id/dir）；
   - 或读�?boot manifest �?`ui-skin-*` 条目 + 本插件自�?manifest�?   - 截图路径�?`packages/skins/<name>/preview/{light,dark}.png`（本地文件，插件内联�?HTTP 可达才可用；
     file:// 图片�?GUI 页面里引用仓库路径不可行 �?优先用内置注册表 + 描述文本，截图可选）�?
## 5. 推荐实现方案（供参考，以调研结果为准）

- 新包：`@captain1275/dsh-client-ui-skin-center`（id：`ui-skin-center`），源码�?  `/Users/zcl/code/dsh-web-ui/packages/skins/skin-center/`（含 package.json/dsh.client 声明/tsdown.config.ts/
  src/client/，预构建 `lib/client.js`），checkout 内通过 profile symlink 解析（仿 qq98 �?dsh-skin 模式）�?- 入口：设置页新增「皮肤」分�?行（settings.general.item slot �?ui-settings 更合适的 hole），
  �?sidebar footer 旁入口；点击打开面板�?- 面板内容：皮肤列表（名称/tagline/强调�?截图可选）→「试穿」→ 皮肤立即在真�?GUI 生效
  （含标题�?状态栏�?chrome）→ �?暗切换（body[data-ds-dark-theme]）→「退出试穿」完全还�?  →「应用」持久化（通道见调�?2，无通道则复制命令）�?- 试穿实现细节：优先调研路�?A；路�?B �?shim 逻辑可直接参�?`gallery/preview.html` �?`loadSkin()`�?- 皮肤中心自己的样式也挂独�?body 属性（`body[data-dsh-skin-center]`），�?暗自适应�?  风格与官方设置页一致（复用 token，别破坏既有观感）�?- 与网�?Gallery 的关系：内嵌版是真实 GUI 里的「试穿」；网页版保持现状�?
## 6. 验收标准（全部满足才算完成）

- [ ] 插件�?dsh-customize skill 的规范接入，`dsh web` 重启后设置页出现「皮肤」入口，�?console 报错�?- [ ] 列表展示 �? 个皮肤（名称/tagline/强调色），当前激活皮肤有标记�?- [ ] 试穿：任一皮肤在真�?GUI �?chrome（标题栏/状态栏/背景）真实生效；�?暗切换正�?      （blue-fantasy 背景遮罩随动）；退出试穿后 DOM/样式/标题完全还原（与试穿前快照一致）�?- [ ] 试穿与既有激活皮肤的互斥处理正确：试穿时不出现两套标题栏；结束后当前皮肤恢复�?- [ ] 应用：按调研 2 的通道持久化并热重载生效；若无通道，复制命令可用且文案明确�?- [ ] 回归：现有皮肤切换（dsh-skin CLI）、网�?Gallery、官�?GUI 功能不受影响�?- [ ] e2e 证据：playwright �?127.0.0.1:3080 的试�?切换/还原全流程截图，提交入库
      （放 `packages/skins/skin-center/preview/` �?README 引用）�?- [ ] 交付：源�?+ 预构�?bundle + README（接�?构建/限制�? 截图；提交信息清晰；�?push 未经确认的提交�?
## 7. 建议的交接检查点（中途汇报时回答�?
1. 三项调研的结论（动态加载可行�?/ 应用通道 / 枚举方式）与证据（代码位置、测试输出）�?2. 试穿最小原型是否跑通（哪个皮肤、截图）�?3. 互斥与还原策略的最终方案�?4. 剩余工作与风险�?
## 8. 相关路径速查

- 皮肤仓库：`/Users/zcl/code/dsh-web-ui`（README 有完整架构说明）
- checkout：`~/.dsh/source/current`（勿直接�?staging；按 dsh-customize skill�?- 用户配置：`~/.dsh/cordis.patch.yml`、`~/.dsh/profiles/node_modules/@deepseek-ai/`
- GUI：`http://127.0.0.1:3080`（正在运行）
- 参考实现：`gallery/preview.html`（模拟器 loadSkin）、`scripts/dsh-skin`（patch 格式）�?  `packages/skins/qq98/`（插件模板）、`packages/client/locale`（settings slot 先例）�?  `packages/client/modules`（client 模块系统�?
---

## 完成记录�?026-08-08，提�?8577428�?
**三项调研结论**�?
1. **动态加�?*：非 boot 皮肤 bundle 端点 404（`clientModuleHost` 只为启用条目服务）�?   采用路径 B �?*真实 loader �?*：`;(0, eval)(bundle)` 注册到页面自�?   `window.__ModuleLoader__`，`window.__DSH_MODULES__.import(package)` 物化（CSS 自动注入），
   `surface.apply(miniCtx)` 挂载；bundle 文本内嵌进皮肤中心自己的 client bundle
   （`scripts/skin-center-bundles` 生成 `packages/skins/skin-center/src/client/generated/skins.ts`）�?2. **应用持久�?*：无干净通道——settings API 只覆盖注册命名空间（�?loader 配置）、apiProxy
   固定、无配置写端点；按约定降级为「Apply」复�?`dsh-skin use <name>` 命令（en/zh 文案）�?3. **皮肤枚举**：内嵌注册表（skin.json 契约�? 激活检测读 `window.__DSH_BOOT__.entries`（仅启用条目）�?
**实现**：`packages/skins/skin-center/`（`@captain1275/dsh-client-ui-skin-center`，id `ui-skin-center`）—�?插件配置�?Web UI 插件组（`web-ui.plugin.item` 槽，�?`packages/dsh-web-ui-settings` 的组卡声明）
注册皮肤中心卡片；试穿引�?`try-on.ts` 按配方收回激活皮肤视觉写�?（body 属�?/ 背景内联样式 / body 直接�?chrome / xp footer taskbar 中性化 CSS），退出后快照
原样恢复；中性化观察器防 blue-fantasy 幽灵背景写回。接线：profile symlink +
`cordis.patch.yml` 的独�?`# --- dsh-web-ui skin center ---` 段（dsh-skin managed 段之外，
已回归验证重写不破坏）�?026-08-12 起入口从设置页一级分区（`settings.section`）迁�?Web UI 插件组卡片，�?task-board / pet / live-stats 同槽位，皮肤中心不再占设置页一级导航�?
**验收**：全部满足——设置页入口、≥4 皮肤列表 + Active 标记、qq98/xp/ths 试穿真实生效
（像素采样验证：qq98 #4981c6/#28558e、ths #e10011、xp 渐变顶）、亮/暗、退出完全还原�?双向互斥（blue-fantasy 激活试�?qq98 / qq98 激活试�?ths）、无泄漏（最终仅 blue-fantasy +
skin-center 自身 style 标签）、dsh-skin CLI 与网�?Gallery 回归通过。e2e 截图
`docs/e2e/skin-center/`�?2 张）入库�?
**维护要点**：皮�?bundle/元数据变更后重跑 `node scripts/skin-center-bundles` 并按
`packages/skins/skin-center/README.md` �?checkout worktree 重建 lib�?**设计修订�?026-08-12，审查延后项落地�?*：试穿加载改�?*按需 + �?eval**—�?`generated/skins.ts` 只保留元数据（不再内�?~700KB bundle 文本），host 新增
`/api/skin-center/bundle/<id>` 路由按需提供 `lib/client.js`（同�?script 标签，与内核
defaultLoadBundle 同机制）；`try-on.ts` 不再 `(0, eval)`，改�?script 注册 +
`__DSH_MODULES__.import` 物化。冷启动不再解析内嵌 base64；生成文件不含构建机绝对路径�?CSP 无需 `unsafe-eval`�