/**
 * Browser-half entry for the bot panel plugin — runs inside the dsh web GUI.
 *
 * The sidebar shell exposes no slot an external plugin can register into, so
 * the entry row is injected at the DOM level between the shell's New Session
 * button and the workspace browser, exactly like the task-board and ssh
 * plugins do. A MutationObserver re-inserts the row whenever a React
 * re-render displaces it.
 *
 * Everything here is plain DOM: no React root, no CSS modules, so the injected
 * nodes can never disturb the shell's reconciliation. Failures are logged and
 * swallowed — an external plugin must not take the GUI down.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'

/** Stable attribute identifying the injected row. */
const ENTRY_ATTR = 'data-dsh-bot-entry'

/** Row of sibling plugins this entry queues after. */
const FAMILY = '[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [' + ENTRY_ATTR + ']'

const ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="3" width="13" height="9.5" rx="2"/><circle cx="5" cy="7.7" r="1"/><path d="M8.2 7.2h4M8.2 9.6h2.6"/></svg>'

interface StatusRow {
  label: string
  ok: boolean
  detail: string
}

interface MessageRow {
  at: string
  session: string
  sender: string
  text: string
}

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button: nested in the logo row on current shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** Build the sidebar entry button (detached until the shell is up). */
function createEntry(onClick: () => void): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.setAttribute(ENTRY_ATTR, '')
  entry.setAttribute('aria-label', 'QQ 机器人')
  entry.setAttribute('title', 'QQ 机器人状态与启停')
  // Reuse the shell's own nav-row classes so the entry inherits its look.
  entry.className = 'dsh-bot-entry'
  entry.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'width:100%',
    'padding:6px 10px',
    'margin:2px 0',
    'border:0',
    'border-radius:8px',
    'background:transparent',
    'color:inherit',
    'font:inherit',
    'cursor:pointer',
    'text-align:left',
  ].join(';')
  entry.innerHTML =
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;opacity:.85">' +
    ICON +
    '</span><span>QQ 机器人</span>'
  entry.addEventListener('mouseenter', () => {
    entry.style.background = 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.16))'
  })
  entry.addEventListener('mouseleave', () => {
    entry.style.background = 'transparent'
  })
  entry.addEventListener('click', onClick)
  return entry
}

/** Re-insert the entry after the plugin family block. */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    const row = button.closest('[class*="logoRow"]')
    const base = row !== null && row.parentElement === root ? row : button
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.matches(FAMILY),
    )
    const anchor =
      family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/** One status row: a dot plus the label and its detail. */
function renderRow(row: StatusRow): HTMLElement {
  const line = document.createElement('div')
  line.style.cssText =
    'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.2))'
  const dot = document.createElement('span')
  dot.style.cssText =
    'width:8px;height:8px;border-radius:50%;flex:none;background:' +
    (row.ok ? '#34d399' : '#f87171')
  const label = document.createElement('span')
  label.style.cssText = 'flex:1;font-size:13px'
  label.textContent = row.label
  const detail = document.createElement('span')
  detail.style.cssText =
    'font-size:12px;opacity:.65;font-variant-numeric:tabular-nums;white-space:nowrap'
  detail.textContent = row.detail
  line.append(dot, label, detail)
  return line
}

/** One conversation line: time, sender, then the text. */
function renderMessage(row: MessageRow): HTMLElement {
  const line = document.createElement('div')
  line.style.cssText = 'padding:5px 0;font-size:12.5px;line-height:1.45'
  const meta = document.createElement('span')
  meta.style.cssText = 'opacity:.55;font-variant-numeric:tabular-nums;margin-right:6px'
  meta.textContent = row.at
  const who = document.createElement('span')
  who.style.cssText = 'opacity:.85;margin-right:4px'
  who.textContent = (row.sender || '未知') + ':'
  const body = document.createElement('span')
  body.textContent = row.text
  line.append(meta, who, body)
  return line
}

/** A control button (start / stop / restart / rebuild). */
function renderButton(text: string, danger: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = text
  button.style.cssText = [
    'padding:6px 12px',
    'border-radius:8px',
    'border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.35))',
    'background:' + (danger ? 'rgba(248,113,113,.14)' : 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,.15))'),
    'color:inherit',
    'font:inherit',
    'font-size:13px',
    'cursor:pointer',
  ].join(';')
  button.addEventListener('click', onClick)
  return button
}

/**
 * Mount the sidebar entry and its control panel.
 * @param ctx - client root context.
 * @returns disposer removing every injected node and observer.
 */
function mount(ctx: ClientContext): () => void {
  let overlay: HTMLElement | undefined
  let timer: number | undefined

  const closePanel = (): void => {
    if (timer !== undefined) {
      window.clearInterval(timer)
      timer = undefined
    }
    overlay?.remove()
    overlay = undefined
  }

  const refresh = async (list: HTMLElement): Promise<void> => {
    try {
      const response = await fetch('/api/dsh-bot/status', { cache: 'no-store' })
      const payload = (await response.json()) as { ok?: boolean; rows?: StatusRow[] }
      list.textContent = ''
      const rows = payload.rows ?? []
      if (rows.length === 0) {
        const empty = document.createElement('div')
        empty.style.cssText = 'font-size:13px;opacity:.7;padding:8px 0'
        empty.textContent = '没读到状态'
        list.append(empty)
        return
      }
      for (const row of rows) list.append(renderRow(row))
    } catch (error) {
      list.textContent = '读取失败: ' + (error as Error).message
      list.style.fontSize = '12px'
    }
  }

  /** Render the recent conversation records into the list container. */
  const refreshMessages = async (list: HTMLElement): Promise<void> => {
    try {
      const response = await fetch('/api/dsh-bot/messages?limit=30', { cache: 'no-store' })
      const payload = (await response.json()) as { messages?: MessageRow[] }
      list.textContent = ''
      const rows = payload.messages ?? []
      if (rows.length === 0) {
        const empty = document.createElement('div')
        empty.style.cssText = 'font-size:13px;opacity:.7;padding:8px 0'
        empty.textContent = '还没有对话记录'
        list.append(empty)
        return
      }
      for (const row of rows) list.append(renderMessage(row))
      list.scrollTop = list.scrollHeight
    } catch (error) {
      list.textContent = '读取失败: ' + (error as Error).message
    }
  }

  const runAction = async (
    action: string,
    list: HTMLElement,
    after?: () => void,
  ): Promise<void> => {
    try {
      await fetch('/api/dsh-bot/action?action=' + encodeURIComponent(action), { method: 'POST' })
      if (after !== undefined) after()
      else await refresh(list)
    } catch (error) {
      console.warn('[dsh-bot-panel] action failed:', error)
    }
  }

  const openPanel = (): void => {
    if (overlay !== undefined) {
      closePanel()
      return
    }
    const card = document.createElement('div')
    card.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:10000',
      'width:400px',
      'max-height:70vh',
      'display:flex',
      'flex-direction:column',
      'padding:18px',
      'border-radius:16px',
      // 毛玻璃：半透明底 + 背景模糊 + 细边框与高光，和皮肤是同一种质感。
      'background:rgba(24,28,38,.66)',
      'backdrop-filter:blur(22px) saturate(1.35)',
      '-webkit-backdrop-filter:blur(22px) saturate(1.35)',
      'border:1px solid rgba(255,255,255,.14)',
      'box-shadow:0 18px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)',
      'color:#e8eef8',
      'font:inherit',
    ].join(';')

    const title = document.createElement('div')
    title.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:10px'
    title.textContent = 'QQ 机器人'

    const list = document.createElement('div')
    list.style.cssText = 'margin-bottom:12px;overflow-y:auto;flex:1;min-height:0'

    const tabs = document.createElement('div')
    tabs.style.cssText = 'display:flex;gap:6px;margin-bottom:10px'

    const bar = document.createElement('div')
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap'

    /** Switch to the live status view (polls every five seconds). */
    const showStatus = (): void => {
      if (timer !== undefined) window.clearInterval(timer)
      list.textContent = ''
      bar.textContent = ''
      bar.append(
        renderButton('启动', false, () => void runAction('start', list, showStatus)),
        renderButton('停止', false, () => void runAction('stop', list, showStatus)),
        renderButton('重启', false, () => void runAction('restart', list, showStatus)),
        renderButton('重建 NapCat', true, () => void runAction('rebuild', list, showStatus)),
      )
      void refresh(list)
      timer = window.setInterval(() => void refresh(list), 5000)
    }

    /** Switch to the conversation record view (one-shot read). */
    const showMessages = (): void => {
      if (timer !== undefined) {
        window.clearInterval(timer)
        timer = undefined
      }
      bar.textContent = ''
      bar.append(renderButton('刷新', false, () => void showMessages()))
      void refreshMessages(list)
    }

    tabs.append(
      renderButton('状态', false, showStatus),
      renderButton('对话记录', false, showMessages),
    )

    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = '关闭'
    close.style.cssText =
      'position:absolute;top:10px;right:12px;border:0;background:transparent;color:inherit;cursor:pointer;font-size:16px;opacity:.6'
    close.addEventListener('click', closePanel)

    card.append(title, close, tabs, list, bar)
    document.body.appendChild(card)
    overlay = card

    showStatus()
  }

  const entry = createEntry(openPanel)
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
    if (placed) rootObserver.observe(root, { childList: true, subtree: true })
  }

  const waitObserver = new MutationObserver(() => {
    tryPlace()
  })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) placed = placeEntry(root, entry)
  })

  tryPlace()

  return () => {
    waitObserver.disconnect()
    rootObserver.disconnect()
    closePanel()
    entry.remove()
  }
}

/**
 * Mount the bot panel surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  let dispose: (() => void) | undefined
  try {
    dispose = mount(ctx)
  } catch (error) {
    console.warn('[dsh-bot-panel] mount failed:', error)
  }
  ctx.effect(() => () => {
    dispose?.()
    dispose = undefined
  }, 'dsh-bot-panel: ui mounts')
}
