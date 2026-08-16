# 如何把新插件加入全家�?
本指南说明如何把一个新插件加入 dsh-web-ui 全家桶，使其可以被聚合插件包（`dsh-web-ui-all` / `dsh-skins`）一键装齐，也可独立安装�?
## 流程

### 1. 脚手架生�?
```sh
node scripts/dsh-plugin-new <name>
```

�?`packages/<name>/` 生成标准 bundle 骨架（`<name>` 限小写字母、数字、单连字符，�?`dsh-task-board`），并替换模板中�?`__NAME__` 占位。生成的结构�?
```text
packages/<name>/
├── cordis.patch.yml   # 插件行（- insert: - id: ui-<name> / name: ...�?├── package.json       # dsh.bundle.patch 清单 + dsh.client 声明
├── src/
�?  ├── index.ts       # host 半区（node 进程侧）
�?  └── client.ts      # browser 半区（Web GUI 侧）
├── tsconfig.json
├── tsdown.config.ts
└── README.md
```

### 2. 实现插件逻辑

- host 半区 `src/index.ts`：导�?cordis 插件，运行在 dsh host 进程（例如系统提示词公告、真实任务执行等）�?- browser 半区 `src/client.ts`：Web GUI 侧的 UI 逻辑，经 package.json �?`dsh.client` 声明注入运行时�?- 形态参�?`packages/dsh-task-board/`：`dsh.bundle.patch` 指向包内 `cordis.patch.yml`；`dsh.client` 声明 `inject: ["@deepseek-ai/dsh-client-runtime"]` �?`platform: "web"`�?
### 3. 注册进聚合包

�?`- ../<name>` 追加�?`packages/dsh-web-ui-all/aggregate.yml` �?`patchFrom` �?`deps` 两段�?
- `patchFrom`：该包的 `cordis.patch.yml` insert 行会被汇总进聚合�?patch�?- `deps`：解析为包名写入聚合�?`package.json` �?`dependencies`（`workspace:*`）�?
皮肤（新增或改动）不需要进任何 aggregate.yml：`packages/dsh-skins/build.mjs` 会把 `packages/skins/<id>` �?`skin.json` + `lib/client.js` 复制�?`dsh-skins/skins/<id>`（npm 上皮肤资产全部内置在 dsh-skins 一个包里，避免为每个皮肤包名付 npm 新包名费用）。改完皮肤后运行 `pnpm --filter @captain1275/dsh-skins build`。皮肤启用互斥由 `dsh-skin use` 管理（`~/.dsh/cordis.patch.yml` managed 区段）�?
### 4. 重新生成聚合�?
```sh
node scripts/aggregate.mjs          # 重新生成聚合�?cordis.patch.yml + 依赖
node scripts/aggregate.mjs --check  # 校验模式：任何漂移以退出码 1 报错（CI 用）
```

### 5. 构建验证

```sh
pnpm install   # workspace 链接（packages/* �?packages/skins/*�?pnpm -r build  # 全仓构建
```

> **前置要求**：类型来源是官方 NPM SDK——`@deepseek-ai/*` 官方 NPM SDK 包（scope registry �?> registry.npmjs.org），**不依赖任�?DSH 源码 checkout**。首次构建前�?> 1. 若仍使用私有 scope 认证，设置环境变�?`export NPM_TOKEN='<token>'`（真实令牌只放环境变量，勿提交）�?>    当前 SDK 已结束内测，公开包通常无需令牌即可安装�?> 2. token �?*用户�?`~/.npmrc`**（`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`，由 pnpm 展开
>    环境变量）；项目 `.npmrc` 只留 scope 映射（`@deepseek-ai:registry=https://registry.npmjs.org/`�?>    已在 `.gitignore` 中）。注意：项目�?`.npmrc` 里的 `${NPM_TOKEN}` 占位符在 pnpm 11 下不会被
>    展开、被忽略，不承担认证职责�?> 3. 所�?pnpm/npm 命令必须在设置了 `NPM_TOKEN` 的环境中执行（fresh shell 需自行 export）�?> 缺失�?`pnpm install` 无法拉取私有 SDK 包，`pnpm -r build` / `pnpm typecheck` 会失败�?
### 6. 本地验证

两种方式任选：

```sh
# 方式 A：用 link-profile 脚本把全家桶全部包链接进 profile（推荐；脚本自动处理 @captain1275 命名空间�?node scripts/link-profile.mjs            # 链接/刷新全家桶；--dry-run 预览

# 方式 B：只把聚合包本身注册�?profile（聚合包�?workspace:* 依赖会回退解析�?npm 已发布版本，
# 因此请先确认 npm 上的 @captain1275/dsh-* 为最新且可用，或先用方式 A 链接全部子包�?dsh plugin --profile web add link:<dsh-web-ui>/packages/dsh-web-ui-all
```

重启 `dsh web`，确认聚合包插件行挂载生效。调试阶段也可先单独安装单包（`link:<dsh-web-ui>/packages/<name>`）验证�?
> 注意：profile 目录不是 pnpm workspace，聚合包 package.json 里的 `workspace:*` 依赖无法就地解析�?> 会回退拉取 npm 已发布的版本——若 npm 版本滞后或损坏（如历史上�?dsh-pet 0.1.1 �?chunk），
> 会出现「宿主已挂载�?UI 不显示」的现象。此时用 `node scripts/link-profile.mjs` 把仓库构建产�?> 链接�?`~/.dsh/profiles/node_modules/@captain1275/`，即可让全部子包走本地代码�?
## 第三方插件准入原�?
家族仓库欢迎社区插件，但收编必须透明�?
1. **活跃且有上游的第三方 �?不搬代码**。优�?fork �?dsh-external 组织维护（保留上游关联，可随�?merge 上游更新），或作为依赖引用；全家桶只注册其安装入口�?2. **收编条件**（无活跃上游、上游已停更、或作者明确授权组织托管）�?   - �?`git subtree add` 迁入，保留完�?git 历史�?   - **必须**保留上游 LICENSE 文件与作者署名（包内 LICENSE、README 作者声明）�?   - 在包 README 记录来源仓库与迁移日期；
   - 版权归原作者，本仓库仅托管，不主张版权�?3. **合规红线**：无 LICENSE、作者未授权、或版权归属不明的代码，一律不收编�?
## 插件规范要点

- **package.json �?`dsh.bundle.patch` 声明**：指向包�?`cordis.patch.yml`，这是官�?bundle 清单，`dsh plugin` 依赖它识别与挂载插件�?- **cordis.patch.yml insert 行格�?*（包名用家族 scope `@captain1275`，与 npm 发布名一致）�?
```yaml
- insert:
    - id: ui-<name>
      name: '@captain1275/dsh-client-ui-<name>'
```

- **类型来源（只能基于官�?NPM SDK�?*：各包把用到�?`@deepseek-ai/*` 包声明为 `devDependencies`
  （`^0.1.0-rc.6`；cordis �?`^4.0.1`），TS �?node_modules 自动解析类型
  （SDK 包的 `exports["."].types` 统一指向 `lib/types/index.d.ts`，client 半区子路�?  `./client` 同理）�?*禁止** tsconfig `extends` / `paths` / `references` 指向任何 DSH 源码
  checkout（历史形态：`../../../test-zhu1090093659` 相对路径、`~/.dsh/source/current` 绝对
  paths —�?均已废除）。tsconfig 为自包含单项目：`moduleResolution: "bundler"` +
  `allowImportingTsExtensions`（emit 项目另加 `rewriteRelativeImportExtensions: true`�?  参照 `packages/dsh-task-board/tsconfig.json`）。构�?类型/测试全部�?node_modules �?SDK 包为
  唯一类型来源，克隆后无需任何源码 checkout 即可构建�?- **浏览�?client 半区**：`@deepseek-ai/*/client` 子路径由 SDK �?exports 提供（闭包工厂产物，
  运行时经 `window.__ModuleLoader__` 加载）。官�?SDK 尚未发布的槽位（�?  `conversation.input.selector.*`）用**模块形式**的本�?augmentation 补齐类型
  （`import type {}` + `declare module '@deepseek-ai/dsh-client-ui-slots'`，参�?  `packages/dsh-git-graph/src/client/slots-augment.ts`），SDK 发布对应槽位后移除�?- **构建预设**：统一走仓库内单一共享副本 `shared/tsdown.client.ts`（平台模块表
  `shared/web-platform.ts`），各包 `tsdown.config.ts` 引用它并传参（`libExternal` /
  `companions` 等）�?*禁止**再复制预设到包内�?- **测试基建**：vitest 配置需 `server.deps.inline: [/@deepseek-ai\//]`（SDK 包走 vite 转译�?  处理 CSS）；client 半区闭包工厂在测试中不可直接 import——用 `vitest.setup.ts` 的最�?  `__ModuleLoader__` stub（`packages/dsh-live-stats/vitest.setup.ts`）或 `vi.mock` 替换
  （`packages/dsh-live-stats/vitest.setup.ts`）或 `vi.mock` 替换
  （`packages/dsh-live-stats/tests/settings-card.spec.tsx` 用 `createSnapshotStore` mock）�?- **设置页插件配置（20260811+ 可选能力）**：DSH web 设置的「插件配置」区（`ui-plugin-config` 注册�?`settings.section`）展示每插件一张卡片（`settings.plugin.item` 槽）。全家桶插件先由 `dsh-web-ui-settings` 的父卡（`settings.plugin.item`）声�?`web-ui.plugin.item` 子槽，各功能插件把卡片注册进子槽，从而在设置页收拢为一张「Web UI 插件」卡，内含各插件的启用开关与配置表单。插件接入只需两步�?  1. **host 半区**：`installSettingsSection(ctx, settingsNamespace('<ns>'), <z-schema>, <composition entry>, { setSource, onChange })`（`@deepseek-ai/dsh-settings`）注册命名空间；`setSource` 注入动态读取器，`onChange` 让已派生的行为跟随已提交的修改，无需重启�?  2. **browser 半区**：注�?`settingsScope`（`@deepseek-ai/dsh-client-ui-settings` 提供 `ctx.settingsScope`；`bind()` 还要求调用方注入 `connection` �?`remote`），`ctx.settingsScope.bind({ namespace })` 读写该命名空间，并注�?`web-ui.plugin.item` 卡片（自�?`declare module '@deepseek-ai/dsh-client-ui-slots'` 声明该槽，shape �?`ui-plugin-config` 一致；slot `order` �?100+ 避开内置卡片）。样板实现见 `packages/dsh-live-stats`（`src/client/settings-form.ts` + `PluginSettingsCard.tsx` + `LiveStatsSettingsCard.tsx`，自包含�?staged 表单，不依赖兄弟 UI 包）�?- **皮肤类插�?*：改�?`scripts/dsh-skin-new` 脚手架（皮肤规范�?skin-center / 各皮肤包 README），不经过本流程�?3-4 步的 `dsh-web-ui-all` 注册。皮肤中心（skin-center）虽是皮肤聚合，�?GUI 卡片与功能插件一样注册进 `web-ui.plugin.item` 组（设置 �?插件配置 �?Web UI 插件），不占设置页一级分区�?