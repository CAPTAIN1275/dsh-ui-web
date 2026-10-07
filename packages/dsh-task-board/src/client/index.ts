/**
 * Task-board client plugin: wires the framework-free core (controller,
 * execution service, store) to the real client runtime and mounts the two
 * DOM surfaces — the sidebar entry row and the board view in the center
 * column.
 *
 * Failure policy: DOM mounting problems are logged, never thrown — the web
 * shell fails the whole boot when a plugin apply throws, and an external
 * plugin must not take the GUI down.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.sessions Context merge (the client Session object layer).
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the renderer-owned ctx.slots Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and its
// LocaleNamespaceMap merge table.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the shared-forms Context merge (ctx.configForms).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BoardController } from '../core/controller.ts'
import { ExecutionService, type ExecutionHistoryEvent } from '../core/execution.ts'
import { SchedulerService } from '../core/scheduler.ts'
import { LocalStorageTaskStore } from '../core/store.ts'
import { mountBoard } from './board-mount.tsx'
import { mountSidebarEntry } from './sidebar-entry.ts'
import { TaskBoardSettingsCard, TaskBoardSettingsCardController, type TaskBoardSettings } from './TaskBoardSettingsCard.tsx'
import { createServedEntryForm } from './settings-entry-form.ts'
import { currentSessionList, sessionDriverOf, type SessionId } from './session-driver.ts'
import { en, zh, type TaskBoardKey } from './locales.ts'

/** Locale namespace this plugin owns. */
const NS = 'task-board'

/** Settings namespace the settings card edits (the Host plugin registers it). */
const TASK_BOARD_NS = 'task-board'

/**
 * Profile entry id this package's patch row carries — the same id in the
 * standalone bundle patch and in the family aggregate, both of which insert
 * the row as `ui-task-board`.
 */
const TASK_BOARD_ENTRY_ID = 'ui-task-board'

/**
 * Profile entry ids this package's rows carry: the patch row, then the bare
 * namespace as the last resort for a Host whose descriptor is keyed by the
 * family namespace itself.
 */
const TASK_BOARD_ENTRY_IDS: readonly string[] = [TASK_BOARD_ENTRY_ID, TASK_BOARD_NS]

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Task-board surface copy. */
    'task-board': TaskBoardKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Domain-owned description of one settings namespace a family card binds. */
export interface SettingsFormSpec<T> {
  /** Settings namespace the card edits. */
  namespace: string
  /**
   * Narrow one wire section; undefined keeps the last accepted value. The
   * shared form already resolves the namespace's own serialized wire schema,
   * so a decoder exists only to narrow beyond that schema.
   */
  decode?: (section: unknown) => T | undefined
}

/**
 * The family settings binder published by the Web UI plugin group. Its `bind`
 * resolves a family namespace to the profile entry id that owns it and hands
 * back the shared configuration form, so it is the only seat that can reach
 * this card's form on a Host whose row id is not the namespace.
 */
export interface SettingsFormBinder {
  /** Bind one family settings namespace. */
  bind<T>(spec: SettingsFormSpec<T>): ConfigForm<T>
}

/**
 * The client Workspace face this file drives, declared structurally: the
 * browser workspace contract ships in an SDK package this bundle does not
 * depend on, and the board only reads the roster and connects a workspace for
 * an execution.
 */
export interface WorkspaceClientFace {
  /** Workspace roster the board's picker and runner consume. */
  list: {
    /** @returns the current workspace roster snapshot. */
    getSnapshot(): {
      items: Array<{ workspaceId: string; title?: string; path: string }>
      /** Workspace the Host reports as most recent; undefined when it reports none. */
      recentWorkspaceId: string | undefined
    }
    /** @param listener - invoked after each roster change. @returns the disposer. */
    subscribe(listener: () => void): () => void
  }
  /** Connect a workspace and report the session it is addressed by. */
  connectWorkspace(workspaceId: string): Promise<string>
}

/**
 * The workspace UI's navigation seat: since the multi-instance Client Session
 * model, selecting a session belongs to the workspace surface rather than the
 * session catalog.
 */
export interface WorkspaceNavigationFace {
  /** Select one session in the workspace UI. */
  openSession(sessionId: string): void
}

/**
 * The legacy API-gateway face the connection handle still carries at runtime
 * (the typed handle exposes the generic `rpc` channel instead). The history
 * read rides it as a narrow optional probe, so a Host that no longer serves it
 * degrades to "history unavailable" instead of breaking the board.
 */
export interface ConnectionApiFace {
  /** API-gateway proxy face, when the connection still attaches one. */
  api?: {
    /** Session-domain endpoints. */
    sessions?: {
      /** Read one session's history tail. */
      history(request: {
        sessionId: string
        maxMessages: number
      }): Promise<{
        result: {
          ok: boolean
          value?: { events: Array<{ event: ExecutionHistoryEvent }> }
        }
      }>
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional family settings binder provided by the Web UI plugin group;
     * absent when that group plugin is not installed, so callers fall back to
     * the shared configuration forms service.
     */
    webUiSettings?: SettingsFormBinder
  }
}

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'sessions', 'workspaces', 'connection', 'configForms', 'locale', 'remote']

/**
 * Mount the task board.
 * @param ctx - client root context (services: sessions, workspaces).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-board: dictionaries')

  // Plugin configuration card: one staged form over the `task-board` settings
  // namespace, contributed to the Web UI plugin group.
  const settingsForm = bindSettingsForm(ctx)
  const settingsCard = new TaskBoardSettingsCardController(settingsForm)
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'task-board',
    order: 110,
    locale: NS,
    inject: () => settingsCard.inject(),
  }, TaskBoardSettingsCard))
  ctx.effect(() => () => { settingsCard.dispose() }, 'task-board: settings card')

  // The sidebar entry and board view mount once the settings form settles;
  // while the form is still loading, the composition default is unknown, so
  // nothing mounts yet. Only an unavailable form (no settings surface served)
  // falls back to the composition default (enabled).
  let uiDisposer: (() => void) | undefined
  const mountUi = (): void => {
    if (uiDisposer !== undefined) return
    const sessions = ctx.sessions
    const workspaces = ctx.get('workspaces') as WorkspaceClientFace
    const connection = ctx.get('connection') as unknown as ConnectionApiFace
    const navigation = ctx.get('uiWorkspace') as WorkspaceNavigationFace | undefined

    // Core wiring: real runtime faces into the framework-free services. The
    // session catalog is adapted (derived main-view selection + a driver over
    // each binding) because the 0.2.0 Client Session model publishes neither
    // fact in the shape the core reads.
    const store = new LocalStorageTaskStore()
    const sessionList = currentSessionList(sessions.list)
    const exec = new ExecutionService({
      sessions: {
        list: sessionList,
        binding: (id) => {
          const binding = sessions.binding(id as SessionId)
          return binding === undefined ? undefined : { session: sessionDriverOf(binding) }
        },
      },
      workspaces: {
        list: workspaces.list,
        connectWorkspace: id => workspaces.connectWorkspace(id),
      },
      history: {
        loadTail: async (sessionId) => {
          const history = connection.api?.sessions?.history
          if (history === undefined) return undefined
          const response = await history({ sessionId, maxMessages: 20 })
          return response.result.ok && response.result.value !== undefined
            ? { events: response.result.value.events.map(entry => entry.event) }
            : undefined
        },
      },
    })
    const controller = new BoardController({
      store,
      exec,
      sessions: {
        list: sessionList,
        // Navigation belongs to the workspace UI since the multi-instance
        // Client Session model: sessions carry no `open` of their own.
        open: id => { navigation?.openSession(id) },
      },
    })
    controller.start()

    // Scheduled runs: a browser-side heartbeat that triggers due tasks through
    // the same run path as the manual Run button. The first tick is gated on
    // the session list baseline so a page-load catch-up never fires into a
    // not-yet-ready runtime; tab visibility recovery ticks immediately.
    const scheduler = new SchedulerService({
      tasks: () => controller.getSnapshot().tasks,
      now: () => Date.now(),
      runTask: id => controller.runTask(id),
      applySchedule: (id, nextRunAt, lastTriggeredAt) =>
        controller.applyScheduleNextRun(id, nextRunAt, lastTriggeredAt),
      ready: () => sessions.list.getSnapshot().phase === 'ready',
      environment: {
        addEventListener: (type, listener) => document.addEventListener(type, listener),
        removeEventListener: (type, listener) => document.removeEventListener(type, listener),
      },
    })
    scheduler.start()

    const disposers: Array<() => void> = []
    try {
      disposers.push(mountSidebarEntry(controller))
      disposers.push(mountBoard(controller, {
        list: sessionList,
        open: id => { navigation?.openSession(id) },
      }))
    } catch (error) {
      // DOM failures degrade the board, never the GUI.
      console.error('[dsh-task-board] mount failed:', error)
    }

    uiDisposer = () => {
      for (const dispose of disposers.splice(0)) dispose()
      scheduler.dispose()
      controller.dispose()
      uiDisposer = undefined
    }
  }
  const syncEnabled = (): void => {
    const snapshot = settingsForm.getSnapshot()
    const enabled = snapshot.status === 'ready'
      ? snapshot.value?.enabled ?? true
      : snapshot.status === 'unavailable'
    if (enabled) mountUi()
    else uiDisposer?.()
  }
  settingsForm.subscribe(syncEnabled)
  syncEnabled()
}

/**
 * Bind the settings form this card stages over.
 *
 * The family binder (`ctx.get('webUiSettings')`, published by the Web UI
 * plugin group) comes first: it is what traces this package's family namespace
 * onto the profile entry id the Host serves the form under, and it keeps its
 * own bridge fallback. A page without that group falls back to the shared
 * configuration forms service bound directly at one of this package's own
 * profile entry ids.
 * @param ctx - client root context.
 * @returns the form the settings card reads and writes.
 */
export function bindSettingsForm(ctx: ClientContext): ConfigForm<TaskBoardSettings> {
  const binder = ctx.get('webUiSettings')
  if (binder !== undefined && typeof binder.bind === 'function') {
    return binder.bind<TaskBoardSettings>({ namespace: TASK_BOARD_NS })
  }
  return createServedEntryForm<TaskBoardSettings>({
    forms: ctx.configForms,
    entryIds: TASK_BOARD_ENTRY_IDS,
  })
}
