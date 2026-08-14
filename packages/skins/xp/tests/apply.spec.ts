// @vitest-environment jsdom
/**
 * apply() owns the whole XP window-chrome surface and retracts it on fiber
 * dispose: the body attribute the stylesheet is scoped on, the chrome bars,
 * the sidebar Start button, the injected favicon, and the document title.
 * Assert the writes and the teardown both ways — including that a session
 * title projected over the skin title is never clobbered by skin teardown,
 * and that the Start button forwards its click to the settings trigger.
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

afterEach(async () => {
  await fiber?.dispose()
  fiber = undefined
  document.body.innerHTML = ''
  document.head.querySelectorAll('link[rel="icon"]').forEach((link) => { link.remove() })
  delete document.body.dataset.dshXp
  document.title = ''
})

describe('Windows XP-style skin apply', () => {
  it('mounts the window chrome: attribute, chrome bars, title, favicon', async () => {
    document.title = 'DeepSeek Harness'
    fiber = await mount()

    expect(document.body.dataset.dshXp).toBe('')
    const titlebar = document.body.querySelector('[class*="xpTitlebar"]')
    const statusbar = document.body.querySelector('[class*="xpStatusbar"]')
    expect(titlebar).not.toBeNull()
    expect(statusbar).not.toBeNull()
    expect(titlebar?.textContent).toContain('Windows XP · DeepSeek 在线')
    expect(titlebar?.querySelector('[class*="xpTitlebarBtnClose"]')?.textContent).toBe('×')
    expect(statusbar?.textContent).toContain('就绪')
    expect(statusbar?.querySelectorAll('[class*="xpStatusbarKey"]').length).toBe(3)
    expect(statusbar?.querySelectorAll('[class*="xpStatusbarKey"]')[2]?.textContent).toBe('滚动')
    expect(document.title).toBe('Windows XP · DeepSeek 在线')
    expect(document.head.querySelector('link[rel="icon"]')).not.toBeNull()
  })

  it('plants the Start button in the sidebar footer and forwards its click', async () => {
    const foot = document.createElement('div')
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('aria-haspopup', 'dialog')
    foot.append(trigger)
    const sidebar = document.createElement('div')
    sidebar.dataset.pane = 'sidebar'
    const holder = document.createElement('div')
    holder.append(foot)
    sidebar.append(holder)
    document.body.append(sidebar)

    let opened = 0
    trigger.addEventListener('click', () => { opened += 1 })

    fiber = await mount()

    const start = foot.querySelector('[class*="xpStart"]')
    expect(start).not.toBeNull()
    expect(start?.textContent).toContain('开始')
    // The foot strip is taskbar-anchored by class, never by :last-child —
    // the settings dialog portals into the sidebar column.
    expect(foot.className).toContain('xpTaskbar')
    expect(opened).toBe(0)
    ;(start as HTMLButtonElement).click()
    expect(opened).toBe(1)
  })

  it('plants the Start button when the sidebar footer mounts after the skin', async () => {
    fiber = await mount()
    expect(document.body.querySelector('[class*="xpStart"]')).toBeNull()

    // The sidebar renders after the skin settles: the observer must catch it.
    const foot = document.createElement('div')
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.setAttribute('aria-haspopup', 'dialog')
    foot.append(trigger)
    const sidebar = document.createElement('div')
    sidebar.dataset.pane = 'sidebar'
    const holder = document.createElement('div')
    holder.append(foot)
    sidebar.append(holder)
    document.body.append(sidebar)

    await new Promise(resolve => setTimeout(resolve, 0))
    const start = foot.querySelector('[class*="xpStart"]')
    expect(start).not.toBeNull()
    expect(foot.className).toContain('xpTaskbar')
  })

  it('retracts everything on fiber dispose', async () => {
    document.title = 'DeepSeek Harness'
    fiber = await mount()
    await fiber.dispose()
    fiber = undefined

    expect(document.body.dataset.dshXp).toBeUndefined()
    expect(document.body.querySelector('[class*="xpTitlebar"]')).toBeNull()
    expect(document.body.querySelector('[class*="xpStatusbar"]')).toBeNull()
    expect(document.head.querySelector('link[rel="icon"]')).toBeNull()
    expect(document.title).toBe('DeepSeek Harness')
  })

  it('never clobbers a session title projected over the skin title on teardown', async () => {
    fiber = await mount()
    document.title = '我的会话 — Windows XP · DeepSeek 在线'
    await fiber.dispose()
    fiber = undefined

    expect(document.title).toBe('我的会话 — Windows XP · DeepSeek 在线')
  })
})
