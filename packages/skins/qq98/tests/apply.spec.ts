// @vitest-environment jsdom
/**
 * apply() owns the whole retro surface and retracts it on fiber dispose: the
 * body attribute the stylesheet is scoped on, the chrome bars, the injected
 * favicon, and the document title. Assert the writes and the teardown both
 * ways — including that a session title projected over the skin title is
 * never clobbered by skin teardown.
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
  delete document.body.dataset.dshRetro
  document.title = ''
})

describe('QQ98 skin apply', () => {
  it('mounts the retro surface: attribute, chrome bars, title, favicon', async () => {
    document.title = 'DeepSeek Harness'
    fiber = await mount()

    expect(document.body.dataset.dshRetro).toBe('')
    const titlebar = document.body.querySelector('[class*="retroTitlebar"]')
    const statusbar = document.body.querySelector('[class*="retroStatusbar"]')
    expect(titlebar).not.toBeNull()
    expect(statusbar).not.toBeNull()
    expect(titlebar?.textContent).toContain('QQ2008 · DeepSeek 在线')
    expect(statusbar?.textContent).toContain('QQ2008 正式版')
    expect(document.title).toBe('QQ2008 · DeepSeek 在线')
    expect(document.head.querySelector('link[rel="icon"]')).not.toBeNull()
  })

  it('retracts everything on fiber dispose', async () => {
    document.title = 'DeepSeek Harness'
    fiber = await mount()
    await fiber.dispose()
    fiber = undefined

    expect(document.body.dataset.dshRetro).toBeUndefined()
    expect(document.body.querySelector('[class*="retroTitlebar"]')).toBeNull()
    expect(document.body.querySelector('[class*="retroStatusbar"]')).toBeNull()
    expect(document.head.querySelector('link[rel="icon"]')).toBeNull()
    expect(document.title).toBe('DeepSeek Harness')
  })

  it('never clobbers a session title projected over the skin title on teardown', async () => {
    fiber = await mount()
    document.title = '我的会话 — QQ2008 · DeepSeek 在线'
    await fiber.dispose()
    fiber = undefined

    expect(document.title).toBe('我的会话 — QQ2008 · DeepSeek 在线')
  })
})
