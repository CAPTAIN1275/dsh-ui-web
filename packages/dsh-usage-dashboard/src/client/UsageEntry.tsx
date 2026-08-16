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
import QRCode from 'qrcode'
import { DashboardPanel } from './DashboardPanel.tsx'
import css from './usage-entry.module.css'
import { t } from './locales.ts'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-usage-entry]'

/** Stable data attribute identifying the phone-view entry row. */
export const PHONE_SELECTOR = '[data-dsh-phone-entry]'

/** Inline icon (matches the shell's 16px nav-icon look): three rainbow bars. */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="8" width="3" height="5" rx="0.8" fill="#f472b6"/><rect x="7" y="4.5" width="3" height="8.5" rx="0.8" fill="#fb923c"/><rect x="11.5" y="1.5" width="3" height="11.5" rx="0.8" fill="#4ade80"/></svg>'

/** 手机端查看图标（手机 + 信号）。 */
const PHONE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/><path d="M7 12.5h2"/><path d="M9.5 4.2 11 5.7l-1.5 1.5"/><path d="M6.5 7.2 5 5.7l1.5-1.5"/></svg>'

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

/** 手机端查看入口：点击弹出局域网访问地址。 */
function createPhoneEntry(): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshPhoneEntry = ''
  entry.className = css.entry
  entry.setAttribute('aria-label', '手机端查看')
  entry.setAttribute('title', '手机端查看')
  entry.innerHTML = `<span class="${css.entryIcon}">${PHONE_ICON}</span><span class="${css.entryLabel}">手机端查看</span>`
  entry.addEventListener('click', () => { openPhonePanel() })
  return entry
}

/** 手机端查看弹窗（单实例）。 */
let phoneHost: HTMLDivElement | undefined
let phoneCopyUrl = ''

/** 关闭手机端查看弹窗。 */
export function closePhonePanel(): void {
  phoneHost?.remove()
  phoneHost = undefined
  phoneCopyUrl = ''
}

/** 打开手机端查看弹窗：显示局域网访问地址（host /api/usage/lan 提供）。 */
function openPhonePanel(): void {
  if (phoneHost !== undefined) return
  const host = document.createElement('div')
  host.dataset.dshPhoneOverlay = ''
  host.className = css.phoneOverlay
  host.innerHTML = `
    <div class="${css.phoneCard}">
      <div class="${css.phoneHead}"><span>手机端查看</span><button class="${css.phoneClose}" aria-label="关闭">×</button></div>
      <div class="${css.phoneQrBox}"><img class="${css.phoneQr}" alt="二维码" hidden /></div>
      <p class="${css.phoneHint}">手机连同一 Wi-Fi，扫码或浏览器打开以下地址：</p>
      <div class="${css.phoneAddrs}">加载中…</div>
      <button class="${css.phoneCopy}">复制地址</button>
    </div>`
  document.body.appendChild(host)
  phoneHost = host
  host.querySelector(`.${css.phoneClose}`)?.addEventListener('click', closePhonePanel)
  host.addEventListener('click', (e) => { if (e.target === host) closePhonePanel() })
  const copyBtn = host.querySelector<HTMLButtonElement>(`.${css.phoneCopy}`)
  copyBtn?.addEventListener('click', () => {
    if (phoneCopyUrl === '') return
    void navigator.clipboard?.writeText(phoneCopyUrl).then(() => {
      if (copyBtn !== null) { copyBtn.textContent = '已复制'; window.setTimeout(() => { copyBtn.textContent = '复制地址' }, 1200) }
    }).catch(() => { /* ignore */ })
  })
  const addrsBox = host.querySelector<HTMLElement>(`.${css.phoneAddrs}`)
  const qrImg = host.querySelector<HTMLImageElement>(`.${css.phoneQr}`)
  void fetch('/api/usage/lan').then(r => r.json()).then((data) => {
    if (addrsBox === null || !host.isConnected) return
    const d = data as { ok?: boolean; addresses?: string[] }
    if (d?.ok !== true || !Array.isArray(d.addresses)) {
      addrsBox.textContent = '获取局域网地址失败（请重启 dsh 后重试）'
      return
    }
    const port = location.port !== '' ? `:${location.port}` : ''
    const urls = d.addresses.map(ip => `http://${ip}${port}`)
    if (urls.length === 0) {
      addrsBox.textContent = '未检测到局域网地址（请检查网络）'
      return
    }
    phoneCopyUrl = urls[0] ?? ''
    addrsBox.innerHTML = urls.map(u => `<div class="${css.phoneAddr}"><code>${u}</code></div>`).join('')
    // 二维码：扫第一个地址（192 网段优先）。
    if (qrImg !== null) {
      void QRCode.toDataURL(phoneCopyUrl, { width: 168, margin: 1, errorCorrectionLevel: 'M' })
        .then(dataUrl => {
          if (!host.isConnected) return
          qrImg.src = dataUrl
          qrImg.hidden = false
        })
        .catch(() => { /* 二维码生成失败，地址仍可复制 */ })
    }
  }).catch(() => {
    if (addrsBox !== null && host.isConnected) addrsBox.textContent = '获取局域网地址失败（请重启 dsh 后重试）'
  })
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
        && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry], [data-dsh-phone-entry]'),
    )
    // usage sits after the whole family block.
    const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/** 手机端查看入口：插到用量按钮（data-dsh-usage-entry）正下方。 */
function placePhone(root: HTMLElement, phone: HTMLButtonElement): boolean {
  const usage = root.querySelector<HTMLElement>('[data-dsh-usage-entry]')
  if (usage === null) return false
  if (phone.parentElement !== root) {
    root.insertBefore(phone, usage.nextElementSibling)
  }
  return true
}

/**
 * Mount the sidebar entries (usage + phone view), waiting for the shell to
 * render and self-healing on later React re-renders.
 * @returns disposer removing the entries and their observers.
 */
export function mountUsageEntry(): () => void {
  const entry = createEntry()
  const phoneEntry = createPhoneEntry()
  let root: HTMLElement | undefined
  let placed = false

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry) && document.body.contains(phoneEntry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    const okEntry = placeEntry(root, entry)
    const okPhone = placePhone(root, phoneEntry)
    placed = okEntry && okPhone
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
    if (!root.contains(entry) || !root.contains(phoneEntry)) {
      placed = placeEntry(root, entry) && placePhone(root, phoneEntry)
    }
  })

  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    entry.remove()
    phoneEntry.remove()
    closeDashboard()
    closePhonePanel()
  }
}
