/**
 * 设置页「关于」section：展示全家桶版本、作者与许可、第三方资源版权。
 * 注册进官方 `settings.section`（与通用/模型/插件/Agent 预设同级）。
 * @module @captain1275/dsh-client-ui-web-ui-settings/client/AboutSection
 */
import type { ReactElement } from 'react'
import css from './about.module.css'

/** 一行信息：标签 + 内容（可选徽章 / 链接）。 */
function Row(props: { label: string; value: string; badge?: string; href?: string }): ReactElement {
  return (
    <div className={css.row}>
      <span className={css.rowLabel}>{props.label}</span>
      {props.href !== undefined
        ? (
          <a className={css.link} href={props.href} target="_blank" rel="noreferrer">
            {props.value}
          </a>
        )
        : <span>{props.value}</span>}
      {props.badge !== undefined && <span className={css.badge}>{props.badge}</span>}
    </div>
  )
}

/** 版权信息区块。 */
export function AboutSection(): ReactElement {
  return (
    <div className={css.about}>
      <div>
        <div className={css.title}>DeepSeek Harness Web UI 增强插件</div>
        <div className={css.sub}>
          基于{' '}
          <a className={css.link} href="https://github.com/zhu1090093659/dsh-web-ui" target="_blank" rel="noreferrer">
            zhu1090093659/dsh-web-ui
          </a>
          {' '}修改
        </div>
      </div>

      <div className={css.block}>
        <div className={css.blockTitle}>版本与许可</div>
        <Row label="插件版本" value="0.2.0" />
        <Row label="主体代码" value="zhu1090093659（linxin）dsh-web-ui" badge="Apache-2.0" />
        <Row label="增强维护" value="@CAPTAIN1275" />
      </div>

      <div className={css.block}>
        <div className={css.blockTitle}>第三方资源</div>
        <Row
          label="DeepSeek 看板娘图"
          value="xpy12367/codex-pet-DeepSeek-girl"
          href="https://github.com/xpy12367/codex-pet-DeepSeek-girl"
        />
        <Row label="人形图标" value="Font Awesome 6.7.2" badge="CC BY 4.0" />
        <Row label="参考样式" value="live2d-widget" badge="GPL-3.0" />
      </div>

      <div className={css.block}>
        <div className={css.blockTitle}>商标声明</div>
        <div className={css.row}>
          DeepSeek 及其相关标识均为 DeepSeek 官方资产。本插件由社区开发者独立维护，不代表 DeepSeek 官方立场。
        </div>
      </div>
    </div>
  )
}
