# aurora 皮肤（极�?· 自定义背景图�?
dsh-web-ui 家族皮肤�?*支持自定义背景图�?* —�?在设置中填入任意背景�?URL（或使用内置
极光渐变），配合半透明毛玻璃面板与深浅两套极光调色板�?
## 功能

- **自定义背景图**：设�?`skin-aurora.backgroundUrl`（任�?http(s) 图片地址），实时应用到界面背�?- **内置极光渐变**：留空背景图 URL 时使用极光渐变（深色模式深蓝极光 / 浅色模式浅蓝极光�?- **透明�?/ 模糊**：`opacity`�?.1-1）与 `blur`�?-40px）可�?- **毛玻璃面�?*：半透明 token 覆盖，背景透出面板
- **深浅主题**：完整适配 `data-ds-dark-theme`，两套调色板与两套渐�?
## 设置命名空间

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | true | 皮肤总开�?|
| `backgroundUrl` | string | '' | 自定义背景图 URL；留空用极光渐变 |
| `opacity` | number | 0.8 | 背景不透明�?|
| `blur` | number | 0 | 背景模糊 px |

持久化于 `~/.dsh/settings.yaml`（命名空�?`skin-aurora`）�?
## 开�?
- 宿主半区 `src/index.ts`：注�?`skin-aurora` 设置命名空间
- 浏览器半�?`src/client/index.ts`：body 属�?+ 背景�?+ 深浅主题监听，全部副作用�?  `ctx.effect` disposer 中回�?- 样式 `src/client/aurora.module.css`：全部规则挂�?`body[data-dsh-aurora]` 作用域下

```sh
pnpm --filter @captain1275/dsh-client-ui-skin-aurora build
```
