/**
 * Usage dashboard sidebar entry — DOM-level injection.
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into
 * (`sidebar.workspaces` / `sidebar.settings` are single-occupant and already
 * taken), so — following the task-board / ssh precedent of DOM-level
 * extension — the entry row is injected between the shell's New Session
 * button and the workspace browser. The injection self-heals: a
 * MutationObserver watches the sidebar root and re-inserts the row whenever
 * a React re-render displaces it.
 *
 * The row is plain DOM; clicking it mounts the full-screen dashboard overlay
 * as a separate React root (see mountDashboard).
 * @module @captain1275/dsh-usage-dashboard/client/UsageEntry
 */
import { createRoot, type Root } from 'react-dom/client'
import { DashboardPanel } from './DashboardPanel.tsx'
import css from './usage-entry.module.css'
import { t } from './locales.ts'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-usage-entry]'

/** Inline icon (matches the shell's 16px nav-icon look): three rainbow bars. */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="8" width="3" height="5" rx="0.8" fill="#f472b6"/><rect x="7" y="4.5" width="3" height="8.5" rx="0.8" fill="#fb923c"/><rect x="11.5" y="1.5" width="3" height="11.5" rx="0.8" fill="#4ade80"/></svg>'

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  // Current shells wrap the sidebar UI: column > wrapper > root(logoRow owner).
  // Prefer the element that owns the logo row — the real sidebar UI root —
  // and fall back to the column's first child for legacy shells.
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** The injected dashboard overlay root (single instance while open). */
let overlayRoot: Root | undefined
let overlayHost: HTMLDivElement | undefined

/** Close the dashboard overlay if open. */
export function closeDashboard(): void {
  overlayRoot?.unmount()
  overlayRoot = undefined
  overlayHost?.remove()
  overlayHost = undefined
}

/** Open the full-screen dashboard overlay. */
export function openDashboard(): void {
  if (overlayRoot !== undefined) return
  overlayHost = document.createElement('div')
  overlayHost.dataset.dshUsageOverlay = ''
  document.body.appendChild(overlayHost)
  overlayRoot = createRoot(overlayHost)
  overlayRoot.render(<DashboardPanel onClose={closeDashboard} />)
}

/** Build the entry row (a detached button; insert once the shell is up). */
function createEntry(): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshUsageEntry = ''
  entry.className = css.entry
  entry.setAttribute('aria-label', t('usage.entry'))
  entry.setAttribute('title', t('usage.entry'))
  entry.innerHTML = `<span class="${css.entryIcon}">${ICON}</span><span class="${css.entryLabel}">${t('usage.entry')}</span>`
  entry.addEventListener('click', () => { openDashboard() })
  return entry
}

/** Re-insert the entry after the New Session row (before the browser region). */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    // Position relative to the family block (entries injected by sibling
    // plugins), never relative to transient logoRow geometry: every family
    // plugin that self-heals during a re-render then lands in the same
    // relative order, so the entries cannot swap positions regardless of
    // observer callback order or of shell wrapper changes.
    const row = button.closest('[class*="logoRow"]')
    const base = (row !== null && row.parentElement === root) ? row : button
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
        && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry]'),
    )
    // usage sits after the whole family block.
    const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/**
 * Mount the sidebar entry, waiting for the shell to render and self-healing
 * on later React re-renders.
 * @returns disposer removing the entry and its observers.
 */
export function mountUsageEntry(): () => void {
  const entry = createEntry()
  let root: HTMLElement | undefined
  let placed = false

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root, entry)
    if (placed) {
      rootObserver.observe(root, { childList: true, subtree: true })
    }
  }

  // Body-level watcher retained as the "whole rebuild" fallback.
  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  // Self-heal: if a React re-render displaces the row, re-insert it in the
  // same frame (microtask before paint → no visible flicker).
  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root, entry)
    }
  })

  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    entry.remove()
    closeDashboard()
  }
}
