/**
 * Dragon Heir skin — 「龙的传人」, the dual-faced dragon: light theme rides
 * 不屈龙魂 (Unyielding Dragon Soul — an ink dragon painting, vermilion
 * seal), dark theme rides 万里长城 (The Great Wall — ink-blue mountains at
 * dusk, dawn-gold light).
 * apply() owns the whole ambient surface and retracts it on dispose (the
 * ThemePresenter retraction discipline: the plugin only ever removes what it
 * wrote): the `data-dsh-dragon-heir` body attribute the stylesheet is scoped
 * on, the dragon-art backdrop layer (a fixed full-viewport element carrying
 * the artwork data URL with a thin readability scrim and a brightness/
 * contrast lift, swapped live on `data-ds-dark-theme` changes), and the
 * injected favicon (the 龙 seal — vermilion by day, gold by night).
 * The backdrop is its own layer (not a body background) so the art can be
 * boosted with a CSS filter independently of the UI surfaces above it.
 * The palette remap and the frosted pane surfaces ride the bundle's
 * CSS-modules auto-inject (style tag owned by the loader, removed on entry
 * dispose). No services are injected: the skin needs only the DOM.
 */
import type { Context } from '@deepseek-ai/cordis'
import { DARK_ART, DARK_ICON, LIGHT_ART, LIGHT_ICON } from './art.ts'
// The palette remap + the frosted panes (incl. the [id='root'] transparency
// that lets the dragon art show through) ride this stylesheet; the bundle
// preset inlines it as a loader-owned <style data-plugin-css> tag.
import './dragon-heir.module.css'

/** Light scrim: barely-there warm veil — the ink art is moody, so the
 *  translucent surfaces carry the readability and the veil only deepens
 *  toward the bottom where the composer lives. */
const SCRIM_LIGHT = [
  'linear-gradient(rgba(240, 236, 224, 0.05) 0%, rgba(235, 228, 212, 0.09) 55%, rgba(228, 219, 199, 0.14) 100%)',
].join(', ')

/** Dark scrim: a whisper of dusk over the wall — thin enough that the
 *  painting stays clearly visible. */
const SCRIM_DARK = [
  'linear-gradient(rgba(10, 6, 6, 0.14) 0%, rgba(14, 8, 7, 0.2) 60%, rgba(9, 5, 5, 0.24) 100%)',
].join(', ')

/** Both artworks are moody dark paintings; lift them hard so the subject
 *  reads clearly through the frosted surfaces (light theme lifts hardest,
 *  dark theme keeps some dusk). */
const FILTER_LIGHT = 'brightness(1.5) contrast(1.22) saturate(1.08)'
const FILTER_DARK = 'brightness(1.42) contrast(1.2) saturate(1.1)'

/**
 * Apply the Dragon Heir skin: body attribute, themed dragon-art backdrop
 * layer (with a live-swapping theme scrim and brightness/contrast lift) and
 * themed 龙-seal favicon. All writes are retracted by the effect disposer on
 * dispose. Backdrop writes go through the canonical hyphenated CSSOM API
 * (setProperty/getPropertyValue) on the layer element; body inline styles
 * are never touched.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: Context): void {
  const body = document.body
  body.dataset.dshDragonHeir = ''

  const artLayer = document.createElement('div')
  artLayer.dataset.skinChrome = 'backdrop'
  artLayer.style.position = 'fixed'
  artLayer.style.inset = '0'
  artLayer.style.zIndex = '-1'
  artLayer.style.pointerEvents = 'none'
  body.append(artLayer)

  const favicon = document.createElement('link')
  favicon.rel = 'icon'
  favicon.type = 'image/svg+xml'
  document.head.append(favicon)

  const setSurface = (): void => {
    const dark = body.dataset.dsDarkTheme !== undefined
    const art = dark ? DARK_ART : LIGHT_ART
    const scrim = dark ? SCRIM_DARK : SCRIM_LIGHT
    const filter = dark ? FILTER_DARK : FILTER_LIGHT
    artLayer.style.setProperty('background-image', `${scrim}, url("${art}")`)
    artLayer.style.setProperty('background-position', 'center')
    artLayer.style.setProperty('background-size', 'cover')
    artLayer.style.setProperty('background-attachment', 'fixed')
    artLayer.style.setProperty('background-repeat', 'no-repeat')
    artLayer.style.setProperty('filter', filter)
    favicon.href = dark ? DARK_ICON : LIGHT_ICON
  }
  setSurface()

  // Swap art, scrim, lift and seal live when the base theme system flips dark/light.
  const observer = new MutationObserver(setSurface)
  observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  ctx.effect(() => () => {
    delete body.dataset.dshDragonHeir
    observer.disconnect()
    artLayer.remove()
    favicon.remove()
  }, 'ui-skin-dragon-heir: dragon backdrop')
}
