# 如何把新插件加入全家桶

本指南说明如何把一个新插件加入 dsh-web-ui 全家桶，使其可以被聚合插件包
（`dsh-web-ui-all` / `dsh-skins`）一键装齐，也可独立安装。

## 流程

### 1. 脚手架生成

```sh
node scripts/dsh-plugin-new <name>
```

在 `packages/<name>/` 生成标准 bundle 骨架（`<name>` 限小写字母、数字、单连字符，
如 `dsh-task-board`），并替换模板中的 `__NAME__` 占位。生成的结构是：

```text
packages/<name>/
├── cordis.patch.yml   # 插件行（- insert: - id: ui-<name> / name: ...）
├── package.json       # dsh.engines + dsh.bundle.patch + dsh.client 声明
├── src/
│   ├── index.ts       # host 半区（node 进程侧）
│   └── client/index.ts # browser 半区（Web GUI 侧）
├── tsconfig.json
├── tsdown.config.ts
└── README.md
```

### 2. 实现插件逻辑

- **host 半区 `src/index.ts`**：导出 cordis 插件，运行在 dsh host 进程（例如系统提示词
  公告、真实任务执行、HTTP 路由等）。形态参照 `packages/dsh-task-board/`。
- **browser 半区 `src/client/index.ts`**：Web GUI 侧的 UI 逻辑，经 package.json 的
  `dsh.client` 声明注入运行时。
- `dsh.client.inject` 列出该插件浏览器半区依赖的**官方客户端模块**（如
  `@deepseek-ai/dsh-client-ui-renderer`、`@deepseek-ai/dsh-client-store`、
  `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-ui-settings` 等），
  并声明 `platform: "web"`。这些模块名必须同时在该包 `devDependencies` 里有声明，
  否则浏览器模块表解析不到。

### 3. 注册进聚合包

把 `- ../<name>` 追加到 `packages/dsh-web-ui-all/aggregate.yml` 的 `patchFrom` 与
`deps` 两段：

- `patchFrom`：该包的 `cordis.patch.yml` insert 行会被汇总进聚合包的 patch。
- `deps`：解析为包名写入聚合包的 `package.json` 的 `dependencies`（`workspace:*`）。

皮肤（新增或改动）不需要进任何 aggregate.yml：`packages/dsh-skins/build.mjs` 会把
`packages/skins/<id>` 的 `skin.json` + `lib/client.js` + `lib/index.js` +
`cordis.patch.yml` 复制进 `dsh-skins/skins/<id>`，并按源包的 name/version 生成一个
最小可解析的载体 `package.json`（npm 上皮肤资产全部内置在 dsh-skins 一个包里，避免为
每个皮肤包名付 npm 新包名费用）。改完皮肤后运行
`pnpm --filter @captain1275/dsh-skins build`。载体 package.json 是**生成产物，禁止手改**；
要改它的形态（例如声明运行时下限）改 `build.mjs` 的 `renderCarrierPackageJson`。
皮肤启用互斥由 `dsh-skin use` 管理（`~/.dsh/cordis.patch.yml` managed 区段）。

### 4. 重新生成聚合包

```sh
node scripts/aggregate.mjs          # 重新生成聚合包 cordis.patch.yml + 依赖
node scripts/aggregate.mjs --check  # 校验模式：任何漂移以退出码 1 报错（CI 用）
```

### 5. 构建验证

```sh
pnpm install   # workspace 链接（packages/* 与 packages/skins/*）
pnpm -r build  # 全仓构建
pnpm -r typecheck
```

> **前置要求**：类型来源是官方 NPM SDK——`@deepseek-ai/*` 官方 NPM SDK 包
> （scope registry 为 registry.npmjs.org），**不依赖任何 DSH 源码 checkout**。
>
> 1. token 放**用户级 `~/.npmrc`**（`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`，
>    由 pnpm 展开环境变量）；项目 `.npmrc` 只留 scope 映射
>    （`@deepseek-ai:registry=https://registry.npmjs.org/`，已在 `.gitignore` 中）。
>    注意：项目级 `.npmrc` 里的 `${NPM_TOKEN}` 占位符在 pnpm 11 下不会被展开、被忽略，
>    不承担认证职责。
> 2. SDK 已结束内测，公开包通常无需令牌即可安装。

### 6. 本地验证

```sh
# 用 link-profile 脚本把全家桶全部包链接进 profile（推荐；脚本自动处理
# @captain1275 命名空间）
node scripts/link-profile.mjs            # 链接/刷新全家桶；--dry-run 预览

# 只把聚合包本身注册进 profile
dsh plugin --profile web add link:<dsh-web-ui>/packages/dsh-web-ui-all
```

重启 `dsh web`，确认聚合包插件行挂载生效。调试阶段也可先单独安装单包
（`link:<dsh-web-ui>/packages/<name>`）验证。

> **免重启的组合校验**：`dsh --profile <name> --dump-config` 会组合 profile 树后退出，
> 不启动服务。它会按行读取每个包的 `package.json` 并跑 dsh-app-boot 的兼容性判定，
> 因此能在不打扰运行中实例的前提下查出「插件被拒载」。注意它**不会** import 各包的
> `lib/index.js`，所以证明不了浏览器半区真的能跑起来。

> 注意：profile 目录不是 pnpm workspace，聚合包 package.json 里的 `workspace:*`
> 依赖无法就地解析，会回退拉取 npm 已发布的版本——若 npm 版本滞后或损坏，
> 会出现「宿主已挂载但 UI 不显示」的现象。此时用 `node scripts/link-profile.mjs`
> 把仓库构建产物链接到 `~/.dsh/profiles/node_modules/@captain1275/`，
> 即可让全部子包走本地代码。

## 第三方插件准入原则

家族仓库欢迎社区插件，但收编必须透明：

1. **活跃且有上游的第三方 —— 不搬代码**。优先 fork 到 dsh-external 组织维护
   （保留上游关联，可随时 merge 上游更新），或作为依赖引用；全家桶只注册其安装入口。
2. **收编条件**（无活跃上游、上游已停更、或作者明确授权组织托管）：
   - 用 `git subtree add` 迁入，保留完整 git 历史；
   - **必须**保留上游 LICENSE 文件与作者署名（包内 LICENSE、README 作者声明）；
   - 在包 README 记录来源仓库与迁移日期；
   - 版权归原作者，本仓库仅托管，不主张版权。
3. **合规红线**：无 LICENSE、作者未授权、或版权归属不明的代码，一律不收编。

## 插件规范要点

- **`dsh.bundle.patch` 声明**：指向包内 `cordis.patch.yml`，这是官方 bundle 清单，
  `dsh plugin` 依赖它识别与挂载插件。

- **`dsh.engines.dsh` 运行时下限**：声明本包支持的 DSH 运行时下限，与
  `peerDependencies` 里的宿主 range 同源：

  ```json
  "dsh": {
    "engines": { "dsh": ">=0.2.0-rc.2" },
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": ["@deepseek-ai/dsh-client-ui-renderer"], "platform": "web" }
  }
  ```

- **peerDependencies 只声明宿主本体**：写
  `"@deepseek-ai/dsh": ">=0.2.0-rc.2"`（用 `>=` 下限，不要用 `^`——`^0.1.x` 之类的
  range 在次版本跳变后会判定不兼容）。具体 SDK 包（`dsh-client-*`、`dsh-host-*` 等）
  放 `devDependencies`，**不要**挂进 `peerDependencies`。

  这条是硬要求：dsh-app-boot 的 `evaluatePluginCompatibility()` 会扫描
  `peerDependencies` 里所有 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 项，逐个跑
  `semver.satisfies(运行时版本, range, { includePrerelease: true })`，任一项不满足就抛
  `pluginCompatibilityWarning` 拒绝加载该插件。

- **cordis.patch.yml insert 行格式**（包名用家族 scope `@captain1275`，与 npm 发布名一致）：

  ```yaml
  - insert:
      - id: ui-<name>
        name: '@captain1275/dsh-client-ui-<name>'
  ```

- **类型来源（只能基于官方 NPM SDK）**：各包的 `devDependencies` 统一锁
  `^0.2.0-rc.2`（cordis 用 `^4.0.4`，schema 用 `@deepseek-ai/schemastery@^3.18.4` —— 注意
  这是 DSH 的分叉包，平级的 `schemastery` 没有 `.volatile()`），TS 从 node_modules
  自动解析类型（SDK 包的 `exports["."].types` 统一指向 `lib/types/index.d.ts`，
  client 半区子路径 `./client` 同理）。**禁止** tsconfig `extends` / `paths` /
  `references` 指向任何 DSH 源码 checkout（历史形态：`../../../test-zhu1090093659`
  相对路径、`~/.dsh/source/current` 绝对路径 —— 均已废除）。tsconfig 为自包含单项目：
  `moduleResolution: "bundler"` + `allowImportingTsExtensions`（emit 项目另加
  `rewriteRelativeImportExtensions: true`，参照 `packages/dsh-task-board/tsconfig.json`）。
  需要 node 内置模块的 host 半区，tsconfig 要写 `"types": ["node"]`。

- **浏览器 client 半区**：`@deepseek-ai/*/client` 子路径由 SDK 的 exports 提供
  （闭包工厂产物，运行时经 `window.__ModuleLoader__` 加载）。`ctx.slots` 在 0.2.0 起由
  `@deepseek-ai/dsh-client-ui-renderer/client` 提供 Context 合并（ui-slots 只剩纯核），
  注册槽位前需要 `import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'`。
  官方 SDK 尚未发布的槽位用**模块形式**的本地 augmentation 补齐类型
  （`import type {}` + `declare module '@deepseek-ai/dsh-client-ui-slots'`），
  SDK 发布对应槽位后移除。

- **构建预设**：统一走仓库内单一共享副本 `shared/tsdown.client.ts`（平台模块表
  `shared/web-platform.ts`），各包 `tsdown.config.ts` 引用它并传参（`libExternal` /
  `companions` 等）。**禁止**再复制预设到包内。

  平台模块表镜像 shell 的冻结模块表，浏览器 bundle 里对这些说明符的**值导入**保持
  external、其余 `@deepseek-ai/*` 值导入会被构建纯度门直接判错（跨插件值导入要么内联出
  一份重复的运行时实例，要么要求模块表答不出的说明符）。跨插件协作一律走 cordis 服务
  或 slot，类型导入不受影响。

- **测试基建**：vitest 配置需 `server.deps.inline: [/@deepseek-ai\//]`（SDK 包走 vite
  转译以处理 CSS）；client 半区闭包工厂在测试中不可直接 import——用 `vitest.setup.ts`
  的最后一个 `__ModuleLoader__` stub，或 `vi.mock` 替换。

  注意 `autoInstallPeers: false` 是有意为之（peer API 运行时从 dsh profile 树解析），
  但某个 SDK 包在模块顶层 value-import 它自己的 peerDependency 时，本仓加载它（尤其
  vitest）就会解析失败——那类 peer 必须显式补进 `devDependencies`。

- **设置页插件配置**：DSH web 设置的「插件配置」区由 `dsh-web-ui-settings` 注册的
  一级 `settings.section`（id `web-ui-plugins`）承担，它在自己的 `children` 里声明
  list 子槽 `web-ui.plugin.item`；各功能插件把设置卡注册进这个子槽，设置页因此收拢为
  一张「Web UI 插件」页，而不是每个插件占一个一级分区。

  > 0.2.0-rc.2 移除了旧的 keyed 槽 `settings.plugin.item`（组卡片原来的落点），
  > 组卡片因此改成自建一级 section，聚合形态不变。

  **host 半区不需要任何注册调用**：导出的 `Config` schema **本身**就是该 profile entry
  的设置页，Host 按 entry 自动派生表单。要让改动到达运行中的实例，字段必须标
  `.volatile()`：

  ```ts
  import z from '@deepseek-ai/schemastery'

  /** 稳定引用：volatile() 字段解析成的活引用，owner 原地更新它。 */
  interface ConfigRef<T> { get(): T }
  type ConfigField<T> = ConfigRef<T> | T

  export interface Config { enabled?: boolean }
  // 不要写显式泛型标注（z<Config>）——volatile() 会改变推断类型导致 TS2322。
  export const Config = z.object({
    enabled: z.boolean().default(true).volatile(),
  })

  /** 读一个配置字段，跟随 schema 产生的活引用。 */
  function readConfigField<T>(field: ConfigField<T> | undefined, fallback: T): T {
    if (field === undefined) return fallback
    if (typeof field === 'object' && field !== null && typeof (field as ConfigRef<T>).get === 'function') {
      const value = (field as ConfigRef<T>).get()
      return value === undefined ? fallback : value
    }
    return field as T
  }

  export function apply(ctx: Context, config?: Config): void {
    // 读活配置用 readConfigField(config?.enabled, true)。
    // 原来 onChange 触发的重建改为订阅 loader 的 volatile 更新：
    ctx.on('loader/volatile-update', () => { /* 重新读取并重建 */ })
  }
  ```

  **browser 半区**通过 `ctx.configForms`（`@deepseek-ai/dsh-client-ui-settings` 提供）
  读写：表单按 **profile entry id** 寻址，`ctx.configForms.get(entryId)` 返回一个
  `ConfigForm`（`getSnapshot` / `subscribe` / `mutate` / `set` / `unset`）。插件只知道自己
  的设置命名空间时，用候选 entry id 兜底绑定（实现照抄 `packages/dsh-pet/src/client/settings-entry-form.ts`
  的 `createServedEntryForm`，它监听共享 describe 镜像，镜像报出本包的某个行 id 时重绑）：

  ```ts
  const form = createServedEntryForm<PetSettings>({
    forms: ctx.configForms,
    entryIds: ['pet'],   // 本包的 profile 行 id，最可能的在前
  })
  ```

  设置卡本体照旧注册进 `web-ui.plugin.item`（自己用
  `declare module '@deepseek-ai/dsh-client-ui-slots'` 声明该槽，shape 与组 section 一致；
  slot `order` 用 100+ 避开内置卡片）。

- **皮肤类插件**：改动走 `scripts/dsh-skin-new` 脚手架（皮肤规范见 skin-center / 各皮肤包
  README），不经过本流程第 3-4 步的 `dsh-web-ui-all` 注册。皮肤中心（skin-center）虽是
  皮肤聚合，其 GUI 卡片与功能插件一样注册进 `web-ui.plugin.item` 组，不占设置页一级分区。
