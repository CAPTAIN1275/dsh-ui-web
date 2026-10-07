/**
 * Runtime-face adapters for the board's framework-free core.
 *
 * The 0.2.0 Client Session model carries no global "current" selection and no
 * live `turnEnds` map on the session snapshot, so the two facts the board
 * reads are derived here from what the model does publish: the catalog's
 * per-source ownership counts (`retainedBy.mainView`) and the binding's
 * durable event window. Both adapters stay structural — the core keeps
 * consuming the narrow faces it declares (see `src/core/execution.ts`).
 * @module @captain1275/dsh-client-ui-task-board/session-driver
 */

import type { SessionBinding, SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionDriver } from '../core/execution.ts'

/** Catalog row the board renders in its "current session" block. */
export type { SessionSummary }

/**
 * Session identity, spelled from the catalog row so this package needs no
 * direct session-package import.
 */
export type SessionId = SessionSummary['id']

/**
 * Resolve the Session the main view currently shows.
 *
 * Reads the catalog's rows rather than a per-id retain-info source: ownership
 * counts ride the list snapshot, so this neither allocates observers nor opens
 * history, and a subscription to the list still fires when the selection
 * moves. `mainView` is declared by the workspace UI; the row is read
 * structurally so the count map needs no augmentation from a package this
 * bundle does not depend on.
 * @param byId - the session catalog's rows (`SessionListState.byId`).
 * @returns the main-view session id, or undefined when the main view shows none.
 */
export function mainViewSessionId(byId: SessionListState['byId'] | undefined): SessionId | undefined {
  if (byId === undefined) return undefined
  for (const row of Object.values(byId)) {
    const retainedBy = row?.retainedBy as Readonly<Partial<Record<string, number>>> | undefined
    if ((retainedBy?.mainView ?? 0) > 0) return row.id
  }
  return undefined
}

/** The session-list snapshot the board reads: the catalog plus the main-view selection. */
export interface CurrentSessionListState extends SessionListState {
  /** Session the main view shows, when one is selected. */
  current: SessionId | undefined
}

/** The session-list face the board's view and controller consume. */
export interface CurrentSessionListFace {
  /** @returns the catalog snapshot with its derived selection (stable until the source changes). */
  getSnapshot(): CurrentSessionListState
  /** @param listener - invoked after each catalog change. @returns the disposer. */
  subscribe(listener: () => void): () => void
}

/**
 * Wrap a session catalog so it also answers the `current` selection the board
 * reads. The derived snapshot is cached per source snapshot: consumers compare
 * snapshot identity (React's `useSyncExternalStore` included), so rebuilding
 * on every read would loop.
 * @param list - the catalog store (`ctx.sessions.list`).
 * @returns the catalog plus its derived selection.
 */
export function currentSessionList(list: {
  getSnapshot(): SessionListState
  subscribe(listener: () => void): () => void
}): CurrentSessionListFace {
  let source: SessionListState | undefined
  let derived: CurrentSessionListState | undefined
  return {
    getSnapshot: () => {
      const next = list.getSnapshot()
      if (derived === undefined || next !== source) {
        source = next
        derived = { ...next, current: mainViewSessionId(next.byId) }
      }
      return derived
    },
    subscribe: listener => list.subscribe(listener),
  }
}

/**
 * Adapt one live Session binding onto the driver face the execution service
 * drives.
 *
 * The snapshot no longer carries a `turnEnds` map, so the counter the
 * settlement watch baselines and re-reads is derived from the binding's own
 * durable event window: every `turn/end` in the window contributes one entry
 * keyed by its seq. Only the map's size is consumed (a turn completed after
 * the baseline), which keeps the watch's semantics unchanged.
 * @param binding - the session catalog's binding for the execution session.
 * @returns the driver face over that binding.
 */
export function sessionDriverOf(binding: SessionBinding): SessionDriver {
  const session = binding.session
  type PromptContent = Parameters<typeof session.prompt>[0]
  return {
    rename: title => session.rename(title),
    prompt: (content, mode) => session.prompt(content as PromptContent, mode),
    getSnapshot: () => {
      const snapshot = session.getSnapshot()
      const turnEnds = new Map<number, number>()
      for (const entry of binding.eventSource.getSnapshot().entries) {
        if (entry.type === 'event' && entry.event.type === 'turn/end') {
          turnEnds.set(entry.event.seq, entry.event.time)
        }
      }
      return {
        running: snapshot.running,
        lastAgentError: snapshot.lastAgentError,
        turnEnds,
      }
    },
    subscribe: (listener) => {
      const offSession = session.subscribe(listener)
      const offEvents = binding.eventSource.subscribe(listener)
      return () => {
        offSession()
        offEvents()
      }
    },
  }
}
