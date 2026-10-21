/**
 * Browser transport for the Host task-board ledger: same-origin JSON
 * read/write plus the revision-only SSE subscription.
 *
 * Transport failures are values, never exceptions: the board degrades to its
 * last known snapshot and retries on the next change hint. Reconnect is
 * handled by the browser's EventSource (the stream sends `retry: 2000`), and
 * every successful (re)connect plus every tab becoming visible triggers one
 * plain "re-read the snapshot" call, so a stream that was down for a while
 * catches up without any missed-event bookkeeping.
 * @module @captain1275/dsh-client-ui-task-board/core/http-ledger
 */

import { decodeLedger, type TaskLedger } from './ledger.ts'
import type { TaskRecord } from './tasks.ts'

/** Full-snapshot route served by the Host half. */
export const LEDGER_ROUTE = '/task-board/ledger'

/** Revision stream served by the Host half. */
export const LEDGER_EVENTS_ROUTE = '/task-board/events'

/** One settle-or-fail outcome of a whole-ledger write. */
export type LedgerWriteOutcome =
  | { ok: true; ledger: TaskLedger }
  /** Another writer committed first; `ledger` is the Host's current snapshot when readable. */
  | { ok: false; conflict: true; ledger: TaskLedger | undefined }
  /** Transport/host failure: the caller keeps its local snapshot and retries later. */
  | { ok: false; conflict: false }

/** Minimal response face the transport reads (fetch `Response` satisfies it). */
export interface LedgerResponseFace {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

/** Minimal event-source face the transport reads (browser `EventSource` satisfies it). */
export interface LedgerEventSourceFace {
  addEventListener(type: string, listener: () => void): void
  close(): void
}

/** Browser capabilities the transport needs (injectable for tests). */
export interface LedgerTransportEnv {
  /** Same-origin JSON fetch. */
  fetch(input: string, init?: {
    method?: string
    headers?: Record<string, string>
    body?: string
  }): Promise<LedgerResponseFace>
  /** Open the revision stream. */
  createEventSource(url: string): LedgerEventSourceFace
  /** Invoke the callback whenever the tab becomes visible again. */
  onVisible(fn: () => void): () => void
}

/** Transport face the Host-backed store drives. */
export interface LedgerTransport {
  /** Read the Host snapshot; undefined when the Host is unreachable. */
  read(): Promise<TaskLedger | undefined>
  /** Write the whole ledger against a base revision. */
  write(tasks: readonly TaskRecord[], expectedRevision: number): Promise<LedgerWriteOutcome>
  /** Subscribe to revision hints (SSE + tab visibility + reconnect). */
  subscribe(onChange: () => void): () => void
}

/** Browser defaults for {@link LedgerTransportEnv}. */
function browserEnv(): LedgerTransportEnv {
  return {
    fetch: (input, init) => globalThis.fetch(input, init) as unknown as Promise<LedgerResponseFace>,
    createEventSource: url => new EventSource(url) as unknown as LedgerEventSourceFace,
    onVisible: (fn) => {
      const doc = globalThis.document
      if (doc === undefined) return () => {}
      const handler = (): void => {
        if (doc.visibilityState === 'visible') fn()
      }
      doc.addEventListener('visibilitychange', handler)
      return () => { doc.removeEventListener('visibilitychange', handler) }
    },
  }
}

/** Read one JSON body, tolerating a non-JSON payload. */
async function readJson(response: LedgerResponseFace): Promise<Record<string, unknown> | undefined> {
  try {
    const body = await response.json() as unknown
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
    return body as Record<string, unknown>
  } catch {
    return undefined
  }
}

/** Same-origin HTTP transport over the Host ledger routes. */
export class HttpLedgerTransport implements LedgerTransport {
  private readonly env: LedgerTransportEnv

  /** @param env - browser capabilities (defaults to the real window). */
  constructor(env: LedgerTransportEnv | undefined = undefined) {
    this.env = env ?? browserEnv()
  }

  /** {@inheritDoc LedgerTransport.read} */
  async read(): Promise<TaskLedger | undefined> {
    try {
      const response = await this.env.fetch(LEDGER_ROUTE, { headers: { accept: 'application/json' } })
      if (!response.ok) return undefined
      const body = await readJson(response)
      if (body === undefined || body.ok !== true) return undefined
      return decodeLedger(body.ledger)
    } catch {
      return undefined
    }
  }

  /** {@inheritDoc LedgerTransport.write} */
  async write(tasks: readonly TaskRecord[], expectedRevision: number): Promise<LedgerWriteOutcome> {
    let response: LedgerResponseFace
    try {
      response = await this.env.fetch(LEDGER_ROUTE, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision, tasks }),
      })
    } catch {
      return { ok: false, conflict: false }
    }
    const body = await readJson(response)
    if (response.ok && body !== undefined && body.ok === true) {
      const ledger = decodeLedger(body.ledger)
      return ledger === undefined ? { ok: false, conflict: false } : { ok: true, ledger }
    }
    if (response.status === 409) {
      return {
        ok: false,
        conflict: true,
        ledger: body === undefined ? undefined : decodeLedger(body.ledger),
      }
    }
    return { ok: false, conflict: false }
  }

  /** {@inheritDoc LedgerTransport.subscribe} */
  subscribe(onChange: () => void): () => void {
    let source: LedgerEventSourceFace | undefined
    try {
      source = this.env.createEventSource(LEDGER_EVENTS_ROUTE)
    } catch {
      source = undefined
    }
    if (source !== undefined) {
      // A revision hint: the payload's number is not needed — any change means
      // "re-read the snapshot", and a stale hint only costs one extra read.
      source.addEventListener('change', () => { onChange() })
      // Every (re)connect re-syncs, so a stream outage cannot leave the window
      // behind for longer than one reconnect.
      source.addEventListener('open', () => { onChange() })
    }
    const disposeVisibility = this.env.onVisible(() => { onChange() })
    return () => {
      disposeVisibility()
      source?.close()
    }
  }
}
