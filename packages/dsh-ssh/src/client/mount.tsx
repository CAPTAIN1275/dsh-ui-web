/**
 * Panel view mounting.
 *
 * The `conversation` slot is single-occupant (ui-conversation) and external
 * plugins cannot declare slots, so the panel takes over the center column at
 * the DOM level: a container is appended inside the AppFrame center grid item
 * (an extra trailing child React never manages), and a stylesheet rule hides
 * the conversation content while the panel is active. Toggling is a data
 * attribute on <html> — no React involvement, so the conversation subtree
 * underneath stays mounted and stateful.
 */
import { createRoot, type Root } from 'react-dom/client'
import type { SshApi } from './api.ts'
import type { PanelController } from './panel/controller.ts'
import { SshPanel } from './panel/SshPanel.tsx'
import css from './panel/panel.module.css'

/** The injected panel container (kept in the DOM, hidden when inactive). */
export const PANEL_VIEW_SELECTOR = '[data-dsh-ssh-view]'

/**
 * Center-column anchors, tried in priority order.
 *
 * `data-pane` is gone from the shell: the AppFrame columns (ui-layout) are
 * plain CSS-module classes, so 0.2.0-rc.2 renders the center item as
 * `class="BynINW_centerCol"` (`AppFrame.module.css` -> `centerCol`) with no
 * data attribute at all. The hashed prefix changes per build while the
 * `centerCol` local name is the module's contract, so the class substring is
 * the stable hook — it is the same grid item older shells tagged
 * `data-pane="conversation"`. `[data-conversation-region="chat"]` (the
 * ui-conversation body root) is the last resort for a shell that renders the
 * conversation without the frame column.
 */
const CONVERSATION_COLUMN_SELECTORS = [
  '[class*="centerCol"]',
  '[data-pane="conversation"]',
  '[data-conversation-region="chat"]',
] as const

const ACTIVE_ATTR = 'data-dsh-ssh-active'
/** The sibling panel's activation attribute (task board), removed when this panel opens. */
const OTHER_ACTIVE_ATTR = 'data-dsh-taskboard-active'
/** Cross-plugin activation event; detail is the activating panel name. */
const ACTIVATE_EVENT = 'dsh-panel-activate'
const PANEL_NAME = 'ssh'

/** Find the center column, or undefined while the frame is not mounted. */
function conversationColumn(): HTMLElement | undefined {
  for (const selector of CONVERSATION_COLUMN_SELECTORS) {
    const column = document.querySelector<HTMLElement>(selector)
    if (column !== null) return column
  }
  return undefined
}

/**
 * Mount the panel React tree into the center column and bind its visibility
 * to the controller's panelOpen state.
 * @param controller - the panel controller driving the view.
 * @param api - the SSH API client the tabs operate through.
 * @returns disposer unmounting the tree and restoring the column.
 */
export function mountPanel(controller: PanelController, api: SshApi): () => void {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  const ensure = (): void => {
    if (container !== undefined) {
      if (container.isConnected) return
      // The conversation pane was replaced; drop the stale tree and remount.
      root?.unmount()
      root = undefined
      container.remove()
      container = undefined
    }
    const column = conversationColumn()
    if (column === undefined) return
    container = document.createElement('div')
    container.dataset.dshSshView = ''
    container.className = css.view
    column.appendChild(container)
    root = createRoot(container)
    root.render(<SshPanel controller={controller} api={api} />)
  }

  // The frame mounts after boot settlement; watch for the column's arrival.
  const waitObserver = new MutationObserver(() => { ensure() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  const applyActive = (): void => {
    if (controller.getSnapshot().panelOpen) {
      // Single-occupant center column: opening this panel must evict the
      // sibling panel (task board), both its html attribute and its
      // controller state, otherwise the two panels' visibility rules fight
      // and the second click appears dead.
      document.documentElement.removeAttribute(OTHER_ACTIVE_ATTR)
      document.documentElement.setAttribute(ACTIVE_ATTR, '')
      document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
    } else {
      document.documentElement.removeAttribute(ACTIVE_ATTR)
    }
  }
  const onOtherActivate = (event: Event): void => {
    if ((event as CustomEvent).detail === 'taskboard' && controller.getSnapshot().panelOpen) {
      controller.close()
    }
  }
  // Jump out on sidebar context clicks: clicking a session/workspace row
  // (including the already-current one, which produces no session-change
  // event) hands the center column back to the conversation. Capture phase,
  // so the panel closes before the shell processes the click.
  const SIDEBAR_ROW_SELECTOR = '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'
  const onClickSidebarRow = (event: MouseEvent): void => {
    if (!controller.getSnapshot().panelOpen) return
    const target = event.target as HTMLElement | null
    if (target === null) return
    if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) controller.close()
  }
  document.addEventListener('click', onClickSidebarRow, true)
  document.addEventListener(ACTIVATE_EVENT, onOtherActivate)
  const unsubscribe = controller.subscribe(applyActive)
  applyActive()
  ensure()

  return () => {
    document.removeEventListener('click', onClickSidebarRow, true)
    document.removeEventListener(ACTIVATE_EVENT, onOtherActivate)
    waitObserver.disconnect()
    unsubscribe()
    document.documentElement.removeAttribute(ACTIVE_ATTR)
    root?.unmount()
    root = undefined
    container?.remove()
    container = undefined
  }
}
