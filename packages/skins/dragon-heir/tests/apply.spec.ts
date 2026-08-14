// @vitest-environment jsdom
/**
 * Dragon Heir skin apply spec — apply() owns the whole ambient surface and
 * retracts it on fiber dispose: the body attribute the stylesheet is scoped
 * on, the themed dragon-art backdrop layer (a fixed element carrying the
 * artwork data URL, thin scrim and brightness/contrast lift, with the live
 * swap between 水墨飞龙 and 帝王金碧), and the injected 龙-seal favicon
 * (vermilion by day, gold by night). Body inline styles are never touched.
 * Assert the writes and the teardown both ways.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import { apply } from '../src/client/index.ts'

let fiber: Fiber | undefined

async function mount(): Promise<Fiber> {
  const f = new Context().plugin({ apply })
  await f.await()
  return f
}

/** MutationObserver delivers asynchronously; flush its microtask queue. */
async function tick(): Promise<void> {
  await new Promise((resolve) => { setTimeout(resolve, 0) })
}

function backdrop(): HTMLElement {
  const el = document.querySelector('[data-skin-chrome="backdrop"]')
  expect(el).not.toBeNull()
  return el as HTMLElement
}

function favicon(): HTMLLinkElement {
  const el = document.head.querySelector('link[rel="icon"]')
  expect(el).not.toBeNull()
  return el as HTMLLinkElement
}

afterEach(async () => {
  await fiber?.dispose()
  fiber = undefined
  document.body.innerHTML = ''
  document.head.querySelectorAll('link[rel="icon"]').forEach((link) => { link.remove() })
  delete document.body.dataset.dshDragonHeir
  delete document.body.dataset.dsDarkTheme
  document.body.style.cssText = ''
  document.title = ''
})

describe('dragon-heir skin apply', () => {
  it('mounts the ambient surface: attribute, light art layer, vermilion seal', async () => {
    fiber = await mount()

    expect(document.body.dataset.dshDragonHeir).toBe('')
    const layer = backdrop()
    expect(layer.style.getPropertyValue('background-image')).toContain('data:image/webp;base64')
    expect(layer.style.getPropertyValue('background-size')).toBe('cover')
    expect(layer.style.getPropertyValue('background-attachment')).toBe('fixed')
    expect(layer.style.getPropertyValue('filter')).toContain('brightness(1.5)')
    expect(layer.style.position).toBe('fixed')
    expect(layer.style.zIndex).toBe('-1')
    // Body inline styles are never touched.
    expect(document.body.style.getPropertyValue('background-image')).toBe('')
    // Vermilion seal (light).
    expect(favicon().href).toContain('%23c3272b')
  })

  it('uses the dark palace art, dark lift and gold seal while data-ds-dark-theme is set', async () => {
    document.body.dataset.dsDarkTheme = ''
    fiber = await mount()

    const layer = backdrop()
    const darkImage = layer.style.getPropertyValue('background-image')
    expect(darkImage).toContain('rgba(10, 6, 6')
    expect(darkImage).toContain('data:image/webp;base64')
    expect(layer.style.getPropertyValue('filter')).toContain('brightness(1.42)')
    expect(favicon().href).toContain('%23c8a24a')
  })

  it('swaps art, scrim, lift and seal live when the theme flips', async () => {
    document.body.dataset.dsDarkTheme = ''
    fiber = await mount()

    // Flip to light: the whole surface swaps without remounting (MutationObserver).
    delete document.body.dataset.dsDarkTheme
    await tick()
    const layer = backdrop()
    const lightImage = layer.style.getPropertyValue('background-image')
    expect(lightImage).toContain('rgba(240, 236, 224')
    expect(lightImage).toContain('data:image/webp;base64')
    expect(layer.style.getPropertyValue('filter')).toContain('brightness(1.5)')
    expect(favicon().href).toContain('%23c3272b')

    // And back to dark.
    document.body.dataset.dsDarkTheme = ''
    await tick()
    const darkAgain = layer.style.getPropertyValue('background-image')
    expect(darkAgain).toContain('rgba(10, 6, 6')
    expect(darkAgain).toContain('data:image/webp;base64')
    expect(layer.style.getPropertyValue('filter')).toContain('brightness(1.42)')
  })

  it('retracts everything on fiber dispose and leaves body styles untouched', async () => {
    document.body.style.setProperty('background-image', 'url("https://example.test/prior.png")')
    fiber = await mount()
    // The skin never writes body styles, so the prior value survives untouched.
    expect(document.body.style.getPropertyValue('background-image')).toContain('prior.png')

    await fiber.dispose()
    fiber = undefined

    expect(document.body.dataset.dshDragonHeir).toBeUndefined()
    expect(document.querySelector('[data-skin-chrome="backdrop"]')).toBeNull()
    expect(document.body.style.getPropertyValue('background-image')).toContain('prior.png')
    expect(document.head.querySelector('link[rel="icon"]')).toBeNull()
  })
})
