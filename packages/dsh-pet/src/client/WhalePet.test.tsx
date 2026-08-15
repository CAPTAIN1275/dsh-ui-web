// @vitest-environment jsdom
/**
 * WhalePet rename-box keyboard handling. The rename input must treat
 * Enter/Escape keydowns that arrive during IME composition (candidate
 * selection) as composition input, never as submit/cancel (issue #89).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WhalePet, type WhalePetProps } from './WhalePet.tsx'
import { t } from './locales.ts'
import type { PetStateView } from '../service.ts'

/** Snapshot fixture: idle whale girl named 泡泡. */
const snapshot: PetStateView = {
  animation: 'idle',
  phase: 'idle',
  sessionActive: true,
  affinity: {
    points: 0,
    rank: '幼鲸',
    rankEmoji: '*',
    pets: 0,
    feeds: 0,
    turns: 0,
    petCooldown: false,
    feedCooldown: false,
  },
  display: { visible: true, size: 160, right: 24, bottom: 20 },
  name: '泡泡',
  treats: { stocked: 3, max: 5 },
}

beforeAll(() => {
  // Deterministic zh copy for button labels.
  document.documentElement.lang = 'zh'
  // Prefer-reduced-motion matches: the sprite loop then never schedules
  // requestAnimationFrame, keeping the test free of animation timers.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

afterEach(() => {
  cleanup()
})

/** Render the pet with mocked callbacks; returns the rename spy. */
function renderPet(): { onRename: ReturnType<typeof vi.fn> } {
  const onRename = vi.fn()
  const props: WhalePetProps = {
    snapshot,
    display: snapshot.display,
    feedback: null,
    onPet: vi.fn(),
    onFeed: vi.fn(),
    onHide: vi.fn(),
    onDragEnd: vi.fn(),
    onRename,
    onFeedbackDone: vi.fn(),
    say: vi.fn(),
    t,
  }
  render(<WhalePet {...props} />)
  return { onRename }
}

/** Right-click the sprite to open the panel, then click the rename button. */
function openRename(): HTMLInputElement {
  fireEvent.contextMenu(screen.getByRole('button', { name: 'whale girl' }))
  fireEvent.click(screen.getByText('改名'))
  return screen.getByPlaceholderText('输入新名字') as HTMLInputElement
}

/**
 * Fire a keydown whose native event reports an active IME composition, the
 * way Chromium marks Enter/Escape pressed to select or dismiss a candidate.
 */
function fireComposingKeydown(target: Element, key: string): void {
  fireEvent.compositionStart(target)
  const native = new window.KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    isComposing: true,
  })
  // jsdom does not implement KeyboardEvent.isComposing, so pin the flag on
  // the dispatched native event exactly as the browser would report it.
  Object.defineProperty(native, 'isComposing', { value: true })
  fireEvent(target, native)
  fireEvent.compositionEnd(target)
}

describe('WhalePet rename input', () => {
  it('submits the draft on Enter outside composition', () => {
    const { onRename } = renderPet()
    const input = openRename()
    fireEvent.change(input, { target: { value: ' 小鲸 ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledTimes(1)
    expect(onRename).toHaveBeenCalledWith('小鲸')
    expect(screen.queryByPlaceholderText('输入新名字')).toBeNull()
  })

  it('ignores Enter while an IME composition is active', () => {
    const { onRename } = renderPet()
    const input = openRename()
    fireEvent.change(input, { target: { value: '泡泡酱' } })
    fireComposingKeydown(input, 'Enter')
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('输入新名字')).toBe(input)
    expect(input.value).toBe('泡泡酱')
    // Once the composition is over, Enter submits normally.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('泡泡酱')
    expect(screen.queryByPlaceholderText('输入新名字')).toBeNull()
  })

  it('ignores Escape while an IME composition is active', () => {
    const { onRename } = renderPet()
    const input = openRename()
    fireEvent.change(input, { target: { value: 'abc' } })
    fireComposingKeydown(input, 'Escape')
    expect(screen.getByPlaceholderText('输入新名字')).toBe(input)
    // A real Escape outside composition closes the box without renaming.
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onRename).not.toHaveBeenCalled()
    expect(screen.queryByPlaceholderText('输入新名字')).toBeNull()
  })
})

describe('WhalePet panel toggle', () => {
  it('opens the panel on right-click and closes it on a second right-click', () => {
    renderPet()
    const sprite = screen.getByRole('button', { name: 'whale girl' })
    expect(screen.queryByText('改名')).toBeNull()
    fireEvent.contextMenu(sprite)
    expect(screen.getByText('改名')).toBeTruthy()
    fireEvent.contextMenu(sprite)
    expect(screen.queryByText('改名')).toBeNull()
  })

  it('closes the panel when clicking outside the pet', () => {
    renderPet()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'whale girl' }))
    expect(screen.getByText('改名')).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('改名')).toBeNull()
  })

  it('keeps the panel open when clicking inside it', () => {
    renderPet()
    fireEvent.contextMenu(screen.getByRole('button', { name: 'whale girl' }))
    // The panel itself is inside the float root, so a pointerdown on it must
    // not close the panel (the document listener checks containment).
    fireEvent.pointerDown(screen.getByText('改名'))
    expect(screen.getByText('改名')).toBeTruthy()
  })
})
